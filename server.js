const express = require('express');
const app = express();
const PORT = 3000;

// Queue array and admin password setup
let queue = [];
const adminPassword = process.env.ADMIN_PASSWORD || "123"; // Default admin password is "123"

app.use(express.json());
app.use(express.static('public')); // Serve static files from the 'public' folder

// Endpoint to get the current queue
app.get('/queue', (req, res) => res.json(queue));

// Endpoint to add a user to the queue
app.post('/add', (req, res) => {
    const { name, admin, password } = req.body;

    // Verify admin password if admin is true
    if (admin && password !== adminPassword) {
        return res.status(403).json({ message: "Invalid admin password." });
    }

    // Prevent regular users from adding themselves more than once
    if (!admin && queue.includes(name)) {
        return res.status(400).json({ message: "You are already in the queue." });
    }

    // Add name to the queue
    queue.push(name);
    res.json(queue);
});

// Endpoint to remove a user from the queue
app.post('/remove', (req, res) => {
    const { name, admin, password } = req.body;

    // Verify admin password if admin is true
    if (admin && password !== adminPassword) {
        return res.status(403).json({ message: "Invalid admin password." });
    }

    // Remove the specified name from the queue
    queue = queue.filter(person => person !== name);
    res.json(queue);
});

// New endpoint to remove the top player in the queue
app.post('/remove-top', (req, res) => {
    if (queue.length > 0) {
        queue.shift(); // Remove the first (top) player in the queue
    }
    res.json(queue);
});

// Start the server
app.listen(PORT, () => console.log(`Server is running on http://localhost:${PORT}`));
