const express = require('express');
const app = express();
const PORT = 3000;

// Import necessary modules
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Connect to MongoDB (remove deprecated options)
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Define User schema and model
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
});

const User = mongoose.model('User', userSchema);

// Queue array and admin password setup
let queue = [];
const adminPassword = process.env.ADMIN_PASSWORD || 'daude'; // Default admin password is "daude"

app.use(express.json());
app.use(express.static('public')); // Serve static files from the 'public' folder

// Middleware to authenticate JWT tokens
function authenticateToken(req, res, next) {
  // ... (same as before)
}

// Registration endpoint
app.post('/register', async (req, res) => {
  // ... (same as before)
});

// Login endpoint
app.post('/login', async (req, res) => {
  // ... (same as before)
});

// Endpoint to get the current queue (authenticated)
app.get('/queue', authenticateToken, (req, res) => res.json(queue));

// Endpoint to add a user to the queue (authenticated)
app.post('/add', authenticateToken, (req, res) => {
  // ... (same as before)
});

// Endpoint to remove a user from the queue (admin only)
app.post('/remove', authenticateToken, (req, res) => {
  // ... (same as before)
});

// Endpoint to remove the top player in the queue (admin only)
app.post('/remove-top', authenticateToken, (req, res) => {
  // ... (same as before)
});

// Start the server
app.listen(PORT, () =>
  console.log(`Server is running on http://localhost:${PORT}`)
);
