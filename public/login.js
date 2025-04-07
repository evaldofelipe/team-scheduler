// Theme Toggle functionality
function initializeTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

// Add event listener for theme toggle
document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
initializeTheme();

const loginForm = document.getElementById('login-form');
const errorMessageDiv = document.getElementById('error-message');

// Check for messages passed via query parameter (e.g., after redirect)
const urlParams = new URLSearchParams(window.location.search);
const message = urlParams.get('message');
if (message) {
    errorMessageDiv.textContent = message;
}

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault(); // Prevent default form submission
    errorMessageDiv.textContent = ''; // Clear previous errors

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
            // Login successful - redirect based on role
            if (result.role === 'admin') {
                window.location.href = '/admin'; // Redirect to admin dashboard
            } else {
                window.location.href = '/user';  // Redirect to user dashboard
            }
        } else {
            // Login failed - display error message
            errorMessageDiv.textContent = result.message || 'Login failed. Please try again.';
        }
    } catch (error) {
        console.error('Login request failed:', error);
        errorMessageDiv.textContent = 'An error occurred during login. Please check console.';
    }
});
