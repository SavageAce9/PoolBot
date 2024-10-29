const express = require('express');
const app = express();
const PORT = 3000;

// Import necessary modules
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

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
const adminPassword = process.env.ADMIN_PASSWORD || 'daude'; // Default admin password

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the 'public' folder
app.use(express.static('public'));

// Middleware to authenticate JWT tokens
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token required' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
}

// Registration endpoint
app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashedPassword });
    await user.save();
    res.json({ message: 'User registered successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Error registering user.' });
  }
});

// Login endpoint
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });

  if (user && await bcrypt.compare(password, user.password)) {
    const token = jwt.sign({ username: user.username }, process.env.JWT_SECRET);
    res.json({ token });
  } else {
    res.status(401).json({ message: 'Invalid username or password' });
  }
});

// Endpoint to get the current queue (authenticated)
app.get('/queue', authenticateToken, (req, res) => {
  res.json(queue);
});

// Endpoint to add a user to the queue (authenticated)
app.post('/add', authenticateToken, (req, res) => {
  const username = req.user.username;

  if (queue.includes(username)) {
    return res.status(400).json({ message: 'You are already in the queue.' });
  }

  queue.push(username);
  res.json({ message: `${username} added to the queue.` });
});

// Middleware to check for admin privileges
function authenticateAdmin(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  if (decoded && decoded.isAdmin) {
      req.user = decoded;
      next();
  } else {
      res.status(403).json({ message: 'Admin access required' });
  }
}

// Remove specific user (admin only)
app.post('/admin/remove', authenticateAdmin, (req, res) => {
  const { username } = req.body;
  const index = queue.indexOf(username);
  if (index !== -1) {
      queue.splice(index, 1);
      res.json({ message: `${username} removed from queue by admin` });
  } else {
      res.status(400).json({ message: 'User not in queue' });
  }
});

// Clear queue (admin only)
app.post('/admin/clear', authenticateAdmin, (req, res) => {
  queue = [];
  res.json({ message: 'Queue cleared by admin' });
});

// Endpoint to remove the top player in the queue (admin only)
app.post('/admin/remove-top', authenticateToken, (req, res) => {
  const { password } = req.body;

  if (queue.length === 0) {
    return res.status(400).json({ message: 'The queue is empty.' });
  }

  const removedUser = queue.shift();
  res.json({ message: `${removedUser} removed from the queue.` });
});

// Add a user at a specified position (admin only)
app.post('/admin/add-at-position', authenticateAdmin, async (req, res) => {
  const { username, position } = req.body;

  if (queue.includes(username)) {
      return res.status(400).json({ message: 'User already in queue' });
  }

  if (position < 0 || position > queue.length) {
      return res.status(400).json({ message: 'Invalid position' });
  }

  queue.splice(position, 0, username); // Insert the user at the specified position
  res.json({ message: `${username} added to queue at position ${position + 1}` });
});

// Get all users (admin only)
app.get('/admin/users', authenticateAdmin, async (req, res) => {
  const users = await User.find({}, 'username'); // Retrieve only usernames
  res.json(users.map(user => user.username));
});


// Endpoint to update the queue in real time
app.get('/queue', authenticateToken, (req, res) => res.json(queue));

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
