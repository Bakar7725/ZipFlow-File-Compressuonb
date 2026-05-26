@echo off
echo Compiling C++ executables for ZipFlow Pro...
echo.

cd /d "%~dp0"

echo Compiling BMP compressor (bmp_compress.exe)...
g++ -o cpp_executables/bmp_compress.exe cpp_code/bmp_compress.cpp -std=c++11
if %errorlevel% equ 0 (
    echo [OK] bmp_compress.exe compiled successfully
) else (
    echo [ERROR] Failed to compile bmp_compress.exe
)

echo.
echo Compiling BMP decompressor (bmp_decompress.exe)...
g++ -o cpp_executables/bmp_decompress.exe cpp_code/bmp_decompress.cpp -std=c++11
if %errorlevel% equ 0 (
    echo [OK] bmp_decompress.exe compiled successfully
) else (
    echo [ERROR] Failed to compile bmp_decompress.exe
)

echo.
echo Compiling Text compressor (text_compress.exe)...
g++ -o cpp_executables/text_compress.exe cpp_code/text_compress.cpp -std=c++11
if %errorlevel% equ 0 (
    echo [OK] text_compress.exe compiled successfully
) else (
    echo [ERROR] Failed to compile text_compress.exe
)

echo.
echo Compiling Text decompressor (text_decompress.exe)...
g++ -o cpp_executables/text_decompress.exe cpp_code/text_decompress.cpp -std=c++11
if %errorlevel% equ 0 (
    echo [OK] text_decompress.exe compiled successfully
) else (
    echo [ERROR] Failed to compile text_decompress.exe
)

echo.
echo ========================================
echo Compilation completed!
echo Check cpp_executables/ folder for .exe files
echo ========================================
echo.
pause