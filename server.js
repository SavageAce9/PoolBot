// server.js
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
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  winRatio: { type: Number, default: 0 },
});

const User = mongoose.model('User', userSchema);

// Define QueueItem schema and model
const queueItemSchema = new mongoose.Schema({
  username: String,
  position: Number,
});

const QueueItem = mongoose.model('QueueItem', queueItemSchema);

// Admin password setup
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

// Middleware to authenticate admin users
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token required' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded && decoded.isAdmin) {
      req.user = decoded;
      next();
    } else {
      res.status(403).json({ message: 'Admin access required' });
    }
  } catch (err) {
    res.status(403).json({ message: 'Invalid token' });
  }
}

// Registration endpoint
app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (username.toLowerCase() === 'admin') {
      return res.status(400).json({ message: 'Username not allowed' });
    }

    if (!username || username.length < 3) {
      return res.status(400).json({ message: 'Username must be at least 3 characters long' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashedPassword });
    await user.save();
    res.json({ message: 'User registered successfully.' });
  } catch (err) {
    if (err.code === 11000) {
      res.status(400).json({ message: 'Username already exists' });
    } else {
      res.status(500).json({ message: 'Error registering user.' });
    }
  }
});

// Login endpoint
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (username === 'admin' && password === adminPassword) {
    const token = jwt.sign({ username: 'admin', isAdmin: true }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } else {
    const user = await User.findOne({ username });

    if (user && await bcrypt.compare(password, user.password)) {
      const token = jwt.sign({ username: user.username, isAdmin: false }, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.json({ token });
    } else {
      res.status(401).json({ message: 'Invalid username or password' });
    }
  }
});

// Endpoint to get the current queue (authenticated)
app.get('/queue', authenticateToken, async (req, res) => {
  const queue = await QueueItem.find().sort({ position: 1 });
  res.json(queue.map(item => item.username));
});

// Endpoint to add a user to the queue (authenticated)
app.post('/add', authenticateToken, async (req, res) => {
  const username = req.user.username;

  const existingItem = await QueueItem.findOne({ username });
  if (existingItem) {
    return res.status(400).json({ message: 'You are already in the queue.' });
  }

  const lastItem = await QueueItem.findOne().sort({ position: -1 });
  const newPosition = lastItem ? lastItem.position + 1 : 1;

  const queueItem = new QueueItem({ username, position: newPosition });
  await queueItem.save();
  res.json({ message: `${username} added to the queue.` });
});

// Remove specific user (admin only)
app.post('/admin/remove', authenticateAdmin, async (req, res) => {
  const { username } = req.body;
  const deletedItem = await QueueItem.findOneAndDelete({ username });
  if (deletedItem) {
    // Reorder positions
    await QueueItem.updateMany(
      { position: { $gt: deletedItem.position } },
      { $inc: { position: -1 } }
    );
    res.json({ message: `${username} removed from queue by admin` });
  } else {
    res.status(400).json({ message: 'User not in queue' });
  }
});

// Clear queue (admin only)
app.post('/admin/clear', authenticateAdmin, async (req, res) => {
  await QueueItem.deleteMany({});
  res.json({ message: 'Queue cleared by admin' });
});

// Endpoint to remove the top player in the queue (admin only)
app.post('/admin/remove-top', authenticateAdmin, async (req, res) => {
  const topItem = await QueueItem.findOne().sort({ position: 1 });
  if (!topItem) {
    return res.status(400).json({ message: 'The queue is empty.' });
  }

  await QueueItem.deleteOne({ _id: topItem._id });
  // Reorder positions
  await QueueItem.updateMany(
    { position: { $gt: topItem.position } },
    { $inc: { position: -1 } }
  );

  res.json({ message: `${topItem.username} removed from the queue.` });
});

// Add a user at a specified position (admin only)
app.post('/admin/add-at-position', authenticateAdmin, async (req, res) => {
  const { username, position } = req.body;

  if (!Number.isInteger(position) || position < 1) {
    return res.status(400).json({ message: 'Invalid position' });
  }

  const existingItem = await QueueItem.findOne({ username });
  if (existingItem) {
    return res.status(400).json({ message: 'User already in queue' });
  }

  const queueLength = await QueueItem.countDocuments();
  if (position > queueLength + 1) {
    return res.status(400).json({ message: 'Position out of bounds' });
  }

  // Increment positions of items at or after the specified position
  await QueueItem.updateMany(
    { position: { $gte: position } },
    { $inc: { position: 1 } }
  );

  const queueItem = new QueueItem({ username, position });
  await queueItem.save();
  res.json({ message: `${username} added to queue at position ${position}` });
});

// Get all users (admin only)
app.get('/admin/users', authenticateAdmin, async (req, res) => {
  const users = await User.find({}, 'username'); // Retrieve only usernames
  res.json(users.map(user => user.username));
});

// New endpoint to report game results
app.post('/report-game', authenticateToken, async (req, res) => {
  const { winner, loser } = req.body;
  const username = req.user.username;

  // Check if the user is one of the top two players
  const queue = await QueueItem.find().sort({ position: 1 }).limit(2);
  const topPlayers = queue.map(item => item.username);

  if (!topPlayers.includes(username)) {
    return res.status(403).json({ message: 'You can only report games if you are currently on the table.' });
  }

  if (!winner || !loser) {
    return res.status(400).json({ message: 'Winner and loser must be specified.' });
  }

  if (!topPlayers.includes(winner) || !topPlayers.includes(loser)) {
    return res.status(400).json({ message: 'Winner and loser must be among the top two players.' });
  }

  if (winner === loser) {
    return res.status(400).json({ message: 'Winner and loser cannot be the same person.' });
  }

  // Update winner's stats
  const winnerUser = await User.findOne({ username: winner });
  if (winnerUser) {
    winnerUser.wins += 1;
    winnerUser.winRatio = winnerUser.wins / (winnerUser.wins + winnerUser.losses);
    await winnerUser.save();
  }

  // Update loser's stats
  const loserUser = await User.findOne({ username: loser });
  if (loserUser) {
    loserUser.losses += 1;
    loserUser.winRatio = loserUser.wins / (loserUser.wins + loserUser.losses);
    await loserUser.save();
  }

  // Remove the loser from the queue
  const loserQueueItem = await QueueItem.findOne({ username: loser });
  if (loserQueueItem) {
    await QueueItem.deleteOne({ _id: loserQueueItem._id });
    // Reorder positions
    await QueueItem.updateMany(
      { position: { $gt: loserQueueItem.position } },
      { $inc: { position: -1 } }
    );
  }

  res.json({ message: 'Game reported successfully.' });
});

// Endpoint to get leaderboard data
app.get('/leaderboard', authenticateToken, async (req, res) => {
  const users = await User.find({}, 'username wins losses winRatio').sort({ winRatio: -1, wins: -1 });
  res.json(users);
});

// Endpoint to get user profile data
app.get('/profile', authenticateToken, async (req, res) => {
  const username = req.user.username;
  const user = await User.findOne({ username }, 'username wins losses winRatio').lean();
  if (user) {
    res.json(user);
  } else {
    res.status(404).json({ message: 'User not found' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
