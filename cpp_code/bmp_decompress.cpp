#include <iostream>
#include <fstream>
#include <vector>
#include <map>
#include <string>

using namespace std;

vector<unsigned char> RLEDecompress(vector<unsigned char> &data)
{
    vector<unsigned char> decompressed;
    for (size_t i = 0; i < data.size(); i = i + 2)
    {
        unsigned char val = data[i];
        unsigned char count = data[i + 1];
        for (int j = 0; j < count; j++)
            decompressed.push_back(val);
    }
    return decompressed;
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

    vector<unsigned char> compressedData;
    char byte;
    while (in.get(byte))
    {
        compressedData.push_back(byte);
    }
    in.close();

    string bitString;
    for (auto b : compressedData)
    {
        for (int i = 7; i >= 0; i--)
        {

            if ((b >> i) & 1)
            {
                bitString += '1';
            }
            else
            {
                bitString += '0';
            }
        }
    }

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

    vector<unsigned char> pixels = RLEDecompress(rleData);

    ofstream out(outputFile, ios::binary);
    out.write((char *)header.data(), 54);
    out.write((char *)pixels.data(), pixels.size());
    out.close();

    cout << "Decompression completed successfully" << endl;
    return 0;
}