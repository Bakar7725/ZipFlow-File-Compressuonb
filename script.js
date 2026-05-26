// Add at the top of your script.js
let currentUser = null;
let currentSessionId = localStorage.getItem('sessionId') || null;
let userToken = localStorage.getItem('token') || null;

// Update API_BASE_URL to use ngrok when available
// In script.js, change the API_BASE_URL (around line 6):
const API_BASE_URL = window.location.origin + '/api';
console.log('🌐 API Base URL:', API_BASE_URL);

function createNotificationContainer() {
    let container = document.getElementById('notificationContainer');
    if (!container) {
        container = document.createElement('div');
        container.className = 'notification-container';
        container.id = 'notificationContainer';
        document.body.appendChild(container);
    }
    return container;
}
// Update the showSuccessWithDownload function to work with ngrok
function showSuccessWithDownload(result, operation) {
    const container = createNotificationContainer();

    // FIX: Get the download URL properly for both localhost and ngrok
    let downloadUrl = result.downloadUrl;

    if (!downloadUrl) {
        // If no downloadUrl in result, construct it
        downloadUrl = `${API_BASE_URL}/download/${result.filename}`;
    } else if (downloadUrl.startsWith('http://localhost:3000')) {
        // If it's localhost but we're on ngrok, replace it
        const currentOrigin = window.location.origin;
        downloadUrl = downloadUrl.replace('http://localhost:3000', currentOrigin);
    }

    // Log for debugging
    console.log('🔗 Download URL:', downloadUrl);
    console.log('📊 Result object:', result);
    console.log('🌐 Current origin:', window.location.origin);

    // Create a unique ID for the download link
    const downloadId = 'download_' + Date.now();

    const notification = document.createElement('div');
    notification.className = 'notification success';
    notification.innerHTML = `
        <div class="notification-icon">
            <i class="fas fa-check-circle"></i>
        </div>
        <div class="notification-content">
            <div style="font-weight: 600; margin-bottom: 5px;">
                ${result.message || `${operation} successfully!`}
            </div>
            <div style="font-size: 0.9rem; color: var(--gray-medium); margin-bottom: 8px;">
                ${result.filename}
            </div>
            ${result.compressionRatio ? `
                <div style="font-size: 0.85rem; margin-bottom: 10px; padding: 5px; background: rgba(76, 175, 80, 0.1); border-radius: 5px;">
                    <i class="fas fa-chart-line"></i> Size reduced by <strong>${result.compressionRatio}%</strong>
                </div>
            ` : ''}
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button class="btn btn-primary btn-sm" id="${downloadId}">
                    <i class="fas fa-download"></i> Download ${result.filename}
                </button>
                <button class="btn btn-outline btn-sm" onclick="copyToClipboard('${downloadUrl}')">
                    <i class="fas fa-copy"></i> Copy Link
                </button>
            </div>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 10);

    // Add event listener for the download button
    setTimeout(() => {
        const downloadBtn = document.getElementById(downloadId);
        if (downloadBtn) {
            downloadBtn.addEventListener('click', function () {
                triggerDownload(downloadUrl, result.filename);
            });
        }
    }, 100);

    // Auto remove after 15 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }
    }, 15000);
}

// Helper function to trigger download safely
// Helper function to trigger download safely - UPDATED VERSION
// Updated triggerDownload function with multiple fallbacks
function triggerDownload(url, filename) {
    console.log('🚀 Attempting download:', { url, filename });

    // Method 1: Try direct link first
    const directUrl = url.includes('localhost') ? url : `/files/download/${filename}`;

    // Create temporary link element
    const link = document.createElement('a');
    link.href = directUrl;
    link.download = filename;

    // For Safari and iOS
    if (/(iP|iP|iP)/.test(navigator.userAgent)) {
        // iOS Safari doesn't support download attribute well
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
    }

    document.body.appendChild(link);

    // Try to click with mouse event for better compatibility
    const clickEvent = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: false
    });

    link.dispatchEvent(clickEvent);

    // Clean up
    setTimeout(() => {
        if (link.parentNode) {
            document.body.removeChild(link);
        }
    }, 5000); // Give it time before removing


}
// Add helper function for copying to clipboard
window.copyToClipboard = function (text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('Download link copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Failed to copy:', err);
        showNotification('Failed to copy link', 'error');
    });
};
// Initialize user session
async function initializeUserSession() {
    userToken = localStorage.getItem('token');
    currentSessionId = localStorage.getItem('sessionId');

    console.log('🔍 Initializing session:', {
        hasToken: !!userToken,
        hasSessionId: !!currentSessionId
    });

    if (userToken) {
        try {
            // Verify token and get user info
            const response = await fetch(`${API_BASE_URL}/profile`, {
                headers: {
                    'Authorization': `Bearer ${userToken}`,
                    'Cache-Control': 'no-cache'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    currentUser = data.user;
                    console.log('✅ User restored from token:', currentUser.email);
                    updateUIForLoggedInUser();
                    loadUserHistory();
                    return true;
                }
            }

            // If token is invalid or expired
            console.log('❌ Token invalid or expired');
            localStorage.removeItem('token');
            userToken = null;

        } catch (error) {
            console.error('❌ Session initialization error:', error);
            localStorage.removeItem('token');
            userToken = null;
        }
    }

    // If no valid token, check for guest session
    if (!currentSessionId) {
        currentSessionId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('sessionId', currentSessionId);
        console.log('👤 Created new guest session:', currentSessionId);
    } else {
        console.log('👤 Restored guest session:', currentSessionId);
    }

    updateUIForGuest();
    return false;
}

// Update UI based on authentication state
function updateUIForLoggedInUser() {
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');

    if (loginBtn) loginBtn.style.display = 'none';
    if (registerBtn) registerBtn.style.display = 'none';

    console.log('👤 Updating UI for logged in user:', currentUser.name);

    // Create user menu if it doesn't exist
    const headerControls = document.querySelector('.header-controls');
    let userMenu = document.getElementById('userMenu');

    if (!userMenu) {
        userMenu = document.createElement('div');
        userMenu.className = 'user-menu';
        userMenu.id = 'userMenu';
        userMenu.innerHTML = `
            <div class="user-avatar">
                <i class="fas fa-user-circle"></i>
            </div>
            <div class="user-info">
                <span class="user-name">${currentUser.name}</span>
                <div class="user-stats">
                    <span class="stat"><i class="fas fa-compress-alt"></i> ${currentUser.compression_count || 0}</span>
                    <span class="stat"><i class="fas fa-expand-alt"></i> ${currentUser.decompression_count || 0}</span>
                </div>
            </div>
            <div class="user-dropdown">
                
                <a href="#" id="viewHistory"><i class="fas fa-history"></i> History</a>
                <a href="#" id="viewStats"><i class="fas fa-chart-bar"></i> Statistics</a>
                <a href="#" id="logoutBtn"><i class="fas fa-sign-out-alt"></i> Logout</a>
            </div>
        `;
        headerControls.appendChild(userMenu);

        // Add event listeners
        setTimeout(() => {
            document.getElementById('logoutBtn')?.addEventListener('click', logout);
            document.getElementById('viewProfile')?.addEventListener('click', showUserProfile);
            document.getElementById('viewHistory')?.addEventListener('click', () => {
                document.getElementById('navHistory').click();
                loadUserHistory();
            });
            document.getElementById('viewStats')?.addEventListener('click', showUserStats);
        }, 100);
    }
}

function updateUIForGuest() {
    document.getElementById('loginBtn').style.display = 'inline-block';
    document.getElementById('registerBtn').style.display = 'inline-block';

    const userMenu = document.getElementById('userMenu');
    if (userMenu) {
        userMenu.remove();
    }
}

// Login function
// Login function - UPDATED WITH BETTER DEBUGGING
async function login(email, password) {
    try {
        console.log('🔐 Login attempt:', { email, API_BASE_URL });

        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        console.log('📥 Login response status:', response.status);
        console.log('📥 Login response headers:', response.headers);

        const data = await response.json();
        console.log('📥 Login response data:', data);

        if (data.success) {
            userToken = data.token;
            currentUser = data.user;
            localStorage.setItem('token', userToken);
            localStorage.removeItem('sessionId');
            currentSessionId = null;

            console.log('✅ Login successful:', currentUser.name);
            console.log('📝 Token saved:', userToken);

            updateUIForLoggedInUser();
            loadUserHistory();
            showNotification('Login successful!', 'success');
            return true;
        } else {
            console.log('❌ Login failed:', data.error);
            showNotification(data.error || 'Login failed', 'error');
            return false;
        }
    } catch (error) {
        console.error('❌ Login error:', error);
        showNotification('Login failed. Please try again.', 'error');
        return false;
    }
}

// Register function
// Register function - UPDATED VERSION
async function register(name, email, password) {
    try {
        const response = await fetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();

        if (data.success) {
            // DON'T automatically log in - just show success message
            showNotification('Registration successful! You can now login with your credentials.', 'success');

            // Clear the form
            document.getElementById('registerForm').reset();

            // Switch to login modal instead of closing
            setTimeout(() => {
                document.getElementById('registerModal').classList.remove('active');
                document.getElementById('loginModal').classList.add('active');
            }, 1500);

            return true;
        } else {
            showNotification(data.error || 'Registration failed', 'error');
            return false;
        }
    } catch (error) {
        console.error('Registration error:', error);
        showNotification('Registration failed. Please try again.', 'error');
        return false;
    }
}

// Logout function
function logout() {
    console.log('👋 Logging out user:', currentUser?.email);

    userToken = null;
    currentUser = null;

    // Clear localStorage
    localStorage.removeItem('token');

    // Create new guest session
    currentSessionId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('sessionId', currentSessionId);

    // Update UI
    updateUIForGuest();

    // Clear history container
    const historyContainer = document.getElementById('historyContainer');
    if (historyContainer) {
        historyContainer.innerHTML = `
            <div class="no-history">
                <i class="fas fa-history" style="font-size: 4rem; color: var(--gray-light); margin-bottom: 20px;"></i>
                <h3>No History Yet</h3>
                <p>Your file processing history will appear here.</p>
            </div>
        `;
    }

    showNotification('Logged out successfully', 'info');
}

// Update the processWithBackend function to include authentication
async function processWithBackend(isDecompressMode, files, fileType, processButton, progressBar, fileInput) {
    const originalText = processButton.innerHTML;
    const operationType = isDecompressMode ? 'Decompressing' : 'Compressing';

    // Show initial processing state
    processButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Starting...`;
    processButton.disabled = true;

    // Show progress bar
    progressBar.style.width = '0%';
    progressBar.textContent = '0%';
    progressBar.className = 'progress-bar';
    progressBar.classList.add(isDecompressMode ? 'decompress-progress' : 'compress-progress');
    progressBar.style.display = 'block';

    try {
        const formData = new FormData();
        formData.append('file', files[0]);
        formData.append('fileType', fileType);

        const endpoint = isDecompressMode ? '/decompress' : '/compress';

        // REQUIRE LOGIN - REMOVE GUEST HEADERS
        if (!userToken) {
            showNotification('Please login to use compression/decompression features', 'warning');
            setTimeout(() => {
                document.getElementById('loginBtn').click();
            }, 1000);
            return;
        }


        const headers = {
            'Authorization': `Bearer ${userToken}`
        };
        if (userToken) {
            headers['Authorization'] = `Bearer ${userToken}`;
        } else if (currentSessionId) {
            headers['X-Session-Id'] = currentSessionId;
        }

        console.log('📤 Starting upload...');

        // Step 1: Show upload progress
        progressBar.textContent = 'Uploading...';
        processButton.innerHTML = `<i class="fas fa-upload"></i> Uploading...`;

        // Create XMLHttpRequest for upload progress tracking
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            let lastUploadPercent = 0;
            let serverStartedProcessing = false;
            let processingInterval = null;

            // Track upload progress
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const uploadPercent = Math.round((e.loaded / e.total) * 100);
                    lastUploadPercent = uploadPercent;

                    // Always show the actual upload percentage (0-100%)
                    progressBar.style.width = `${uploadPercent}%`;
                    progressBar.textContent = `Uploading ${uploadPercent}%`;

                    // Update button text
                    processButton.innerHTML = `<i class="fas fa-upload"></i> Uploading ${uploadPercent}%`;

                    // When upload reaches 100%, show "Transfer Complete"
                    if (uploadPercent >= 100 && !serverStartedProcessing) {
                        progressBar.textContent = 'Transfer Complete';
                        processButton.innerHTML = `<i class="fas fa-check"></i> Transfer Complete`;

                        // Start pulsing animation while waiting for server
                        progressBar.style.animation = 'pulse 2s infinite';
                    }
                }
            });

            // Track request state changes
            xhr.addEventListener('readystatechange', function () {
                // When server starts processing (readyState 3: LOADING)
                if (xhr.readyState === 3 && !serverStartedProcessing) {
                    serverStartedProcessing = true;

                    // Remove pulsing animation
                    progressBar.style.animation = 'none';

                    // Show 100% and "Processing"
                    progressBar.style.width = '100%';
                    progressBar.textContent = 'Processing...';
                    processButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${operationType}...`;

                    console.log('⚙️ Server started processing');
                }
            });

            // When response is fully received
            xhr.addEventListener('load', function () {
                // Clear any processing interval
                if (processingInterval) {
                    clearInterval(processingInterval);
                }

                if (this.status >= 200 && this.status < 300) {
                    try {
                        const result = JSON.parse(this.responseText);

                        if (result.success) {
                            // If server hasn't shown as processing yet, show it now
                            if (!serverStartedProcessing) {
                                progressBar.textContent = 'Processing...';
                                processButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${operationType}...`;
                                serverStartedProcessing = true;
                            }

                            // Simulate processing progress (2-4 seconds)
                            let processingProgress = 0;
                            const processingTime = 2000 + Math.random() * 2000; // 2-4 seconds

                            processingInterval = setInterval(() => {
                                processingProgress += 1;
                                if (processingProgress > 99) processingProgress = 99;

                                progressBar.style.width = `${processingProgress}%`;
                                progressBar.textContent = `${operationType} ${processingProgress}%`;

                                // When processing is "complete"
                                if (processingProgress >= 99) {
                                    clearInterval(processingInterval);

                                    // Show completion
                                    progressBar.style.width = '100%';
                                    progressBar.textContent = 'Complete!';
                                    processButton.innerHTML = `<i class="fas fa-check-circle"></i> Complete!`;

                                    // Save session ID if returned
                                    if (result.sessionId) {
                                        currentSessionId = result.sessionId;
                                        localStorage.setItem('sessionId', currentSessionId);
                                    }

                                    // Show success with download
                                    const operation = isDecompressMode ? 'Decompressed' : 'Compressed';
                                    showSuccessWithDownload(result, operation);

                                    // Check if login is required
                                    if (result.requiresLogin) {
                                        showLoginPrompt();
                                    }

                                    // Refresh history
                                    loadUserHistory();

                                    // Reset UI after success
                                    setTimeout(() => {
                                        processButton.disabled = false;
                                        processButton.innerHTML = originalText;
                                        progressBar.style.width = '0%';
                                        progressBar.textContent = '';
                                        progressBar.style.display = 'none';
                                        progressBar.style.animation = '';

                                        // Clear file selection
                                        fileInput.value = '';
                                        resetDropZone();
                                    }, 2000);

                                    resolve(result);
                                }
                            }, processingTime / 100); // Divide time by 100 steps

                        } else {
                            // Check if it's a limit reached error
                            if (result.requiresLogin) {
                                showLoginPrompt();
                                throw new Error('Guest limit reached. Please login to continue.');
                            } else {
                                throw new Error(result.error || result.details || 'Processing failed');
                            }
                        }
                    } catch (parseError) {
                        console.error('Response parse error:', parseError);
                        showNotification('Server response error', 'error');
                        reject(parseError);
                    }
                } else {
                    const error = new Error(`Server error: ${this.status}`);
                    showNotification(`Server error: ${this.status}`, 'error');
                    reject(error);
                }
            });

            // Handle errors
            xhr.addEventListener('error', function () {
                if (processingInterval) {
                    clearInterval(processingInterval);
                }
                showNotification('Network error. Please check your connection.', 'error');
                reject(new Error('Network error'));
            });

            // Handle timeout
            xhr.addEventListener('timeout', function () {
                if (processingInterval) {
                    clearInterval(processingInterval);
                }
                showNotification('Request timeout. Please try again.', 'error');
                reject(new Error('Request timeout'));
            });

            // Open and send request
            xhr.open('POST', `${API_BASE_URL}${endpoint}`);

            // Set headers
            Object.keys(headers).forEach(key => {
                xhr.setRequestHeader(key, headers[key]);
            });

            // Set timeout
            xhr.timeout = 300000; // 5 minutes timeout

            // Send form data
            xhr.send(formData);
        });

    } catch (error) {
        console.error('Processing error:', error);
        showNotification(`Error: ${error.message}`, 'error');

        // Show error in progress bar
        progressBar.style.background = 'var(--error-color)';
        progressBar.textContent = 'Failed';

        // Reset UI
        setTimeout(() => {
            processButton.disabled = false;
            processButton.innerHTML = originalText;
            progressBar.style.width = '0%';
            progressBar.textContent = '';
            progressBar.style.display = 'none';
        }, 1500);
    }
}

// Show login prompt modal
function showLoginPrompt() {
    const loginPrompt = document.createElement('div');
    loginPrompt.className = 'login-prompt-modal';
    loginPrompt.innerHTML = `
        <div class="login-prompt-container">
            <div class="login-prompt-header">
                <i class="fas fa-lock" style="font-size: 3rem; color: var(--primary-color); margin-bottom: 20px;"></i>
                <h3 style="margin-bottom: 10px; color: var(--dark-color);">Limit Reached</h3>
                <p style="color: var(--gray-medium); margin-bottom: 25px;">
                    You've reached the limit for guest users. Register or login to continue compressing files.
                </p>
            </div>
            <div class="login-prompt-actions">
                <button class="btn btn-primary" id="promptLoginBtn" style="flex: 1;">
                    <i class="fas fa-sign-in-alt"></i> Login
                </button>
                <button class="btn btn-secondary" id="promptRegisterBtn" style="flex: 1;">
                    <i class="fas fa-user-plus"></i> Register
                </button>
                <button class="btn btn-outline" id="closePromptBtn">
                    <i class="fas fa-times"></i> Close
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(loginPrompt);

    // Add event listeners
    document.getElementById('promptLoginBtn').addEventListener('click', () => {
        loginPrompt.remove();
        document.getElementById('loginBtn').click();
    });

    document.getElementById('promptRegisterBtn').addEventListener('click', () => {
        loginPrompt.remove();
        document.getElementById('registerBtn').click();
    });

    document.getElementById('closePromptBtn').addEventListener('click', () => {
        loginPrompt.remove();
    });
}

// Load user history from database
async function loadUserHistory() {
    try {
        const headers = {};
        if (userToken) {
            headers['Authorization'] = `Bearer ${userToken}`;
        } else if (currentSessionId) {
            headers['X-Session-Id'] = currentSessionId;
        } else {
            return;
        }

        const response = await fetch(`${API_BASE_URL}/history`, {
            headers: headers
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success && data.history) {
                displayHistoryFromDatabase(data.history);
            }
        }
    } catch (error) {
        console.error('Error loading history:', error);
    }
}

// Display history from database
function displayHistoryFromDatabase(history) {
    const container = document.getElementById('historyContainer');

    if (!history || history.length === 0) {
        container.innerHTML = `
            <div class="no-history">
                <i class="fas fa-history" style="font-size: 4rem; color: var(--gray-light); margin-bottom: 20px;"></i>
                <h3>No History Yet</h3>
                <p>Your file processing history will appear here.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = history.map((item, index) => `
        <div class="history-item ${item.operationType} animate-on-scroll" 
             style="animation-delay: ${index * 0.1}s" 
             data-id="${item.id}">
            <div class="history-item-header">
                <div class="history-icon">
                    <i class="fas fa-${item.operationType === 'compress' ? 'compress-alt' : 'expand-alt'}"></i>
                </div>
                <div class="history-info">
                    <h4>${item.originalFilename}</h4>
                    <div class="history-meta">
                        <span class="history-operation ${item.operationType}">${item.operationType}</span>
                        <span class="history-time">${formatTime(new Date(item.createdAt))}</span>
                        <span class="history-status ${item.status}">${item.status}</span>
                    </div>
                </div>
            </div>
            <div class="history-stats">
                <div class="history-stat">
                    <div class="stat-label">Original Size</div>
                    <div class="stat-value">${formatBytes(item.originalSize)}</div>
                </div>
                <div class="history-stat">
                    <div class="stat-label">Processed Size</div>
                    <div class="stat-value">${item.processedSize ? formatBytes(item.processedSize) : '--'}</div>
                </div>
                ${item.compressionRatio ? `
                <div class="history-stat">
                    <div class="stat-label">Ratio</div>
                    <div class="stat-value">${item.compressionRatio}%</div>
                </div>
                ` : ''}
            </div>
            <div class="history-actions">
              ${item.downloadUrl ? `
    <button class="btn btn-outline btn-sm" onclick="triggerDownload('/download/${item.processedFilename}', '${item.processedFilename}')">
        <i class="fas fa-download"></i> Download
    </button>
` : ''}
                <button class="btn btn-outline btn-sm" onclick="showFileDetails(${item.id})">
                    <i class="fas fa-info-circle"></i> Details
                </button>
            </div>
        </div>
    `).join('');
}

// Update the showSuccessWithDownload function to work with ngrok


// Add helper function for copying to clipboard
window.copyToClipboard = function (text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('Download link copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Failed to copy:', err);
        showNotification('Failed to copy link', 'error');
    });
};

// Update auth modal handlers
document.addEventListener('DOMContentLoaded', function () {
    // Initialize user session
    initializeUserSession();

    // Update auth form handlers
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = e.target.querySelector('input[type="email"]').value;
        const password = e.target.querySelector('input[type="password"]').value;

        console.log('🔐 Attempting login for:', email);

        const success = await login(email, password);
        if (success) {
            console.log('✅ Login successful, closing modal');
            document.getElementById('loginModal').classList.remove('active');
            document.body.style.overflow = '';
            e.target.reset();

            // Force UI update
            updateUIForLoggedInUser();

            // Show welcome message
            showNotification(`Welcome back, ${currentUser.name}!`, 'success');
        }
    });

    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = e.target.querySelector('input[type="text"]').value;
        const email = e.target.querySelector('input[type="email"]').value;
        const password = e.target.querySelector('input[type="password"]').value;
        const confirmPassword = e.target.querySelectorAll('input[type="password"]')[1].value;

        if (password !== confirmPassword) {
            showNotification('Passwords do not match', 'error');
            return;
        }

        // Optional: Add validation
        if (password.length < 6) {
            showNotification('Password must be at least 6 characters', 'error');
            return;
        }

        if (!validateEmail(email)) {
            showNotification('Please enter a valid email address', 'error');
            return;
        }

        const success = await register(name, email, password);
        // Don't close modal here - let the register function handle it
    });

    // Helper function for email validation
    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    // Update history refresh button
    document.getElementById('refreshHistory').addEventListener('click', () => {
        loadUserHistory();
        showNotification('History refreshed!', 'info');
    });

    // Update clear history button
    document.getElementById('clearHistory').addEventListener('click', async () => {
        if (confirm('Are you sure you want to clear all history? This action cannot be undone.')) {
            try {
                const headers = {};
                if (userToken) {
                    headers['Authorization'] = `Bearer ${userToken}`;
                } else if (currentSessionId) {
                    headers['X-Session-Id'] = currentSessionId;
                }

                const response = await fetch(`${API_BASE_URL}/history`, {
                    method: 'DELETE',
                    headers: headers
                });

                const data = await response.json();

                if (data.success) {
                    loadUserHistory();
                    showNotification('History cleared successfully!', 'success');
                } else {
                    showNotification('Failed to clear history', 'error');
                }
            } catch (error) {
                console.error('Clear history error:', error);
                showNotification('Failed to clear history', 'error');
            }
        }
    });
});
// Listen for storage changes (in case user logs in/out from another tab)
window.addEventListener('storage', (event) => {
    console.log('📦 Storage changed:', event.key);

    if (event.key === 'token') {
        if (event.newValue) {
            // Token was added
            userToken = event.newValue;
            initializeUserSession();
        } else {
            // Token was removed (logout)
            userToken = null;
            currentUser = null;
            updateUIForGuest();
        }
    }
});


document.addEventListener('DOMContentLoaded', async function () {
    console.log('🚀 Page loaded, initializing...');

    // === VARIABLE DECLARATIONS ===
    const tabButtons = document.querySelectorAll('.tab-btn');
    const processorContainer = document.querySelector('.processor-container');
    const dropZoneTitle = document.getElementById('dropZoneTitle');
    const dropZoneSubtitle = document.getElementById('dropZoneSubtitle');
    const browseFilesBtn = document.getElementById('browseFiles');
    const processButton = document.getElementById('processFiles');
    const processButtonText = document.getElementById('processButtonText');
    const fileTypeSelect = document.getElementById('fileType');
    const fileTypeTitle = document.getElementById('fileTypeTitle');
    const fileTypeBox = document.getElementById('fileTypeBox');
    const outputFormatBox = document.getElementById('outputFormatBox');
    const compressionInfo = document.getElementById('compressionInfo');
    const fileInput = document.getElementById('fileInput');
    const dropZone = document.getElementById('dropZone');
    const progressBar = document.getElementById('progressBar');
    const themeToggle = document.getElementById('themeToggle');

    // API Configuration
    const API_BASE_URL = window.location.origin + '/api';
    console.log('🌐 API Base URL:', API_BASE_URL);

    // Initialize user session FIRST
    console.log('🔍 Initializing user session...');
    await initializeUserSession();

    // Debug: Log current state
    console.log('📊 Session initialized:', {
        currentUser,
        userToken: userToken ? 'Token present' : 'No token',
        currentSessionId
    });

    // === AUTH MODALS SETUP ===
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    const closeLogin = document.getElementById('closeLogin');
    const closeRegister = document.getElementById('closeRegister');
    const showRegister = document.getElementById('showRegister');
    const showLogin = document.getElementById('showLogin');

    // Modal open/close handlers
    if (loginBtn) {
        console.log('✅ Login button found');
        loginBtn.addEventListener('click', () => {
            console.log('🔄 Opening login modal');
            loginModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    } else {
        console.warn('⚠️ Login button not found!');
    }

    if (registerBtn) {
        console.log('✅ Register button found');
        registerBtn.addEventListener('click', () => {
            console.log('🔄 Opening register modal');
            registerModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    }

    if (closeLogin) {
        closeLogin.addEventListener('click', () => {
            loginModal.classList.remove('active');
            document.body.style.overflow = '';
        });
    }

    if (closeRegister) {
        closeRegister.addEventListener('click', () => {
            registerModal.classList.remove('active');
            document.body.style.overflow = '';
        });
    }

    if (showRegister) {
        showRegister.addEventListener('click', (e) => {
            e.preventDefault();
            loginModal.classList.remove('active');
            registerModal.classList.add('active');
        });
    }

    if (showLogin) {
        showLogin.addEventListener('click', (e) => {
            e.preventDefault();
            registerModal.classList.remove('active');
            loginModal.classList.add('active');
        });
    }

    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === loginModal) {
            loginModal.classList.remove('active');
            document.body.style.overflow = '';
        }
        if (e.target === registerModal) {
            registerModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    });

    // === LOGIN FORM HANDLER ===
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        console.log('✅ Login form found, attaching handler');

        // Remove any existing event listeners first
        loginForm.replaceWith(loginForm.cloneNode(true));
        const newLoginForm = document.getElementById('loginForm');

        // Clear error messages when user starts typing
        document.getElementById('loginEmail').addEventListener('input', () => {
            hideError('loginEmailError');
            hideError('loginGeneralError');
        });

        document.getElementById('loginPassword').addEventListener('input', () => {
            hideError('loginPasswordError');
            hideError('loginGeneralError');
        });

        newLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('🔐 Login form submitted');

            // Reset all error messages
            hideAllLoginErrors();

            const email = e.target.querySelector('#loginEmail').value.trim();
            const password = e.target.querySelector('#loginPassword').value.trim();

            let hasError = false;

            // Email validation
            if (!email) {
                showError('loginEmailError', 'Email is required');
                hasError = true;
            } else if (!validateEmail(email)) {
                showError('loginEmailError', 'Please enter a valid email address');
                hasError = true;
            }

            // Password validation
            if (!password) {
                showError('loginPasswordError', 'Password is required');
                hasError = true;
            } else if (password.length < 6) {
                showError('loginPasswordError', 'Password must be at least 6 characters');
                hasError = true;
            }

            if (hasError) {
                return;
            }

            console.log('🔐 Attempting login for:', email);

            // Show loading state
            const submitBtn = e.target.querySelector('#loginSubmitBtn');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Signing in...`;
            submitBtn.disabled = true;

            const success = await login(email, password);

            // Reset button
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;

            if (success) {
                console.log('✅ Login successful, closing modal');
                loginModal.classList.remove('active');
                document.body.style.overflow = '';
                newLoginForm.reset();
                hideAllLoginErrors();

                // Force UI update
                updateUIForLoggedInUser();

                // Show welcome message
                showNotification(`Welcome back, ${currentUser.name}!`, 'success');
            } else {
                // Show error message in the form
                showError('loginGeneralError', 'Invalid email or password. Please try again.');

                // Shake animation for error
                const form = document.getElementById('loginForm');
                form.classList.add('shake');
                setTimeout(() => form.classList.remove('shake'), 500);
            }
        });
    } else {
        console.warn('⚠️ Login form not found!');
    }

    // Helper functions for error handling
    function showError(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = message;
            element.style.display = 'block';

            // Add red border to input
            const inputId = elementId.replace('Error', '');
            const input = document.getElementById(inputId);
            if (input) {
                input.style.borderColor = '#ff4444';
                input.style.boxShadow = '0 0 0 2px rgba(255, 68, 68, 0.1)';
            }
        }
    }

    function hideError(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.style.display = 'none';

            // Reset input border
            const inputId = elementId.replace('Error', '');
            const input = document.getElementById(inputId);
            if (input) {
                input.style.borderColor = 'var(--gray-light)';
                input.style.boxShadow = 'none';
            }
        }
    }

    function hideAllLoginErrors() {
        hideError('loginEmailError');
        hideError('loginPasswordError');
        hideError('loginGeneralError');
    }

    function hideAllRegisterErrors() {
        hideError('registerNameError');
        hideError('registerEmailError');
        hideError('registerPasswordError');
        hideError('registerConfirmPasswordError');
        hideError('registerGeneralError');
    }

    // Also update the register form handler similarly:

    // === REGISTER FORM HANDLER ===
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        console.log('✅ Register form found, attaching handler');

        // Clear error messages when typing
        ['registerName', 'registerEmail', 'registerPassword', 'registerConfirmPassword'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', () => {
                hideError(id + 'Error');
                hideError('registerGeneralError');
            });
        });

        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('📝 Register form submitted');

            // Reset all error messages
            hideAllRegisterErrors();

            const name = e.target.querySelector('#registerName').value.trim();
            const email = e.target.querySelector('#registerEmail').value.trim();
            const password = e.target.querySelector('#registerPassword').value.trim();
            const confirmPassword = e.target.querySelector('#registerConfirmPassword').value.trim();

            let hasError = false;

            // Validation
            if (!name) {
                showError('registerNameError', 'Name is required');
                hasError = true;
            }

            if (!email) {
                showError('registerEmailError', 'Email is required');
                hasError = true;
            } else if (!validateEmail(email)) {
                showError('registerEmailError', 'Please enter a valid email address');
                hasError = true;
            }

            if (!password) {
                showError('registerPasswordError', 'Password is required');
                hasError = true;
            } else if (password.length < 6) {
                showError('registerPasswordError', 'Password must be at least 6 characters');
                hasError = true;
            }

            if (!confirmPassword) {
                showError('registerConfirmPasswordError', 'Please confirm your password');
                hasError = true;
            } else if (password !== confirmPassword) {
                showError('registerConfirmPasswordError', 'Passwords do not match');
                hasError = true;
            }

            if (hasError) {
                return;
            }

            // Show loading state
            const submitBtn = e.target.querySelector('#registerSubmitBtn');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Creating Account...`;
            submitBtn.disabled = true;

            const success = await register(name, email, password);

            // Reset button
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;

            if (success) {
                // Success handling (modal switching is done in register() function)
                hideAllRegisterErrors();
            } else {
                // Show error message
                showError('registerGeneralError', 'Registration failed. Please try again.');

                // Shake animation for error
                const form = document.getElementById('registerForm');
                form.classList.add('shake');
                setTimeout(() => form.classList.remove('shake'), 500);
            }
        });
    }

    // Email validation helper
    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    // === THEME TOGGLE ===
    const currentTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';

            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);

            document.body.style.opacity = '0.8';
            setTimeout(() => {
                document.body.style.opacity = '1';
            }, 300);
        });
    }

    // === HISTORY BUTTONS ===
    const refreshHistoryBtn = document.getElementById('refreshHistory');
    const clearHistoryBtn = document.getElementById('clearHistory');

    if (refreshHistoryBtn) {
        refreshHistoryBtn.addEventListener('click', () => {
            loadUserHistory();
            showNotification('History refreshed!', 'info');
        });
    }

    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to clear all history? This action cannot be undone.')) {
                try {
                    const headers = {};
                    if (userToken) {
                        headers['Authorization'] = `Bearer ${userToken}`;
                    } else if (currentSessionId) {
                        headers['X-Session-Id'] = currentSessionId;
                    }

                    const response = await fetch(`${API_BASE_URL}/history`, {
                        method: 'DELETE',
                        headers: headers
                    });

                    const data = await response.json();

                    if (data.success) {
                        loadUserHistory();
                        showNotification('History cleared successfully!', 'success');
                    } else {
                        showNotification('Failed to clear history', 'error');
                    }
                } catch (error) {
                    console.error('Clear history error:', error);
                    showNotification('Failed to clear history', 'error');
                }
            }
        });
    }

    // Initialize loading screen
    setTimeout(() => {
        document.getElementById('loadingOverlay').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('loadingOverlay').style.display = 'none';
            initAnimations();
            initParticles();
            testAPIConnection(); // Test backend connection
        }, 500);
    }, 1500);

    // === INITIAL SETUP ===
    updateUIForMode('compress');

    // === TAB FUNCTIONALITY ===
    tabButtons.forEach(button => {
        button.addEventListener('click', function () {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');

            const mode = this.getAttribute('data-tab');
            updateUIForMode(mode);
            fileInput.value = '';
            resetDropZone();
        });
    });

    function updateUIForMode(mode) {
        const isDecompressMode = mode === 'decompress';

        // Update container class
        if (isDecompressMode) {
            processorContainer.classList.add('decompression-mode');
        } else {
            processorContainer.classList.remove('decompression-mode');
        }

        // Update drop zone text
        dropZoneTitle.textContent = isDecompressMode
            ? 'Drop Files Here for Decompression'
            : 'Drop Files Here for Compression';

        dropZoneSubtitle.textContent = isDecompressMode
            ? 'or click to browse. Supports .bin and .dat formats'
            : 'or click to browse. Supports TXT and BMP formats';

        // Update browse button
        browseFilesBtn.innerHTML = isDecompressMode
            ? '<i class="fas fa-folder-open"></i> Browse Compressed Files'
            : '<i class="fas fa-folder-open"></i> Browse Files';

        // Update process button
        processButtonText.textContent = isDecompressMode
            ? 'Decompress Files Now'
            : 'Compress Files Now';

        // Update button classes
        processButton.className = 'btn ripple-effect';
        if (isDecompressMode) {
            processButton.classList.add('btn-decompress-primary');
        } else {
            processButton.classList.add('btn-primary');
        }

        // Update file type options
        fileTypeSelect.innerHTML = '';

        if (isDecompressMode) {
            fileTypeTitle.innerHTML = '<i class="fas fa-file" style="color: #FF7C69; margin-right: 10px;"></i> Compressed File Type';
            fileTypeBox.querySelector('h4 i').style.color = '#FF7C69';

            const decompressOptions = [
                { value: 'image', text: 'IMAGE (.dat)' },
                { value: 'text', text: 'TEXT (.bin)' }
            ];
            decompressOptions.forEach(option => {
                const optionElement = document.createElement('option');
                optionElement.value = option.value;
                optionElement.textContent = option.text;
                fileTypeSelect.appendChild(optionElement);
            });

            fileInput.setAttribute('accept', '.dat,.bin');
            outputFormatBox.classList.remove('display-card-blue');
            outputFormatBox.classList.add('display-card-orange');
            outputFormatBox.querySelector('.display-icon').style.background = 'linear-gradient(135deg, #FF7C69, #FF5722)';

        } else {
            fileTypeTitle.innerHTML = '<i class="fas fa-file" style="color: var(--primary-color); margin-right: 10px;"></i> File Type';
            fileTypeBox.querySelector('h4 i').style.color = 'var(--primary-color)';

            const compressOptions = [
                { value: 'image', text: 'IMAGE (.BMP)' },
                { value: 'text', text: 'Text Document (.TXT)' }
            ];
            compressOptions.forEach(option => {
                const optionElement = document.createElement('option');
                optionElement.value = option.value;
                optionElement.textContent = option.text;
                fileTypeSelect.appendChild(optionElement);
            });

            fileInput.setAttribute('accept', '.txt,.bmp');
            outputFormatBox.classList.remove('display-card-orange');
            outputFormatBox.classList.add('display-card-blue');
            outputFormatBox.querySelector('.display-icon').style.background = 'var(--primary-color)';
        }

        updateCompressionInfo();
        fileTypeSelect.addEventListener('change', updateCompressionInfo);
    }

    function updateCompressionInfo() {
        const selectedValue = fileTypeSelect.value;
        const isDecompressMode = processorContainer.classList.contains('decompression-mode');

        if (isDecompressMode) {
            if (selectedValue === 'image') {
                compressionInfo.innerHTML = `
                    <span style="color: #FF7C69;">.bmp</span> extension
                    <div style="font-size: 0.9rem; font-weight: normal; color: var(--gray-medium); margin-top: 3px;">
                        <i class="fas fa-image" style="margin-right: 5px; color: #FF7C69;"></i>Decompressed from .dat
                    </div>
                `;
            } else if (selectedValue === 'text') {
                compressionInfo.innerHTML = `
                    <span style="color: #FF7C69;">.txt</span> extension
                    <div style="font-size: 0.9rem; font-weight: normal; color: var(--gray-medium); margin-top: 3px;">
                        <i class="fas fa-file-alt" style="margin-right: 5px; color: #FF7C69;"></i>Decompressed from .bin
                    </div>
                `;
            }
        } else {
            if (selectedValue === 'image') {
                compressionInfo.innerHTML = `
                    <span style="color: #2196f3;">.dat</span> extension
                    <div style="font-size: 0.9rem; font-weight: normal; color: var(--gray-medium); margin-top: 3px;">
                        <i class="fas fa-image" style="margin-right: 5px;"></i>Optimized for images
                    </div>
                `;
            } else if (selectedValue === 'text') {
                compressionInfo.innerHTML = `
                    <span style="color: #ff9800;">.bin</span> extension
                    <div style="font-size: 0.9rem; font-weight: normal; color: var(--gray-medium); margin-top: 3px;">
                        <i class="fas fa-file-alt" style="margin-right: 5px;"></i>Optimized for text
                    </div>
                `;
            }
        }
    }

    // === FILE HANDLING ===
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function handleFiles(e) {
        const files = e.target.files;
        const isDecompressMode = processorContainer.classList.contains('decompression-mode');

        if (files.length > 0) {
            const iconColor = isDecompressMode ? '#FF7C69' : '#4CAF50';

            if (files.length === 1) {
                const file = files[0];
                const fileSize = formatFileSize(file.size);
                const fileExtension = file.name.split('.').pop().toUpperCase();

                dropZone.innerHTML = `
                    <i class="fas fa-file-check drop-zone-icon" style="color: ${iconColor};"></i>
                    <h3 style="margin-bottom: 10px; color: var(--dark-color); font-size: 1.2rem; word-break: break-word;">
                        ${file.name}
                    </h3>
                    <p style="color: var(--dark-color); margin-bottom: 5px; font-weight: 600;">
                        Size: <span style="color: ${isDecompressMode ? '#FF7C69' : 'var(--primary-color)'}">${fileSize}</span>
                    </p>
                    <p style="color: var(--dark-color); margin-bottom: 10px;">
                        Type: <span style="color: var(--gray-medium);">${fileExtension} File</span>
                    </p>
                    <p style="color: var(--success-color); margin-bottom: 20px; font-weight: 600;">
                        <i class="fas fa-check-circle"></i> Selected Successfully
                    </p>
                    <button class="btn btn-outline" id="changeFiles">
                        <i class="fas fa-exchange-alt"></i> Change File
                    </button>
                `;
            } else {
                const totalSize = Array.from(files).reduce((sum, file) => sum + file.size, 0);
                const formattedSize = formatFileSize(totalSize);

                dropZone.innerHTML = `
                    <i class="fas fa-file-check drop-zone-icon" style="color: ${iconColor};"></i>
                    <h3 style="margin-bottom: 10px; color: var(--dark-color); font-size: 1.2rem;">
                        ${files.length} files selected
                    </h3>
                    <p style="color: var(--dark-color); margin-bottom: 5px; font-weight: 600;">
                        Total Size: <span style="color: var(--primary-color);">${formattedSize}</span>
                    </p>
                    <div style="max-height: 100px; overflow-y: auto; margin-bottom: 10px; text-align: left; font-size: 0.9rem; color: var(--gray-medium);">
                        ${Array.from(files).slice(0, 3).map(file =>
                    `<div style="padding: 3px 0;">• ${file.name}</div>`
                ).join('')}
                        ${files.length > 3 ? `<div style="padding: 3px 0; font-style: italic;">...and ${files.length - 3} more</div>` : ''}
                    </div>
                    <p style="color: var(--success-color); margin-bottom: 20px; font-weight: 600;">
                        <i class="fas fa-check-circle"></i> Files selected successfully
                    </p>
                    <button class="btn btn-outline" id="changeFiles">
                        <i class="fas fa-exchange-alt"></i> Change Files
                    </button>
                `;
            }

            document.getElementById('changeFiles').addEventListener('click', () => {
                fileInput.click();
            });

            dropZone.style.transform = 'scale(1.05)';
            setTimeout(() => {
                dropZone.style.transform = 'scale(1)';
            }, 300);
        }
    }

    // Add this function outside DOMContentLoaded or ensure it's accessible
    function resetDropZone() {
        const processorContainer = document.querySelector('.processor-container');
        const isDecompressMode = processorContainer.classList.contains('decompression-mode');
        const dropZone = document.getElementById('dropZone');

        dropZone.innerHTML = `
        <i class="fas fa-cloud-upload-alt drop-zone-icon"></i>
        <h3 style="margin-bottom: 20px; color: var(--dark-color);">
            ${isDecompressMode ? 'Drop Files Here for Decompression' : 'Drop Files Here for Compression'}
        </h3>
        <p style="color: var(--gray-medium); margin-bottom: 30px;">
            ${isDecompressMode ? 'or click to browse. Supports .bin and .dat formats' : 'or click to browse. Supports TXT and BMP formats'}
        </p>
        <button class="btn btn-outline" id="browseFiles">
            <i class="fas fa-folder-open"></i> ${isDecompressMode ? 'Browse Compressed Files' : 'Browse Files'}
        </button>
    `;

        // No need to attach event listener here - event delegation handles it
    }

    // === EVENT LISTENERS ===
    fileInput.addEventListener('change', handleFiles);

    // === EVENT LISTENERS ===
    fileInput.addEventListener('change', handleFiles);

    // Use event delegation for browse files button (since it gets recreated)
    document.addEventListener('click', function (e) {
        // Check if the clicked element is a browse files button
        if (e.target.id === 'browseFiles' ||
            e.target.closest('#browseFiles') ||
            (e.target.classList.contains('btn') && e.target.textContent.includes('Browse'))) {
            console.log("Browse File Button Clicked");
            e.preventDefault();
            fileInput.click();
        }
    });

    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('dragover');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const mockEvent = { target: { files: files } };
            handleFiles(mockEvent);
        }
    });


    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('dragover');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const mockEvent = { target: { files: files } };
            handleFiles(mockEvent);
        }
    });

    // === BACKEND PROCESSING ===
    processButton.addEventListener('click', async function () {
        console.log('🟢 Process button clicked!');
        // CHECK IF USER IS LOGGED IN
        if (!userToken || !currentUser) {
            showNotification('Please login to compress/decompress files', 'warning');
            setTimeout(() => {
                document.getElementById('loginBtn').click();
            }, 1000);
            return;
        }
        console.log('📁 Selected files:', fileInput.files.length);
        console.log('📄 File type selected:', fileTypeSelect.value);
        console.log('🌐 API Base URL:', API_BASE_URL);
        const isDecompressMode = processorContainer.classList.contains('decompression-mode');
        const selectedFiles = fileInput.files;
        const selectedFileType = fileTypeSelect.value;

        if (selectedFiles.length === 0) {
            showNotification(`Please select files to ${isDecompressMode ? 'decompress' : 'compress'} first`, 'warning');
            return;
        }

        // Validate file extensions
        let expectedExtensions = [];
        let expectedExtensionText = '';

        if (isDecompressMode) {
            if (selectedFileType === 'image') {
                expectedExtensions = ['.dat'];
                expectedExtensionText = '.dat';
            } else if (selectedFileType === 'text') {
                expectedExtensions = ['.bin'];
                expectedExtensionText = '.bin';
            }
        } else {
            if (selectedFileType === 'image') {
                expectedExtensions = ['.bmp'];
                expectedExtensionText = '.bmp';
            } else if (selectedFileType === 'text') {
                expectedExtensions = ['.txt'];
                expectedExtensionText = '.txt';
            }
        }

        let isValid = true;
        Array.from(selectedFiles).forEach(file => {
            const fileName = file.name.toLowerCase();
            let fileIsValid = false;

            for (let ext of expectedExtensions) {
                if (fileName.endsWith(ext)) {
                    fileIsValid = true;
                    break;
                }
            }

            if (!fileIsValid) {
                isValid = false;
                showNotification(`"${file.name}" is not a ${expectedExtensionText} file`, 'error');
            }
        });

        if (!isValid) return;

        // Call processWithBackend with all required parameters
        await processWithBackend(isDecompressMode, selectedFiles, selectedFileType, processButton, progressBar, fileInput);
    });

    // === NOTIFICATION SYSTEM ===
    function showNotification(message, type = 'info') {
        const container = createNotificationContainer();

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-icon">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
            </div>
            <div class="notification-content">
                ${message}
            </div>
            <button class="notification-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;

        container.appendChild(notification);
        notification.querySelector('.notification-close').addEventListener('click', function () {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        });

        setTimeout(() => notification.classList.add('show'), 10);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    }

    // === API CONNECTION TEST ===
    async function testAPIConnection() {
        try {
            const response = await fetch(`${API_BASE_URL}/test`);
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Backend API connected successfully:', data.status);
            } else {
                console.warn('⚠️ Backend API connection issue');
            }
        } catch (error) {
            console.error('❌ Cannot connect to backend API:', error);
        }
    }

    // === ANIMATIONS ===
    function initAnimations() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -100px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animated');

                    if (entry.target.classList.contains('features-grid')) {
                        const cards = entry.target.querySelectorAll('.feature-card');
                        cards.forEach((card, index) => {
                            setTimeout(() => {
                                card.style.opacity = '1';
                                card.style.transform = 'translateY(0)';
                            }, index * 200);
                        });
                    }

                    if (entry.target.classList.contains('stats-grid')) {
                        const stats = entry.target.querySelectorAll('.stat-card');
                        stats.forEach((stat, index) => {
                            setTimeout(() => {
                                stat.style.opacity = '1';
                                stat.style.transform = 'translateY(0) scale(1)';
                            }, index * 300);
                        });
                    }
                }
            });
        }, observerOptions);

        document.querySelectorAll('.animate-on-scroll').forEach(el => {
            observer.observe(el);
        });

        // Scroll indicator
        const sections = document.querySelectorAll('section[id]');
        const scrollDots = document.querySelectorAll('.scroll-dot');

        function updateScrollIndicator() {
            const scrollPosition = window.scrollY + 100;

            sections.forEach((section, index) => {
                const sectionTop = section.offsetTop;
                const sectionHeight = section.clientHeight;

                if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
                    scrollDots.forEach(dot => dot.classList.remove('active'));
                    scrollDots[index].classList.add('active');
                }
            });
        }

        window.addEventListener('scroll', updateScrollIndicator);
        scrollDots.forEach(dot => {
            dot.addEventListener('click', () => {
                const sectionId = dot.getAttribute('data-section');
                const section = document.getElementById(sectionId);
                if (section) {
                    window.scrollTo({
                        top: section.offsetTop - 80,
                        behavior: 'smooth'
                    });
                }
            });
        });
    }

    // === PARTICLES BACKGROUND ===
    function initParticles() {
        const particlesContainer = document.getElementById('particles');
        const particleCount = 50;

        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.style.position = 'absolute';
            particle.style.width = Math.random() * 5 + 2 + 'px';
            particle.style.height = particle.style.width;
            particle.style.background = `rgba(${Math.random() * 100 + 155}, ${Math.random() * 100 + 155}, 255, ${Math.random() * 0.3 + 0.1})`;
            particle.style.borderRadius = '50%';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.top = Math.random() * 100 + '%';
            particle.style.animation = `float ${Math.random() * 20 + 10}s infinite linear`;
            particle.style.animationDelay = Math.random() * 5 + 's';

            particlesContainer.appendChild(particle);
        }
    }

    // === RIPPLE EFFECT ===
    document.querySelectorAll('.ripple-effect').forEach(btn => {
        btn.addEventListener('click', function (e) {
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;

            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            ripple.classList.add('ripple');

            this.appendChild(ripple);

            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });

    // Add CSS for ripple effect
    const style = document.createElement('style');
    style.textContent = `
        .ripple {
            position: absolute;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.7);
            transform: scale(0);
            animation: ripple 0.6s linear;
        }
        
        @keyframes ripple {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);

    // === SCROLL ANIMATIONS ===
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        const rate = scrolled * -0.5;

        const floatingElements = document.querySelectorAll('.floating-element');
        floatingElements.forEach((el, index) => {
            el.style.transform = `translateY(${rate * (index + 1) * 0.1}px)`;
        });

        const header = document.querySelector('header');
        if (scrolled > 100) {
            header.style.transform = 'translateY(-100%)';
            setTimeout(() => {
                header.style.transform = 'translateY(0)';
            }, 300);
        }
    });

    // === TYPEWRITER EFFECT ===
    const heroTitle = document.querySelector('.hero-title');
    if (heroTitle) {
        const text = heroTitle.textContent;
        heroTitle.textContent = '';

        let i = 0;
        function typeWriter() {
            if (i < text.length) {
                heroTitle.textContent += text.charAt(i);
                i++;
                setTimeout(typeWriter, 50);
            }
        }

        setTimeout(typeWriter, 2000);
    }

    // === STATS COUNTER ANIMATION ===
    const statNumbers = document.querySelectorAll('.stat-number');
    const observerOptions = {
        threshold: 0.5
    };

    const statsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const stat = entry.target;
                const target = parseInt(stat.textContent);
                let current = 0;
                const increment = target / 50;

                const timer = setInterval(() => {
                    current += increment;
                    if (current >= target) {
                        stat.textContent = target + (stat.textContent.includes('%') ? '%' : '+');
                        clearInterval(timer);
                    } else {
                        stat.textContent = Math.floor(current) + (stat.textContent.includes('%') ? '%' : '+');
                    }
                }, 30);

                statsObserver.unobserve(stat);
            }
        });
    }, observerOptions);

    statNumbers.forEach(stat => statsObserver.observe(stat));

    // === NAVIGATION SMOOTH SCROLL ===
    function verySmoothScrollTo(targetY, duration = 1200) {
        const startY = window.scrollY;
        const distance = targetY - startY;
        const startTime = performance.now();

        function animation(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            const ease = progress < 0.5
                ? 2 * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;

            window.scrollTo(0, startY + distance * ease);

            if (progress < 1) {
                requestAnimationFrame(animation);
            }
        }

        requestAnimationFrame(animation);
    }

    document.getElementById('navDecompress')?.addEventListener('click', function (e) {
        e.preventDefault();
        const processorSection = document.getElementById('processor');
        if (processorSection) {
            verySmoothScrollTo(processorSection.offsetTop - 80, 800);
            setTimeout(() => {
                const decompressTab = document.querySelector('.tab-btn[data-tab="decompress"]');
                if (decompressTab) {
                    decompressTab.click();
                }
            }, 100);
        }
    });

    document.getElementById('navCompress')?.addEventListener('click', function (e) {
        e.preventDefault();
        const processorSection = document.getElementById('processor');
        if (processorSection) {
            verySmoothScrollTo(processorSection.offsetTop - 80, 800);
            setTimeout(() => {
                const compressTab = document.querySelector('.tab-btn[data-tab="compress"]');
                if (compressTab) {
                    compressTab.click();
                }
            }, 100);
        }
    });

    document.getElementById('navFeature')?.addEventListener('click', function (e) {
        e.preventDefault();
        const featuresSection = document.getElementById('features');
        if (featuresSection) {
            verySmoothScrollTo(featuresSection.offsetTop - 80, 800);
        }
    });

    document.getElementById('navHistory')?.addEventListener('click', function (e) {
        e.preventDefault();
        const historySection = document.getElementById('history');
        if (historySection) {
            verySmoothScrollTo(historySection.offsetTop - 80, 800);
        }
    });

    // Initialize history display
    if (document.getElementById('historyContainer')) {
        loadUserHistory();
    }


    // Debug final state
    console.log('🎉 Initialization complete!');
    console.log('📊 Final state:', {
        currentUser,
        userToken: userToken ? 'Token present' : 'No token',
        currentSessionId,
        loginBtnVisible: loginBtn ? loginBtn.style.display : 'not found',
        registerBtnVisible: registerBtn ? registerBtn.style.display : 'not found'
    });
    // Debug form submission
    console.log('🔍 Form debug:');
    console.log('Login form element:', document.getElementById('loginForm'));
    console.log('Register form element:', document.getElementById('registerForm'));

    // Test form submit manually
    window.testLogin = function (testEmail, testPassword) {
        console.log('🧪 Testing login with:', testEmail);
        login(testEmail, testPassword);
    };

    // Temporary debug button
    const debugBtn = document.createElement('button');
    debugBtn.innerHTML = 'Test Login';
    debugBtn.style.position = 'fixed';
    debugBtn.style.bottom = '10px';
    debugBtn.style.right = '10px';
    debugBtn.style.zIndex = '9999';
    debugBtn.style.padding = '10px';
    debugBtn.style.background = '#ff0000';
    debugBtn.style.color = 'white';
    debugBtn.style.border = 'none';
    debugBtn.style.borderRadius = '5px';
    debugBtn.onclick = () => {
        const testEmail = prompt('Enter test email:');
        const testPassword = prompt('Enter test password:');
        if (testEmail && testPassword) {
            login(testEmail, testPassword);
        }
    };
    document.body.appendChild(debugBtn);
});

// Test function - call this from console
window.testProcess = function () {
    console.log('🧪 Testing process button...');
    const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(testFile);
    fileInput.files = dataTransfer.files;

    // Simulate a file selection
    const event = new Event('change');
    fileInput.dispatchEvent(event);

    // Call processWithBackend directly
    processWithBackend(false, fileInput.files, 'text', processButton, progressBar, fileInput);
};
// === HISTORY FUNCTIONS (OUTSIDE DOMContentLoaded) ===

let currentPage = 1;
const itemsPerPage = 3;

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: diffDays > 365 ? 'numeric' : undefined
    });
}

function loadHistory() {
    const container = document.getElementById('historyContainer');
    const filterType = document.getElementById('filterType')?.value || 'all';
    const filterPeriod = document.getElementById('filterPeriod')?.value || 'all';

    let filteredData = historyData.filter(item => {
        if (filterType !== 'all' && item.operation_type !== filterType) return false;

        if (filterPeriod !== 'all') {
            const now = new Date();
            const itemDate = new Date(item.start_time);
            const diffDays = Math.floor((now - itemDate) / (1000 * 60 * 60 * 24));

            switch (filterPeriod) {
                case 'today': return diffDays === 0;
                case 'week': return diffDays <= 7;
                case 'month': return diffDays <= 30;
            }
        }

        return true;
    });

    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredData.slice(startIndex, endIndex);

    if (pageData.length === 0) {
        container.innerHTML = `
            <div class="no-history">
                <i class="fas fa-history" style="font-size: 4rem; color: var(--gray-light); margin-bottom: 20px;"></i>
                <h3>No History Found</h3>
                <p>No files match your current filters. Try changing your search criteria.</p>
            </div>
        `;
    } else {
        container.innerHTML = pageData.map((item, index) => `
            <div class="history-item ${item.operation_type} animate-on-scroll" 
                 style="animation-delay: ${index * 0.1}s" 
                 data-id="${item.id}">
                <div class="history-item-header">
                    <div class="history-icon">
                        <i class="fas fa-${item.operation_type === 'compress' ? 'compress-alt' : 'expand-alt'}"></i>
                    </div>
                    <div class="history-info">
                        <h4>${item.original_filename}</h4>
                        <div class="history-meta">
                            <span class="history-operation ${item.operation_type}">${item.operation_type}</span>
                            <span class="history-time">${formatTime(item.start_time)}</span>
                            <span class="history-status ${item.status}">${item.status}</span>
                        </div>
                    </div>
                </div>
                <div class="history-stats">
                    <div class="history-stat">
                        <div class="stat-label">Original Size</div>
                        <div class="stat-value">${formatBytes(item.original_size)}</div>
                    </div>
                    <div class="history-stat">
                        <div class="stat-label">Processed Size</div>
                        <div class="stat-value">${item.processed_size ? formatBytes(item.processed_size) : '--'}</div>
                    </div>
                    <div class="history-stat">
                        <div class="stat-label">${item.operation_type === 'compress' ? 'Ratio' : 'Extracted'}</div>
                        <div class="stat-value">${item.compression_ratio ? item.compression_ratio + '%' : '--'}</div>
                    </div>
                </div>
                <div class="history-actions">
                    ${item.status === 'completed' ? `
                        <button class="btn btn-outline btn-sm" onclick="downloadDummyFile('${item.id}')">
                            <i class="fas fa-download"></i> Download
                        </button>
                    ` : ''}
                    <button class="btn btn-outline btn-sm" onclick="showFileDetails(${item.id})">
                        <i class="fas fa-info-circle"></i> Details
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderPagination(filteredData.length, totalPages);
}

function renderPagination(totalItems, totalPages) {
    const pagination = document.getElementById('pagination');
    if (!pagination) return;

    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    let paginationHTML = `
        <button class="page-btn" id="prevPage" ${currentPage === 1 ? 'disabled' : ''}>
            <i class="fas fa-chevron-left"></i>
        </button>
    `;

    for (let i = 1; i <= totalPages; i++) {
        paginationHTML += `
            <button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">
                ${i}
            </button>
        `;
    }

    paginationHTML += `
        <button class="page-btn" id="nextPage" ${currentPage === totalPages ? 'disabled' : ''}>
            <i class="fas fa-chevron-right"></i>
        </button>
        <span style="color: var(--gray-medium); margin-left: 15px;">
            Showing ${Math.min(totalItems, itemsPerPage)} of ${totalItems} items
        </span>
    `;

    pagination.innerHTML = paginationHTML;

    document.getElementById('prevPage')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadHistory();
        }
    });

    document.getElementById('nextPage')?.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            loadHistory();
        }
    });

    document.querySelectorAll('.page-btn[data-page]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentPage = parseInt(e.target.dataset.page);
            loadHistory();
        });
    });
}

window.showFileDetails = function (fileId) {
    const file = historyData.find(item => item.id === fileId);
    if (!file) return;

    const modal = document.getElementById('fileDetailsModal');
    const fileName = document.getElementById('fileName');
    const operationType = document.getElementById('fileOperationType');
    const content = document.getElementById('fileDetailsContent');

    fileName.textContent = file.original_filename;
    operationType.textContent = file.operation_type;
    operationType.className = `history-operation ${file.operation_type}`;

    content.innerHTML = `
        <div class="detail-row">
            <span class="detail-label">Operation Type:</span>
            <span class="detail-value">${file.operation_type.toUpperCase()}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Format:</span>
            <span class="detail-value">${file.format}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Original Size:</span>
            <span class="detail-value">${formatBytes(file.original_size)}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Processed Size:</span>
            <span class="detail-value">${file.processed_size ? formatBytes(file.processed_size) : '--'}</span>
        </div>
        ${file.compression_ratio ? `
        <div class="detail-row">
            <span class="detail-label">Compression Ratio:</span>
            <span class="detail-value">${file.compression_ratio}%</span>
        </div>
        ` : ''}
        <div class="detail-row">
            <span class="detail-label">Status:</span>
            <span class="detail-value history-status ${file.status}">${file.status}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Processed Date:</span>
            <span class="detail-value">${new Date(file.start_time).toLocaleString()}</span>
        </div>
    `;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
};

window.downloadDummyFile = function (fileId) {
    const file = historyData.find(item => item.id === fileId);
    if (!file) return;

    showNotification(`Downloading ${file.processed_filename}...`, 'info');

    setTimeout(() => {
        showNotification(`${file.processed_filename} downloaded successfully!`, 'success');
    }, 1500);
};

window.addDummyHistoryItem = function (operationType, filename) {
    const newItem = {
        id: historyData.length + 1,
        operation_type: operationType,
        original_filename: filename,
        processed_filename: operationType === 'compress' ?
            filename.replace(/\.[^/.]+$/, "") + '_compressed.bin' :
            filename.replace(/\.[^/.]+$/, "") + '_decompressed.txt',
        original_size: Math.floor(Math.random() * 10000000) + 1000000,
        processed_size: operationType === 'compress' ?
            Math.floor(Math.random() * 5000000) + 500000 :
            Math.floor(Math.random() * 20000000) + 5000000,
        compression_ratio: operationType === 'compress' ? Math.floor(Math.random() * 70) + 10 : null,
        status: 'completed',
        start_time: new Date(),
        format: operationType === 'compress' ? 'BIN' : 'TXT'
    };

    historyData.unshift(newItem);
    currentPage = 1;
    loadHistory();
};



// Global showNotification function
function showNotification(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    // You can add a toast notification system here if needed
}
