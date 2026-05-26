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

class HuffmanDecompressor
{
private:
    unordered_map<string, char> D_map_public;

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

    string BWT_inverse(const string &data, int primary_index)
    {
        int n = data.length();
        if (n <= 1)
            return data;

        string first_col = data;
        sort(first_col.begin(), first_col.end());

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

        string original;
        int idx = primary_index;
        for (int i = 0; i < n; i++)
        {
            idx = next[idx];
            original += data[idx];
        }

        return original;
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

            for (int i = idx; i > 0; i--)
            {
                alphabet[i] = alphabet[i - 1];
            }
            alphabet[0] = c;
        }

        return decoded;
    }

public:
    void Decompress(const string &inp_Fname, const string &op_Fname)
    {
        ifstream input(inp_Fname, ios::binary);
        ofstream output(op_Fname, ios::binary);

        if (!input.is_open() || !output.is_open())
        {
            cerr << "Error: Unable to open files." << endl;
            return;
        }

        unsigned char flag;
        input.read((char *)&flag, 1);
        bool useBWT_MTF = (flag == 1);

        int uniqueChars, bwt_index;
        readHeader(input, uniqueChars, bwt_index);

        int extraBits;
        input.read((char *)&extraBits, sizeof(int));

        vector<unsigned char> encodedBytes;
        char byte;
        while (input.read(&byte, sizeof(char)))
        {
            encodedBytes.push_back(byte);
        }

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

private:
    void readHeader(istream &input, int &uniqueChars, int &bwt_index)
    {
        input.read((char *)&bwt_index, sizeof(int));
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
};



int main(int argc, char *argv[])
{
    if (argc != 3)
    {
        cout << "Usage: " << argv[0] << " <input_file.bin> <output_file.txt>" << endl;
        return 1;
    }

    string inputFile = argv[1];
    string outputFile = argv[2];

    HuffmanDecompressor decompressor;
    decompressor.Decompress(inputFile, outputFile);

    return 0;
}