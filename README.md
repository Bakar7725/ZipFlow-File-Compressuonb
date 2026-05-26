# ZipFlow Pro - Advanced File Compression System

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-blue.svg)](https://mysql.com/)

ZipFlow Pro is a professional-grade file compression and decompression web application that combines a modern React-like frontend with a Node.js backend and high-performance C++ compression algorithms. Features user authentication, file history tracking, and real-time processing status.

## 📋 Table of Contents

- [Features](#-features)
- [Technology Stack](#-technology-stack)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Database Setup](#-database-setup)
- [C++ Compilation](#-c-compilation)
- [Running the Application](#-running-the-application)
- [API Endpoints](#-api-endpoints)
- [Project Structure](#-project-structure)
- [Security](#-security)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

## 🚀 Features

### Core Functionality
- **File Compression**: Compress BMP images and TXT files with high-efficiency algorithms
- **File Decompression**: Restore compressed .dat (images) and .bin (text) files
- **Real-time Progress**: Live upload and processing status with visual feedback
- **Drag & Drop Interface**: Intuitive file upload with drag-and-drop support

### User Management
- **User Authentication**: Secure JWT-based authentication system
- **User Registration**: Create accounts with bcrypt password hashing
- **Session Management**: Persistent login sessions with token storage
- **User Statistics**: Track compression/decompression counts and space saved

### File History
- **Operation Logging**: Automatic tracking of all compression/decompression operations
- **File Metadata**: Store original/processed sizes, compression ratios, timestamps
- **History Management**: View, refresh, and clear file processing history
- **Filtering**: Filter history by operation type and time period

### Security Features
- **JWT Authentication**: Secure token-based API authentication
- **Password Hashing**: bcrypt encryption for user passwords
- **CORS Protection**: Configurable cross-origin resource sharing
- **SQL Injection Prevention**: Parameterized database queries
- **HTTPS Support**: Production-ready with force HTTPS option

### User Interface
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Dark/Light Theme**: Toggle between light and dark color schemes
- **Animated UI**: Smooth animations and loading effects
- **Notification System**: Toast notifications for user actions
- **Progress Indicators**: Visual feedback for uploads and processing

## 🛠 Technology Stack

### Frontend
- HTML5/CSS3 with modern animations
- Vanilla JavaScript (ES6+)
- Font Awesome 6 icons
- Google Fonts (Poppins, Montserrat)

### Backend
- Node.js with Express.js
- MySQL2 database driver
- Multer for file uploads
- Bcrypt for password hashing
- JSON Web Tokens (JWT)
- Child process execution for C++ binaries

### Database
- MySQL 8.0+
- Tables: users, guest_sessions, file_history

### C++ Components
- BMP image compression/decompression
- Text file compression/decompression
- Custom binary formats (.dat for images, .bin for text)

## 📦 Prerequisites

Before installing ZipFlow Pro, ensure you have:

- **Node.js** (v18.x or higher)
- **MySQL** (v8.0 or higher)
- **GCC/G++ Compiler** (for C++ compilation)
  - Windows: MinGW or Visual Studio Build Tools
  - Linux: build-essential
  - macOS: Xcode Command Line Tools
- **Git** (for cloning the repository)

## 🔧 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/Bakar7725/ZipFlow-File-Compressuonb.git
cd ZipFlow-File-Compressuonb-main
npm install
node server.js Run
