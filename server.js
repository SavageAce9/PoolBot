const express = require('express');
const app = express();
const PORT = 3000;

// 1. Initialize the queue and set the admin password
let queue = [];
const adminPassword = "123"; // Use "123" as your admin password

// 2. Set up middleware to parse JSON requests and serve static files from the 'public' folder
app.use(express.json());
app.use(express.static('public'));

// 3. Define endpoint to get the current queue
app.get('/queue', (req, res) => res.json(queue));

// 4. Define endpoint to add a user to the queue
app.post('/add', (req, res) => {
    const { name, admin, password } = req.body;

    // 5. If admin is true, verify the password
    if (admin && password !== adminPassword) {
        return res.status(403).json({ message: "Invalid admin password." });
    }

    // 6. Regular users can only add themselves once
    if (!admin && queue.includes(name)) {
        return res.status(400).json({ message: "You are already in the queue." });
    }

    // 7. Add the name to the queue
    queue.push(name);
    res.json(queue);
});

// 8. Define endpoint to remove a user from the queue
app.post('/remove', (req, res) => {
    const { name, admin, password } = req.body;

    // 9. If admin is true, verify the password
    if (admin && password !== adminPassword) {
        return res.status(403).json({ message: "Invalid admin password." });
    }

    // 10. Remove the name from the queue
    queue = queue.filter(person => person !== name);
    res.json(queue);
});

// 11. Start the server
app.listen(PORT, () => console.log(`Server is running on http://localhost:${PORT}`));
