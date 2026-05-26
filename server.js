// server.js - ZipFlow Pro Backend
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// --- Updated Middleware ---
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:3001',
    'https://unborne-unjarred-julee.ngrok-free.dev',
    'https://*.ngrok-free.dev'
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        if (allowedOrigins.some(allowedOrigin => {
            // Exact match
            if (allowedOrigin === origin) return true;
            // Wildcard match for ngrok
            if (allowedOrigin.includes('*')) {
                const regex = new RegExp(allowedOrigin.replace('*', '.*'));
                return regex.test(origin);
            }
            return false;
        })) {
            callback(null, true);
        } else {
            console.log('❌ CORS blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Session-Id', 'Range'],
    exposedHeaders: ['Content-Disposition', 'Content-Length', 'Content-Type'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
    maxAge: 86400 // 24 hours
}));

// Handle preflight requests for all routes
app.options('*', cors());

// Test download endpoint
app.get('/api/test-download', (req, res) => {
    const testFilePath = path.join(__dirname, 'uploads', 'test.txt');

    // Create a test file if it doesn't exist
    if (!fs.existsSync(testFilePath)) {
        fs.writeFileSync(testFilePath, 'This is a test file for download verification.');
    }

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename="test.txt"');
    res.sendFile(testFilePath);
});

// Force HTTPS in production/ngrok
app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] === 'http' && process.env.NODE_ENV === 'production') {
        return res.redirect(`https://${req.headers.host}${req.url}`);
    }
    next();
});

// Add request logging middleware
app.use((req, res, next) => {
    console.log(`📥 ${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
});
app.use(express.json());
app.use(express.static(__dirname));

// --- MySQL Connection ---
const db = mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "zipflow_pro",
});

// --- Connect to Database ---
db.connect((err) => {
    if (err) {
        console.error("❌ MySQL Connection Failed:", err);
        process.exit(1);
    } else {
        console.log("✅ Connected to MySQL Database: ZIPFLOW_PRO");
        checkAndCreateTables();
    }
});

// Function to check and create tables
function checkAndCreateTables() {
    console.log("📋 Checking and creating tables...");

    // Users table
    const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role ENUM('user', 'admin') DEFAULT 'user',
      compression_count INT DEFAULT 0,
      decompression_count INT DEFAULT 0,
      total_files_processed INT DEFAULT 0,
      total_size_saved BIGINT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_login TIMESTAMP NULL,
      INDEX idx_email (email)
    )
  `;

    // Guest sessions table
    const createGuestSessionsTable = `
    CREATE TABLE IF NOT EXISTS guest_sessions (
      id INT PRIMARY KEY AUTO_INCREMENT,
      session_id VARCHAR(255) UNIQUE NOT NULL,
      ip_address VARCHAR(45),
      compression_count INT DEFAULT 0,
      decompression_count INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_session (session_id),
      INDEX idx_ip (ip_address)
    )
  `;

    // File history table
    const createFileHistoryTable = `
    CREATE TABLE IF NOT EXISTS file_history (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NULL,
      session_id VARCHAR(255) NULL,
      operation_type ENUM('compress', 'decompress') NOT NULL,
      original_filename VARCHAR(255) NOT NULL,
      processed_filename VARCHAR(255) NOT NULL,
      original_size BIGINT NOT NULL,
      processed_size BIGINT NOT NULL,
      compression_ratio DECIMAL(5,2),
      file_type ENUM('image', 'text'),
      status ENUM('completed', 'failed') DEFAULT 'completed',
      download_url VARCHAR(500),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user (user_id),
      INDEX idx_session (session_id),
      INDEX idx_operation_type (operation_type),
      INDEX idx_created_at (created_at),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `;

    const tables = [
        { name: 'users', query: createUsersTable },
        { name: 'guest_sessions', query: createGuestSessionsTable },
        { name: 'file_history', query: createFileHistoryTable }
    ];

    let tablesCreated = 0;

    tables.forEach((table, index) => {
        db.query(table.query, (err, results) => {
            if (err) {
                console.error(`❌ Error creating ${table.name} table:`, err);
            } else {
                console.log(`✅ ${table.name} table checked/created successfully`);
            }

            tablesCreated++;

            if (tablesCreated === tables.length) {
                console.log("🎉 All tables created successfully!");
            }
        });
    });
}

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// Helper function to execute SQL queries with promises
const executeQuery = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.query(query, params, (err, results) => {
            if (err) {
                console.error('Database error:', err);
                reject(err);
            } else {
                resolve(results);
            }
        });
    });
};

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 }
});

// Create necessary directories
['uploads', 'compressed', 'decompressed', 'cpp_executables'].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Generate session ID for guests
const generateSessionId = () => {
    return 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

// Authentication Middleware
// Update authentication middleware to require login:
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                message: 'Please login to access this feature'
            });
        }

        // Verify JWT token
        const decoded = jwt.verify(token, JWT_SECRET);
        const [user] = await executeQuery(
            'SELECT id, name, email, role FROM users WHERE id = ?',
            [decoded.userId]
        );

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid token',
                message: 'User not found'
            });
        }

        req.user = user;
        next();

    } catch (error) {
        console.error('Authentication error:', error);

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                error: 'Invalid token',
                message: 'Please login again'
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Token expired',
                message: 'Your session has expired. Please login again.'
            });
        }

        res.status(401).json({
            success: false,
            error: 'Authentication failed',
            message: 'Please login to continue'
        });
    }
};




// =============== AUTHENTICATION ROUTES ===============

// Register endpoint
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        console.log('📝 Registration request:', { name, email });

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Check if user already exists
        const [existingUser] = await executeQuery(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const result = await executeQuery(
            'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
            [name, email, hashedPassword]
        );

        // Generate JWT token
        const token = jwt.sign(
            { userId: result.insertId, email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        console.log(`✅ User registered successfully: ${email}`);

        res.json({
            success: true,
            message: 'Registration successful',
            token,
            user: {
                id: result.insertId,
                name,
                email
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        console.log('🔐 Login request:', { email });

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user
        const [user] = await executeQuery(
            'SELECT id, name, email, password FROM users WHERE email = ?',
            [email]
        );

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update last login
        await executeQuery(
            'UPDATE users SET last_login = NOW() WHERE id = ?',
            [user.id]
        );

        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Get user stats
        const [stats] = await executeQuery(
            'SELECT compression_count, decompression_count, total_files_processed, total_size_saved FROM users WHERE id = ?',
            [user.id]
        );

        console.log(`✅ User logged in: ${email}`);

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                compression_count: stats.compression_count,
                decompression_count: stats.decompression_count,
                total_files_processed: stats.total_files_processed,
                total_size_saved: stats.total_size_saved
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user profile - IMPROVED VERSION
// Get user profile - UPDATED (NO GUEST)
app.get('/api/profile', authenticateToken, async (req, res) => {
    try {
        // Logged in user only
        const [user] = await executeQuery(
            'SELECT id, name, email, role, compression_count, decompression_count, total_files_processed, total_size_saved, created_at FROM users WHERE id = ?',
            [req.user.id]
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        console.log(`📊 Profile fetched for user: ${user.email}`);

        res.json({
            success: true,
            user
        });

    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// =============== FILE PROCESSING ROUTES ===============

// File compression endpoint
// File compression endpoint - LOGIN ONLY
app.post('/api/compress', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        console.log('🔄 Compression request received for user:', req.user.id, 'file:', req.file.originalname);

        const { fileType } = req.body;
        const inputFile = req.file.path;
        const originalName = req.file.originalname;
        const baseName = path.parse(originalName).name;

        let outputFile, executable;

        if (fileType === 'image') {
            outputFile = path.join('compressed', `${baseName}_compressed.dat`);
            executable = 'cpp_executables/bmp_compress.exe';
        } else {
            outputFile = path.join('compressed', `${baseName}_compressed.bin`);
            executable = 'cpp_executables/text_compress.exe';
        }

        // Check if executable exists
        if (!fs.existsSync(executable)) {
            console.error('Executable not found:', executable);
            fs.unlinkSync(inputFile);
            return res.status(500).json({
                error: 'Compression engine not available. Please compile C++ executables first.'
            });
        }

        // Check if output file already exists
        let counter = 1;
        let finalOutputFile = outputFile;
        while (fs.existsSync(finalOutputFile)) {
            if (fileType === 'image') {
                finalOutputFile = path.join('compressed', `${baseName}_compressed(${counter}).dat`);
            } else {
                finalOutputFile = path.join('compressed', `${baseName}_compressed(${counter}).bin`);
            }
            counter++;
        }

        // Execute C++ compression
        const command = `"${executable}" "${inputFile}" "${finalOutputFile}"`;

        exec(command, async (error, stdout, stderr) => {
            if (error) {
                console.error('Compression error:', stderr || error.message);
                fs.unlinkSync(inputFile);
                return res.status(500).json({
                    error: 'Compression failed. Please check if the file format is correct.'
                });
            }

            console.log('✅ Compression successful:', stdout);

            if (!fs.existsSync(finalOutputFile)) {
                return res.status(500).json({ error: 'Output file was not created' });
            }

            // Calculate statistics
            const originalSize = fs.statSync(inputFile).size;
            const compressedSize = fs.statSync(finalOutputFile).size;
            const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(2);

            // Clean up input file
            fs.unlinkSync(inputFile);

            const outputFilename = path.basename(finalOutputFile);

            // Save to history - USER ONLY, NO GUEST
            try {
                const historyData = {
                    user_id: req.user.id,  // ALWAYS has user_id (login required)
                    operation_type: 'compress',
                    original_filename: originalName,
                    processed_filename: outputFilename,
                    original_size: originalSize,
                    processed_size: compressedSize,
                    compression_ratio: compressionRatio,
                    file_type: fileType,
                    download_url: `/files/download/${outputFilename}`
                };

                await executeQuery(
                    'INSERT INTO file_history (user_id, operation_type, original_filename, processed_filename, original_size, processed_size, compression_ratio, file_type, download_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [
                        historyData.user_id,
                        historyData.operation_type,
                        historyData.original_filename,
                        historyData.processed_filename,
                        historyData.original_size,
                        historyData.processed_size,
                        historyData.compression_ratio,
                        historyData.file_type,
                        historyData.download_url
                    ]
                );

                // Update user counts ONLY
                await executeQuery(
                    'UPDATE users SET compression_count = compression_count + 1, total_files_processed = total_files_processed + 1, total_size_saved = total_size_saved + ? WHERE id = ?',
                    [originalSize - compressedSize, req.user.id]
                );

            } catch (dbError) {
                console.error('Database save error:', dbError);
                // Continue even if history save fails
            }

            const response = {
                success: true,
                filename: outputFilename,
                originalSize,
                compressedSize,
                compressionRatio,
                downloadUrl: `/files/download/${outputFilename}`,
                message: `Compressed successfully! Size reduced by ${compressionRatio}%`
                // REMOVED: requiresLogin, sessionId
            };

            console.log(`✅ File compressed by user ${req.user.id}: ${originalName} -> ${outputFilename}`);
            console.log(`🔗 Download URL: ${response.downloadUrl}`);
            res.json(response);
        });

    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// File decompression endpoint - LOGIN ONLY
app.post('/api/decompress', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        console.log('🔄 Decompression request received for user:', req.user.id, 'file:', req.file.originalname);

        const { fileType } = req.body;
        const inputFile = req.file.path;
        const originalName = req.file.originalname;
        const baseName = path.parse(originalName).name.replace('_compressed', '').replace('_decompressed', '');

        let outputFile, executable;

        if (fileType === 'image') {
            outputFile = path.join('decompressed', `${baseName}.bmp`);
            executable = 'cpp_executables/bmp_decompress.exe';
        } else {
            outputFile = path.join('decompressed', `${baseName}.txt`);
            executable = 'cpp_executables/text_decompress.exe';
        }

        // Check if executable exists
        if (!fs.existsSync(executable)) {
            console.error('Executable not found:', executable);
            fs.unlinkSync(inputFile);
            return res.status(500).json({
                error: 'Decompression engine not available.'
            });
        }

        // Check if output file already exists
        let counter = 1;
        let finalOutputFile = outputFile;
        while (fs.existsSync(finalOutputFile)) {
            const ext = path.extname(outputFile);
            const nameWithoutExt = path.parse(outputFile).name;
            finalOutputFile = path.join('decompressed', `${nameWithoutExt}(${counter})${ext}`);
            counter++;
        }

        // Execute C++ decompression
        const command = `"${executable}" "${inputFile}" "${finalOutputFile}"`;

        exec(command, async (error, stdout, stderr) => {
            if (error) {
                console.error('Decompression error:', stderr || error.message);
                fs.unlinkSync(inputFile);
                return res.status(500).json({
                    error: 'Decompression failed. Please check if the file format is correct.'
                });
            }

            console.log('✅ Decompression successful:', stdout);

            if (!fs.existsSync(finalOutputFile)) {
                return res.status(500).json({ error: 'Output file was not created' });
            }

            const compressedSize = fs.statSync(inputFile).size;
            const decompressedSize = fs.statSync(finalOutputFile).size;

            // Clean up input file
            fs.unlinkSync(inputFile);

            const outputFilename = path.basename(finalOutputFile);

            // Save to history - USER ONLY, NO GUEST
            try {
                const historyData = {
                    user_id: req.user.id,  // ALWAYS has user_id (login required)
                    operation_type: 'decompress',
                    original_filename: originalName,
                    processed_filename: outputFilename,
                    original_size: compressedSize,
                    processed_size: decompressedSize,
                    file_type: fileType,
                    download_url: `/files/download/${outputFilename}`
                };

                await executeQuery(
                    'INSERT INTO file_history (user_id, operation_type, original_filename, processed_filename, original_size, processed_size, file_type, download_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [
                        historyData.user_id,
                        historyData.operation_type,
                        historyData.original_filename,
                        historyData.processed_filename,
                        historyData.original_size,
                        historyData.processed_size,
                        historyData.file_type,
                        historyData.download_url
                    ]
                );

                // Update user counts ONLY
                await executeQuery(
                    'UPDATE users SET decompression_count = decompression_count + 1, total_files_processed = total_files_processed + 1 WHERE id = ?',
                    [req.user.id]
                );

            } catch (dbError) {
                console.error('Database save error:', dbError);
                // Continue even if history save fails
            }

            const response = {
                success: true,
                filename: outputFilename,
                compressedSize,
                decompressedSize,
                downloadUrl: `/files/download/${outputFilename}`,
                message: 'Decompressed successfully!'
                // REMOVED: requiresLogin, sessionId
            };

            console.log(`✅ File decompressed by user ${req.user.id}: ${originalName} -> ${outputFilename}`);
            res.json(response);
        });

    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Download proxy endpoint for better compatibility
app.get('/files/download/:filename', (req, res) => {
    const filename = req.params.filename;

    console.log(`🔗 Proxy download request: ${filename}`);

    // Determine which folder the file is in
    let filePath = path.join(__dirname, 'compressed', filename);
    let folder = 'compressed';

    if (!fs.existsSync(filePath)) {
        filePath = path.join(__dirname, 'decompressed', filename);
        folder = 'decompressed';

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                error: 'File not found',
                message: `The file "${filename}" was not found on the server.`
            });
        }
    }

    // Send file with proper headers
    res.download(filePath, filename, (err) => {
        if (err) {
            console.error('Proxy download error:', err);
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    error: 'Download failed',
                    message: 'Failed to download the file.'
                });
            }
        } else {
            console.log(`✅ Proxy download successful: ${filename} from ${folder}`);
        }
    });
});

// Get file history
// Get file history
app.get('/api/history', authenticateToken, async (req, res) => {
    try {
        const history = await executeQuery(
            'SELECT * FROM file_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
            [req.user.id]
        );

        // Format the response
        const formattedHistory = history.map(item => ({
            id: item.id,
            operationType: item.operation_type,
            originalFilename: item.original_filename,
            processedFilename: item.processed_filename,
            originalSize: item.original_size,
            processedSize: item.processed_size,
            compressionRatio: item.compression_ratio,
            fileType: item.file_type,
            status: item.status,
            downloadUrl: item.download_url,
            createdAt: item.created_at,
            readableDate: new Date(item.created_at).toLocaleString()
        }));

        console.log(`📜 History fetched for user ${req.user.id}: ${formattedHistory.length} records`);

        res.json({
            success: true,
            history: formattedHistory,
            count: formattedHistory.length
        });

    } catch (error) {
        console.error('History error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Clear history - UPDATED (NO GUEST)
app.delete('/api/history', authenticateToken, async (req, res) => {
    try {
        const result = await executeQuery(
            'DELETE FROM file_history WHERE user_id = ?',
            [req.user.id]
        );

        console.log(`🗑️ History cleared for user ${req.user.id}: ${result.affectedRows} records`);

        res.json({
            success: true,
            message: 'History cleared successfully'
        });

    } catch (error) {
        console.error('Clear history error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user statistics
app.get('/api/stats', authenticateToken, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Login required for statistics' });
        }

        const [userStats] = await executeQuery(
            'SELECT compression_count, decompression_count, total_files_processed, total_size_saved FROM users WHERE id = ?',
            [req.user.id]
        );

        // Get recent history count
        const [recentHistory] = await executeQuery(
            'SELECT COUNT(*) as count FROM file_history WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)',
            [req.user.id]
        );

        res.json({
            success: true,
            stats: {
                compressionCount: userStats.compression_count || 0,
                decompressionCount: userStats.decompression_count || 0,
                totalFilesProcessed: userStats.total_files_processed || 0,
                totalSizeSaved: formatBytes(userStats.total_size_saved || 0),
                recentActivity: recentHistory.count || 0
            }
        });

    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Helper function to format bytes
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Test endpoint
app.get('/api/test', (req, res) => {
    console.log('🧪 Test endpoint called');
    res.json({
        status: 'Server is running',
        endpoints: {
            register: 'POST /api/register',
            login: 'POST /api/login',
            profile: 'GET /api/profile',
            compress: 'POST /api/compress',
            decompress: 'POST /api/decompress',
            download: 'GET /files/download/:filename',
            history: 'GET /api/history',
            stats: 'GET /api/stats'
        }
    });
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        // Check database connection
        await executeQuery('SELECT 1');

        res.json({
            success: true,
            message: '✅ Server and database are running',
            database: 'CONNECTED',
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
        });

    } catch (error) {
        console.error('Health check error:', error);
        res.status(500).json({
            success: false,
            message: '❌ Database connection failed',
            database: 'DISCONNECTED'
        });
    }
});

// Handle 404 for API routes
app.use('/api/*', (req, res) => {
    console.log(`❌ API endpoint not found: ${req.originalUrl}`);
    res.status(404).json({ error: 'API endpoint not found' });
});

// Default route - serve index.html for all non-API routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(port, () => {
    console.log('='.repeat(50));
    console.log('🚀 ZipFlow Pro Server Started!');
    console.log('='.repeat(50));
    console.log(`Server: http://localhost:${port}`);
    console.log(`API Base: http://localhost:${port}/api`);
    console.log(`Database: ${process.env.DB_NAME || 'zipflow_pro'}`);
    console.log('\n📊 Endpoints:');
    console.log('  🔐 AUTHENTICATION:');
    console.log('    POST /api/register    - Register new user');
    console.log('    POST /api/login       - Login user');
    console.log('    GET  /api/profile     - Get user profile');
    console.log('  🗂️  FILE OPERATIONS:');
    console.log('    POST /api/compress    - Compress a file');
    console.log('    POST /api/decompress  - Decompress a file');
    console.log('    GET  /files/download/* - Download processed file');
    console.log('  📊 USER DATA:');
    console.log('    GET  /api/history     - Get file history');
    console.log('    GET  /api/stats       - Get user statistics');
    console.log('  🧪 UTILITIES:');
    console.log('    GET  /api/test        - Test server status');
    console.log('    GET  /api/health      - Health check');
    console.log('\n🔧 Guest Users: Limited to 1 operation');
    console.log('🔐 Registered Users: Unlimited operations');
    console.log('='.repeat(50));
});

