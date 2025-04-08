// Theme Toggle functionality
function initializeTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    
    // Update button text/icon based on current theme
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
        themeToggleBtn.textContent = theme === 'light' ? '🌙' : '☀️';
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    // Update theme
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Update button text/icon
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
        themeToggleBtn.textContent = newTheme === 'light' ? '🌙' : '☀️';
    }
}

// Add theme toggle event listener
const themeToggleBtn = document.getElementById('theme-toggle');
if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme);
} else {
    console.warn("Theme toggle button not found in the DOM.");
}
initializeTheme(); // Initialize theme on load


// Login Form Logic
const loginForm = document.getElementById('login-form');
const errorMessageDiv = document.getElementById('error-message');
const usernameInput = document.getElementById('username'); // Get username input

// Check for messages passed via query parameter (e.g., after redirect)
const urlParams = new URLSearchParams(window.location.search);
const message = urlParams.get('message');
if (message) {
    errorMessageDiv.textContent = message;
}

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault(); // Prevent default form submission
    errorMessageDiv.textContent = ''; // Clear previous errors

    const username = usernameInput.value;
    const password = document.getElementById('password').value;

    if (!username || !password) {
        errorMessageDiv.textContent = 'Please enter both username and password.';
        return;
    }

    // Indicate loading state (optional)
    const loginButton = document.getElementById('login-button');
    loginButton.disabled = true;
    loginButton.textContent = 'Logging in...';

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        const result = await response.json(); // Expect JSON response always

        if (response.ok && result.success) {
            // Login successful - redirect based on role
            if (result.role === 'admin') {
                window.location.href = '/admin'; // Redirect to admin dashboard
            } else {
                window.location.href = '/user';  // Redirect to user dashboard
            }
            // No need to re-enable button as page is redirecting
        } else {
            // Login failed - display error message from server or generic one
            errorMessageDiv.textContent = result.message || 'Login failed. Please try again.';
            loginButton.disabled = false; // Re-enable button
            loginButton.textContent = 'Login';
        }
    } catch (error) {
        console.error('Login request failed:', error);
        errorMessageDiv.textContent = 'An network error occurred during login. Please check console or try again later.';
        loginButton.disabled = false; // Re-enable button on error
        loginButton.textContent = 'Login';
    }
});

// Focus username field on load
usernameInput.focus();
