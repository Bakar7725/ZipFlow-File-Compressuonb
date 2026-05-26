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

        if (a->freq > b->freq)
        {
            return true;
        }
        else if (a->freq < b->freq)
        {
            return false;
        }

        if (b->data == 0 && a->data != 0)
        {
            return true;
        }
        else
        {
            return false;
        }
    }
};

class HuffmanCompressor
{
private:
    unordered_map<char, string> E_map;
    unordered_map<string, char> D_map;

    string RLE_encode(const string &data)
    {
        string encoded;
        int n = data.length();
        int i = 0;

        while (i < n)
        {
            char current = data[i];
            int count = 1;

            while (i + count < n && data[i + count] == current && count < 255)
            {
                count++;
            }

            if (count >= 4)
            {
                encoded = encoded + '\xFE';
                encoded = encoded + (char)count;
                encoded = encoded + current;
            }
            else
            {
                for (int j = 0; j < count; j++)
                {
                    if (data[i + j] == '\xFE')
                    {
                        encoded = encoded + '\xFE';
                        encoded = encoded + '\x01';
                        encoded = encoded + '\xFE';
                    }
                    else
                    {
                        encoded = encoded + data[i + j];
                    }
                }
            }

            i += count;
        }

        return encoded;
    }

    string BWT_transform(const string &data, int &primary_index)
    {
        int n = data.length();
        if (n <= 1)
            return data;

        vector<string> rotations;
        for (int i = 0; i < n; i++)
        {
            string rotation = data.substr(i) + data.substr(0, i);
            rotations.push_back(rotation);
        }

        sort(rotations.begin(), rotations.end());

        string transformed;
        for (int i = 0; i < n; i++)
        {
            transformed += rotations[i].back();

            if (rotations[i] == data)
                primary_index = i;
        }

        return transformed;
    }

    string MTF_encode(const string &data)
    {
        vector<char> alphabet(256);
        for (int i = 0; i < 256; i++)
            alphabet[i] = (char)i;

        string encoded;
        for (char c : data)
        {
            int pos = 0;
            while (alphabet[pos] != c)
                pos++;

            encoded = encoded + (char)pos;

            for (int i = pos; i > 0; i--)
            {
                alphabet[i] = alphabet[i - 1];
            }
            alphabet[0] = c;
        }

        return encoded;
    }

public:
    unordered_map<char, string> E_map_public;
    unordered_map<string, char> D_map_public;

    void generateCodes(TreeNode *root, string code)
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
    void Compress(const string &inp_Fname, const string &op_Fname)
    {
        ifstream input(inp_Fname, ios::binary);
        ofstream output(op_Fname, ios::binary);

        if (!input.is_open() || !output.is_open())
        {
            cerr << "Error: Unable to open files." << endl;
            return;
        }

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

        const int SMALL_FILE_THRESHOLD = 100 * 1024;
        bool useBWT_MTF;

        if (originalSize < 100 * 1024)
        {
            useBWT_MTF = true;
        }
        else
        {
            useBWT_MTF = false;
        }
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

        processedData = RLE_encode(processedData);
        cout << "  RLE applied" << endl;

        unordered_map<char, int> freq;
        analyzeAndOptimize(processedData, freq);

        if (freq.size() <= 1)
        {
            cerr << "File too uniform for compression." << endl;
            return;
        }

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

        unsigned char flag = useBWT_MTF ? 1 : 0;
        output.put(flag);

        int uniqueChars = freq.size();
        writeHeader(output, uniqueChars, bwt_index);

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

        int extraBits = (bitPos == 7) ? 0 : bitPos + 1;
        if (extraBits != 8)
        {
            encodedBytes.push_back(currentByte);
        }

        output.write((char *)&extraBits, sizeof(int));
        output.write((char *)&encodedBytes[0], encodedBytes.size());

        output.close();
        input.close();

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

private:
    void analyzeAndOptimize(const string &data, unordered_map<char, int> &freq)
    {
        freq.clear();
        for (char ch : data)
        {
            freq[ch]++;
        }

        static const string common_chars = "etaoinshrdlcumwfgypbvkjxqzETAOINSHRDLCUMWFGYPBVKJXQZ0123456789 \n\t";
        for (char ch : common_chars)
        {
            if (freq.find(ch) != freq.end())
            {
                freq[ch] += 10;
            }
        }
    }
    void writeHeader(ostream &output, int uniqueChars, int bwt_index)
    {
        output.write((char *)&bwt_index, sizeof(int));
        output.write((char *)&uniqueChars, sizeof(int));

        for (auto &pair : E_map_public)
        {
            output.put(pair.first);
            string code = pair.second;
            unsigned char len = code.length();
            output.put(len);

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

            if (bit_count > 0)
            {
                output.put(current);
            }
        }
    }
};

int main(int argc, char *argv[])
{
    if (argc != 3)
    {
        cout << "Usage: " << argv[0] << " <input_file.txt> <output_file.bin>" << endl;
        return 1;
    }

    string inputFile = argv[1];
    string outputFile = argv[2];

    string extension = inputFile.substr(inputFile.find_last_of(".") + 1);
    transform(extension.begin(), extension.end(), extension.begin(), ::tolower);

    if (extension == "zip" || extension == "jpg" || extension == "png" ||
        extension == "mp3" || extension == "mp4" || extension == "pdf")
    {
        cout << "Warning: " << extension << " files are already compressed." << endl;
        cout << "Compression results may be poor." << endl;
    }

    HuffmanCompressor compressor;
    compressor.Compress(inputFile, outputFile);

    return 0;
}