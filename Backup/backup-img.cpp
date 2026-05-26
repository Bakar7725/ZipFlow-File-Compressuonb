#include <iostream>
#include <fstream>
#include <vector>
#include <queue>
#include <map>
#include <string>

using namespace std;

// ------------------- Huffman Node -------------------
struct HuffNode
{
    unsigned char data;
    int freq;
    HuffNode *left, *right;
    HuffNode(unsigned char d, int f) : data(d), freq(f), left(nullptr), right(nullptr) {}
};

// Compare for priority queue
struct Compare
{
    bool operator()(HuffNode *a, HuffNode *b) { return a->freq > b->freq; }
};

// Build Huffman Tree
HuffNode *buildHuffmanTree(map<unsigned char, int> &freqMap)
{
    priority_queue<HuffNode *, vector<HuffNode *>, Compare> pq;
    for (auto &p : freqMap)
        pq.push(new HuffNode(p.first, p.second));

    while (pq.size() > 1)
    {
        HuffNode *left = pq.top();
        pq.pop();
        HuffNode *right = pq.top();
        pq.pop();
        HuffNode *parent = new HuffNode(0, left->freq + right->freq);
        parent->left = left;
        parent->right = right;
        pq.push(parent);
    }
    return pq.top();
}

// Generate Huffman Codes
void generateHuffmanCodes(HuffNode *root, string code, map<unsigned char, string> &codes)
{
    if (!root)
        return;
    if (!root->left && !root->right)
        codes[root->data] = code;
    generateHuffmanCodes(root->left, code + "0", codes);
    generateHuffmanCodes(root->right, code + "1", codes);
}

// ------------------- RLE Compression -------------------
vector<unsigned char> RLECompress(vector<unsigned char> &data)
{
    vector<unsigned char> compressed;
    for (size_t i = 0; i < data.size();)
    {
        unsigned char val = data[i];
        int count = 1;
        while (i + count < data.size() && data[i + count] == val && count < 255)
            count++;
        compressed.push_back(val);
        compressed.push_back((unsigned char)count);
        i += count;
    }
    return compressed;
}

vector<unsigned char> RLEDecompress(vector<unsigned char> &data)
{
    vector<unsigned char> decompressed;
    for (size_t i = 0; i < data.size(); i += 2)
    {
        unsigned char val = data[i];
        unsigned char count = data[i + 1];
        for (int j = 0; j < count; j++)
            decompressed.push_back(val);
    }
    return decompressed;
}

// ------------------- BMP Compression -------------------
void compressBMP(string inputFile, string outputFile)
{
    ifstream in(inputFile, ios::binary);
    if (!in)
    {
        cout << "Cannot open input file.\n";
        return;
    }

    // Read BMP header (first 54 bytes)
    vector<unsigned char> header(54);
    in.read((char *)header.data(), 54);

    // Read pixel data
    vector<unsigned char> pixels((istreambuf_iterator<char>(in)), istreambuf_iterator<char>());
    in.close();

    // Step 1: RLE compression
    vector<unsigned char> rleData = RLECompress(pixels);

    // Step 2: Huffman compression
    map<unsigned char, int> freqMap;
    for (auto c : rleData)
        freqMap[c]++;
    HuffNode *root = buildHuffmanTree(freqMap);
    map<unsigned char, string> codes;
    generateHuffmanCodes(root, "", codes);

    string bitString;
    for (auto c : rleData)
        bitString += codes[c];

    // Convert bitString to bytes
    vector<unsigned char> finalData;
    for (size_t i = 0; i < bitString.size(); i += 8)
    {
        string byteStr = bitString.substr(i, 8);
        while (byteStr.size() < 8)
            byteStr += '0';
        finalData.push_back((unsigned char)stoi(byteStr, nullptr, 2));
    }

    // Save compressed file (header + codes + compressed data)
    ofstream out(outputFile, ios::binary);
    // Save BMP header first (for simplicity)
    out.write((char *)header.data(), 54);

    // Save Huffman table size
    unsigned short mapSize = codes.size();
    out.write((char *)&mapSize, sizeof(mapSize));

    // Save Huffman table (char + code length + code)
    for (auto &p : codes)
    {
        unsigned char c = p.first;
        unsigned char len = p.second.size();
        out.write((char *)&c, 1);
        out.write((char *)&len, 1);
        for (char bit : p.second)
            out.put(bit);
    }

    // Save compressed data
    out.write((char *)finalData.data(), finalData.size());
    out.close();

    // Calculate compression percentage
    double originalSize = pixels.size();
    double compressedSize = finalData.size();

    double compressionRatio = (1.0 - (compressedSize / originalSize)) * 100.0;

    cout << "Compression done.\n";
    cout << "Original Size   : " << originalSize << " bytes\n";
    cout << "Compressed Size : " << compressedSize << " bytes\n";
    cout << "Compression     : " << compressionRatio << " %\n";
}

// ------------------- Decompression -------------------
void decompressBMP(string inputFile, string outputFile)
{
    ifstream in(inputFile, ios::binary);
    if (!in)
    {
        cout << "Cannot open input file.\n";
        return;
    }

    // Read header
    vector<unsigned char> header(54);
    in.read((char *)header.data(), 54);

    // Read Huffman table
    unsigned short mapSize;
    in.read((char *)&mapSize, sizeof(mapSize));

    map<string, unsigned char> decodeMap;
    for (int i = 0; i < mapSize; i++)
    {
        unsigned char c, len;
        in.read((char *)&c, 1);
        in.read((char *)&len, 1);
        string code(len, '0');
        for (int j = 0; j < len; j++)
            code[j] = in.get();
        decodeMap[code] = c;
    }

    // Read compressed data
    vector<unsigned char> compressedData((istreambuf_iterator<char>(in)), istreambuf_iterator<char>());
    in.close();

    // Convert bytes to bit string
    string bitString;
    for (auto b : compressedData)
    {
        for (int i = 7; i >= 0; i--)
            bitString += ((b >> i) & 1) ? '1' : '0';
    }

    // Decode Huffman
    vector<unsigned char> rleData;
    string temp;
    for (char bit : bitString)
    {
        temp += bit;
        if (decodeMap.find(temp) != decodeMap.end())
        {
            rleData.push_back(decodeMap[temp]);
            temp.clear();
        }
    }

    // Decode RLE
    vector<unsigned char> pixels = RLEDecompress(rleData);

    // Save decompressed BMP
    ofstream out(outputFile, ios::binary);
    out.write((char *)header.data(), 54);
    out.write((char *)pixels.data(), pixels.size());
    out.close();

    cout << "Decompression done. Decompressed file saved.\n";
}
string getCompressedFilename(const string &inputFile)
{
    size_t dotPos = inputFile.find_last_of('.');
    string baseName = (dotPos == string::npos) ? inputFile : inputFile.substr(0, dotPos);
    return baseName + "_compressed.bin";
}

// Get output filename for decompression
string getDecompressedFilename(const string &inputFile)
{
    size_t dotPos = inputFile.find_last_of('.');
    string baseName = (dotPos == string::npos) ? inputFile : inputFile.substr(0, dotPos);

    // If input is like abc_compressed, remove "_compressed" if present
    string suffix = "_compressed";
    if (baseName.size() >= suffix.size() &&
        baseName.substr(baseName.size() - suffix.size()) == suffix)
    {
        baseName = baseName.substr(0, baseName.size() - suffix.size());
    }

    return baseName + "_decompressed.bmp";
}
// ------------------- Main Menu -------------------
int main()
{
    int choice;
    string inputFile, outputFile;
    while (true)
    {
        cout << "\n--- BMP Compressor ---\n";
        cout << "1. Compress BMP\n2. Decompress BMP\n3. Exit\nChoice: ";
        cin >> choice;

        switch (choice)
        {
        case 1:
            cout << "Enter input BMP file: ";
            cin >> inputFile;
            outputFile = getCompressedFilename(inputFile);
            cout << "Output file will be: " << outputFile << endl;
            compressBMP(inputFile, outputFile);
            break;
        case 2:
            cout << "Enter input compressed file: ";
            cin >> inputFile;
            outputFile = getDecompressedFilename(inputFile);
            cout << "Output file will be: " << outputFile << endl;
            decompressBMP(inputFile, outputFile);
            break;
        case 3:
            return 0;
        default:
            cout << "Invalid choice!\n";
        }
    }
}