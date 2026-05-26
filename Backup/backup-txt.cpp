#include <iostream>
#include <fstream>
#include <vector>
#include <queue>
#include <unordered_map>
#include <iomanip>
#include <string>
#include <algorithm>
#include <cstring>
using namespace std;

class TreeNode
{
public:
    char data;
    int freq;
    TreeNode *left, *right;

    TreeNode(char d, int f)
    {
        this->data = d;
        this->freq = f;
        this->left = nullptr;
        this->right = nullptr;
    }
};

class Compare
{
public:
    bool operator()(TreeNode *a, TreeNode *b)
    {
        if (a->freq == b->freq)
            return (a->data == 0 ? 1 : 0) > (b->data == 0 ? 1 : 0); // Prefer leaf nodes
        return a->freq > b->freq;
    }
};

class Huffman
{
private:
    unordered_map<char, string> E_map;
    unordered_map<string, char> D_map;

    // Improved Run-Length Encoding
    string RLE_encode(const string &data)
    {
        string encoded;
        int n = data.length();
        int i = 0;

        while (i < n)
        {
            char current = data[i];
            int count = 1;

            // Count consecutive characters
            while (i + count < n && data[i + count] == current && count < 255)
            {
                count++;
            }

            if (count >= 4)
            {
                // Use RLE for runs of 4 or more
                encoded += '\xFE'; // RLE marker
                encoded += (char)count;
                encoded += current;
            }
            else
            {
                // Write raw characters
                for (int j = 0; j < count; j++)
                {
                    if (data[i + j] == '\xFE')
                    {
                        // Escape the RLE marker
                        encoded += '\xFE';
                        encoded += '\x01';
                        encoded += '\xFE';
                    }
                    else
                    {
                        encoded += data[i + j];
                    }
                }
            }

            i += count;
        }

        return encoded;
    }

    string RLE_decode(const string &data)
    {
        string decoded;
        int n = data.length();
        int i = 0;

        while (i < n)
        {
            if (data[i] == '\xFE' && i + 2 < n)
            {
                int count = (unsigned char)data[i + 1];
                char ch = data[i + 2];

                for (int j = 0; j < count; j++)
                {
                    decoded += ch;
                }

                i += 3;
            }
            else
            {
                decoded += data[i];
                i++;
            }
        }

        return decoded;
    }

    // Burrows-Wheeler Transform (simplified but effective)
    string BWT_transform(const string &data, int &primary_index)
    {
        int n = data.length();
        if (n <= 1)
            return data;

        vector<int> indices(n);
        for (int i = 0; i < n; i++)
            indices[i] = i;

        // Sort rotations based on their suffixes
        sort(indices.begin(), indices.end(), [&](int a, int b)
             {
            for (int i = 0; i < n; i++) {
                char ca = data[(a + i) % n];
                char cb = data[(b + i) % n];
                if (ca != cb) return ca < cb;
            }
            return false; });

        // Build transformed string
        string transformed;
        for (int i = 0; i < n; i++)
        {
            int idx = indices[i];
            transformed += data[(idx + n - 1) % n];
            if (idx == 0)
                primary_index = i;
        }

        return transformed;
    }

    string BWT_inverse(const string &data, int primary_index)
    {
        int n = data.length();
        if (n <= 1)
            return data;

        // Create and sort first column
        string first_col = data;
        sort(first_col.begin(), first_col.end());

        // Build next array
        vector<vector<int>> positions(256);
        for (int i = 0; i < n; i++)
        {
            positions[(unsigned char)data[i]].push_back(i);
        }

        vector<int> next(n);
        vector<int> count(256, 0);
        for (int i = 0; i < n; i++)
        {
            unsigned char c = first_col[i];
            next[i] = positions[c][count[c]++];
        }

        // Reconstruct original string
        string original;
        int idx = primary_index;
        for (int i = 0; i < n; i++)
        {
            idx = next[idx];
            original += data[idx];
        }

        return original;
    }

    // Move-To-Front Transform
    string MTF_encode(const string &data)
    {
        vector<char> alphabet(256);
        for (int i = 0; i < 256; i++)
            alphabet[i] = (char)i;

        string encoded;
        for (char c : data)
        {
            // Find position
            int pos = 0;
            while (alphabet[pos] != c)
                pos++;

            encoded += (char)pos;

            // Move to front
            for (int i = pos; i > 0; i--)
            {
                alphabet[i] = alphabet[i - 1];
            }
            alphabet[0] = c;
        }

        return encoded;
    }

    string MTF_decode(const string &data)
    {
        vector<char> alphabet(256);
        for (int i = 0; i < 256; i++)
            alphabet[i] = (char)i;

        string decoded;
        for (unsigned char idx : data)
        {
            char c = alphabet[idx];
            decoded += c;

            // Move to front
            for (int i = idx; i > 0; i--)
            {
                alphabet[i] = alphabet[i - 1];
            }
            alphabet[0] = c;
        }

        return decoded;
    }

    // Delta encoding for improved compression
    string delta_encode(const string &data)
    {
        string encoded;
        if (data.empty())
            return encoded;

        encoded += data[0];
        for (size_t i = 1; i < data.length(); i++)
        {
            char delta = data[i] - data[i - 1];
            encoded += delta;
        }

        return encoded;
    }

    string delta_decode(const string &data)
    {
        string decoded;
        if (data.empty())
            return decoded;

        decoded += data[0];
        for (size_t i = 1; i < data.length(); i++)
        {
            char c = decoded.back() + data[i];
            decoded += c;
        }

        return decoded;
    }

public:
    unordered_map<char, string> E_map_public;
    unordered_map<string, char> D_map_public;

    void generateCodes(TreeNode *root, string code);
    void Encode(const string &inp_Fname, const string &op_Fname);
    void Decode(const string &inp_Fname, const string &op_Fname);

private:
    void analyzeAndOptimize(const string &data, unordered_map<char, int> &freq);
    void writeHeader(ostream &output, int uniqueChars, int bwt_index);
    void readHeader(istream &input, int &uniqueChars, int &bwt_index);
};

void Huffman::analyzeAndOptimize(const string &data, unordered_map<char, int> &freq)
{
    freq.clear();
    for (char ch : data)
    {
        freq[ch]++;
    }

    // Boost frequencies of common characters for better compression
    static const string common_chars = "etaoinshrdlcumwfgypbvkjxqzETAOINSHRDLCUMWFGYPBVKJXQZ0123456789 \n\t";
    for (char ch : common_chars)
    {
        if (freq.find(ch) != freq.end())
        {
            freq[ch] += 10; // Boost common chars slightly
        }
    }
}

void Huffman::writeHeader(ostream &output, int uniqueChars, int bwt_index)
{
    // Write BWT index first
    output.write((char *)&bwt_index, sizeof(int));

    // Write number of unique characters
    output.write((char *)&uniqueChars, sizeof(int));

    // Write each code
    for (auto &pair : E_map_public)
    {
        output.put(pair.first);
        string code = pair.second;
        unsigned char len = code.length();
        output.put(len);

        // Pack code into bytes
        unsigned char current = 0;
        int bit_count = 0;

        for (char bit : code)
        {
            if (bit == '1')
            {
                current |= (1 << (7 - bit_count));
            }
            bit_count++;

            if (bit_count == 8)
            {
                output.put(current);
                current = 0;
                bit_count = 0;
            }
        }

        // Write remaining bits if any
        if (bit_count > 0)
        {
            output.put(current);
        }
    }
}

void Huffman::readHeader(istream &input, int &uniqueChars, int &bwt_index)
{
    // Read BWT index
    input.read((char *)&bwt_index, sizeof(int));

    // Read number of unique characters
    input.read((char *)&uniqueChars, sizeof(int));

    D_map_public.clear();

    for (int i = 0; i < uniqueChars; i++)
    {
        char character = input.get();
        unsigned char len = input.get();

        string code = "";
        int bits_read = 0;

        while (bits_read < len)
        {
            unsigned char byte = input.get();
            for (int bit = 7; bit >= 0 && bits_read < len; bit--, bits_read++)
            {
                if (byte & (1 << bit))
                {
                    code += '1';
                }
                else
                {
                    code += '0';
                }
            }
        }

        D_map_public[code] = character;
    }
}

void Huffman::generateCodes(TreeNode *root, string code)
{
    if (!root)
        return;
    if (!root->left && !root->right)
    {
        E_map_public[root->data] = code;
        D_map_public[code] = root->data;
    }

    generateCodes(root->left, code + "0");
    generateCodes(root->right, code + "1");
}

void Huffman::Encode(const string &inp_Fname, const string &op_Fname)
{
    ifstream input(inp_Fname, ios::binary);
    ofstream output(op_Fname, ios::binary);

    if (!input.is_open() || !output.is_open())
    {
        cerr << "Error: Unable to open files." << endl;
        return;
    }

    // Read entire file
    input.seekg(0, ios::end);
    int originalSize = input.tellg();
    input.seekg(0, ios::beg);

    string fileData(originalSize, '\0');
    input.read(&fileData[0], originalSize);

    if (originalSize == 0)
    {
        cerr << "Error: Empty input file." << endl;
        return;
    }

    cout << "Applying multi-stage preprocessing..." << endl;

    string processedData = fileData;

    // Decide whether to use BWT + MTF
    const int SMALL_FILE_THRESHOLD = 100 * 1024; // 100 KB
    bool useBWT_MTF = (originalSize < SMALL_FILE_THRESHOLD);
    int bwt_index = 0;

    if (useBWT_MTF)
    {
        processedData = BWT_transform(processedData, bwt_index);
        cout << "  BWT applied" << endl;

        processedData = MTF_encode(processedData);
        cout << "  MTF applied" << endl;
    }
    else
    {
        cout << "Skipping BWT + MTF for large file." << endl;
    }

    // Step 3: Apply RLE
    processedData = RLE_encode(processedData);
    cout << "  RLE applied" << endl;

    // Analyze frequencies on preprocessed data
    unordered_map<char, int> freq;
    analyzeAndOptimize(processedData, freq);

    if (freq.size() <= 1)
    {
        cerr << "File too uniform for compression." << endl;
        return;
    }

    // Build Huffman tree
    priority_queue<TreeNode *, vector<TreeNode *>, Compare> pq;
    for (auto &pair : freq)
    {
        pq.push(new TreeNode(pair.first, pair.second));
    }

    while (pq.size() > 1)
    {
        TreeNode *left = pq.top();
        pq.pop();
        TreeNode *right = pq.top();
        pq.pop();
        TreeNode *parent = new TreeNode('\0', left->freq + right->freq);
        parent->left = left;
        parent->right = right;
        pq.push(parent);
    }

    TreeNode *root = pq.top();
    generateCodes(root, "");

    // Write a 1-byte flag indicating BWT+MTF usage
    unsigned char flag = useBWT_MTF ? 1 : 0;
    output.put(flag);

    // Write header with BWT index
    int uniqueChars = freq.size();
    writeHeader(output, uniqueChars, bwt_index);

    // Encode data
    vector<unsigned char> encodedBytes;
    unsigned char currentByte = 0;
    int bitPos = 7;
    int totalBits = 0;

    for (char ch : processedData)
    {
        const string &code = E_map_public[ch];
        totalBits += code.length();

        for (char bit : code)
        {
            if (bit == '1')
            {
                currentByte |= (1 << bitPos);
            }
            bitPos--;
            if (bitPos < 0)
            {
                encodedBytes.push_back(currentByte);
                currentByte = 0;
                bitPos = 7;
            }
        }
    }

    // Write remaining bits
    int extraBits = (bitPos == 7) ? 0 : bitPos + 1;
    if (extraBits != 8)
    {
        encodedBytes.push_back(currentByte);
    }

    output.write((char *)&extraBits, sizeof(int));
    output.write((char *)&encodedBytes[0], encodedBytes.size());

    output.close();
    input.close();

    // Calculate statistics
    ifstream compressedFile(op_Fname, ios::binary);
    compressedFile.seekg(0, ios::end);
    int compressedSize = compressedFile.tellg();
    compressedFile.close();

    double compressionRatio = static_cast<double>(compressedSize) / originalSize;
    double compressionPercentage = (1.0 - compressionRatio) * 100;

    cout << "\nCompression Successful\n";
    cout << "Original Size: " << originalSize << " bytes\n";
    cout << "Compressed Size: " << compressedSize << " bytes\n";
    cout << "Compression Ratio: " << fixed << setprecision(3) << compressionRatio << "\n";
    cout << "Compression Percentage: " << fixed << setprecision(1) << compressionPercentage << "%\n";
    cout << "Unique characters: " << uniqueChars << endl;
    cout << "Average bits per original byte: " << (totalBits * 1.0) / originalSize << endl;
}

void Huffman::Decode(const string &inp_Fname, const string &op_Fname)
{
    ifstream input(inp_Fname, ios::binary);
    ofstream output(op_Fname, ios::binary);

    if (!input.is_open() || !output.is_open())
    {
        cerr << "Error: Unable to open files." << endl;
        return;
    }

    // Read BWT+MTF flag
    unsigned char flag;
    input.read((char *)&flag, 1);
    bool useBWT_MTF = (flag == 1);

    int uniqueChars, bwt_index;
    readHeader(input, uniqueChars, bwt_index);

    int extraBits;
    input.read((char *)&extraBits, sizeof(int));

    // Read encoded bytes
    vector<unsigned char> encodedBytes;
    char byte;
    while (input.read(&byte, sizeof(char)))
    {
        encodedBytes.push_back(byte);
    }

    // Convert to binary string
    string binaryData;
    for (size_t i = 0; i < encodedBytes.size(); i++)
    {
        unsigned char b = encodedBytes[i];
        int bitsToRead = (i == encodedBytes.size() - 1) ? (8 - extraBits) : 8;
        for (int bitPos = 7; bitPos >= 8 - bitsToRead; bitPos--)
        {
            binaryData += (b & (1 << bitPos)) ? '1' : '0';
        }
    }

    // Decode using Huffman codes
    string decodedData;
    string code = "";
    for (char bit : binaryData)
    {
        code += bit;
        if (D_map_public.find(code) != D_map_public.end())
        {
            decodedData += D_map_public[code];
            code = "";
        }
    }

    cout << "Applying multi-stage postprocessing..." << endl;

    // Reverse RLE
    decodedData = RLE_decode(decodedData);
    cout << "  RLE reversed" << endl;

    if (useBWT_MTF)
    {
        decodedData = MTF_decode(decodedData);
        cout << "  MTF reversed" << endl;

        decodedData = BWT_inverse(decodedData, bwt_index);
        cout << "  BWT reversed" << endl;
    }
    else
    {
        cout << "Skipping BWT + MTF reversal for large file." << endl;
    }

    output.write(decodedData.c_str(), decodedData.length());

    input.close();
    output.close();
    cout << "\nDecompression Successful\n";
}

int main(int argc, char *argv[])
{
    if (argc != 4)
    {
        cerr << "Usage: " << argv[0] << " <input_file> <output_file> <compress/decompress>\n";
        cerr << "For best compression, use text files > 10KB\n";
        return 1;
    }

    string inputFile = argv[1];
    string outputFile = argv[2];
    string mode = argv[3];

    Huffman huffman;

    if (mode == "compress")
    {
        // Check file type for better user feedback
        string extension = inputFile.substr(inputFile.find_last_of(".") + 1);
        if (extension == "zip" || extension == "jpg" || extension == "png" ||
            extension == "mp3" || extension == "mp4" || extension == "pdf")
        {
            cout << "Warning: " << extension << " files are already compressed.\n";
            cout << "Compression results may be poor.\n";
        }

        huffman.Encode(inputFile, outputFile);
    }
    else if (mode == "decompress")
    {
        huffman.Decode(inputFile, outputFile);
    }
    else
    {
        cerr << "Invalid mode. Use 'compress' or 'decompress'.\n";
        return 1;
    }

    return 0;
}