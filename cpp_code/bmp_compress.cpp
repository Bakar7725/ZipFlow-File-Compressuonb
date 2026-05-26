#include <iostream>
#include <fstream>
#include <vector>
#include <queue>
#include <map>
#include <string>

using namespace std;

struct HuffNode
{
    unsigned char data;
    int freq;
    HuffNode *left, *right;
    HuffNode(unsigned char d, int f)
    {
        data = d;
        freq = f;
        left = NULL;
        right = NULL;
    }
};

struct Compare
{
    bool operator()(HuffNode *a, HuffNode *b)
    {
        return a->freq > b->freq;
    }
};

HuffNode *buildHuffmanTree(map<unsigned char, int> &freqMap)
{
    priority_queue<HuffNode *, vector<HuffNode *>, > pq;
    ;
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

void generateHuffmanCodes(HuffNode *root, string code, map<unsigned char, string> &codes)
{
    if (!root)
        return;
    if (root->left == NULL && root->right == NULL)
    {
        codes[root->data] = code;
    }
    generateHuffmanCodes(root->left, code + "0", codes);
    generateHuffmanCodes(root->right, code + "1", codes);
}

vector<unsigned char> RLECompress(vector<unsigned char> &data)
{
    vector<unsigned char> compressed;
    for (size_t i = 0; i < data.size();)
    {
        unsigned char val = data[i];
        int count = 1;
        while (i + count < data.size() && data[i + count] == val && count < 255)
        {
            count++;
        }
        compressed.push_back(val);
        compressed.push_back((unsigned char)count);
        i = i + count;
    }
    return compressed;
}

int main(int argc, char *argv[])
{
    if (argc != 3)
    {
        cout << "Usage: " << argv[0] << " <input_file> <output_file>" << endl;
        return 1;
    }

    string inputFile = argv[1];
    string outputFile = argv[2];

    ifstream in(inputFile, ios::binary);
    if (!in)
    {
        cerr << "Cannot open input file." << endl;
        return 1;
    }

    vector<unsigned char> header(54);
    in.read((char *)header.data(), 54);

    vector<unsigned char> pixels;
    char byte;
    while (in.get(byte))
    {
        pixels.push_back(static_cast<unsigned char>(byte));
    }
    in.close();

    vector<unsigned char> rleData = RLECompress(pixels);

    map<unsigned char, int> freqMap;
    for (size_t i = 0; i < rleData.size(); i++)
    {
        unsigned char c = rleData[i];
        freqMap[c]++;
    }

    HuffNode *root = buildHuffmanTree(freqMap);
    map<unsigned char, string> codes;
    generateHuffmanCodes(root, "", codes);

    string bitString;
    for (auto c : rleData)
        bitString = bitString + codes[c];

    vector<unsigned char> finalData;
    for (size_t i = 0; i < bitString.size(); i += 8)
    {
        string byteStr = bitString.substr(i, 8);
        while (byteStr.size() < 8)
            byteStr += '0';
        finalData.push_back((unsigned char)stoi(byteStr, nullptr, 2));
    }

    ofstream out(outputFile, ios::binary);

    out.write((char *)header.data(), 54);

    unsigned short mapSize = codes.size();
    out.write((char *)&mapSize, sizeof(mapSize));

    for (auto &p : codes)
    {
        unsigned char c = p.first;
        unsigned char len = p.second.size();
        out.write((char *)&c, 1);
        out.write((char *)&len, 1);
        for (char bit : p.second)
            out.put(bit);
    }

    out.write((char *)finalData.data(), finalData.size());
    out.close();

    double originalSize = pixels.size();
    double compressedSize = finalData.size();
    double compressionRatio = (1.0 - (compressedSize / originalSize)) * 100.0;

    cout << "Original Size: " << originalSize << " bytes" << endl;
    cout << "Compressed Size: " << compressedSize << " bytes" << endl;
    cout << "Compression Ratio: " << compressionRatio << "%" << endl;

    return 0;
}