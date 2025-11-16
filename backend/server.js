const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs/promises'); // NEW: For file system
const path = require('path'); // NEW: For file paths

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// --- PASTE YOUR URL FROM TEAMS HERE ---
const TEAMS_WEBHOOK_URL = 'https://iitgoffice.webhook.office.com/webhookb2/e2e4aa8f-fa6d-4187-b317-500f95139baf@850aa78d-94e1-4bc6-9cf3-8c11b530701c/IncomingWebhook/5817b4c72b50460f96e04dec15ca5e79/a1e8034b-6795-438f-913d-d802b8f572e7/V2h89Ia0XQxvnE6dPZMYB6XXsJva25HQcOpu9EsuGxnf41';

// --- NEW: State Management & Persistence ---

const DB_FILE = path.join(__dirname, 'chai_db.json');

// This is the default state if no DB file is found
const INITIAL_STATE = {
    payers: [
        "Pradeep",
        "Rohan Dayal",
        "Tapish",
        "Shashank",
        "Vasu",
        "Naman",
        "Abhilash",
        "saruav",
        "Sarthak",
        "Devansh",
        "Ashwin",
        "Rohit",
    ].map(name => ({
        name: name,
        count: 0,
        amount: 0,
        ratio: 0 // We will sort by this (amount / count)
    }))
};

// This variable will hold our application's state in memory
let state = { payers: [] };

/**
 * Writes the current in-memory state to the JSON file
 */
const writeDb = async () => {
    try {
        await fs.writeFile(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
    } catch (error) {
        console.error("Error writing to DB file:", error.message);
    }
};

/**
 * Reads the state from the JSON file into memory when the server starts.
 * If the file doesn't exist, it creates one with the initial state.
 */
const readDb = async () => {
    try {
        const data = await fs.readFile(DB_FILE, 'utf-8');
        state = JSON.parse(data);
        if (!state.payers) { // Basic validation
            throw new Error('Invalid DB file structure.');
        }
        console.log("Loaded state from chai_db.json");
    } catch (error) {
        console.warn("WARN: Could not read DB file. Using initial state.", error.message);
        state = INITIAL_STATE;
        await writeDb(); // Create the file
    }
};

/**
 * Returns a new array of payers, sorted by their ratio (ASC)
 * This simulates the "min-heap"
 */
const getSortedPayers = () => {
    // Sorts the list by ratio.
    // If ratio is the same, it will keep its relative order.
    return state.payers.sort((a, b) => a.ratio - b.ratio);
};

// --- End of State Management ---


// --- NEW: Updated Teams Notification ---
// --- NOTE: This function is NO LONGER CALLED in the new logic ---
const sendTeamsNotification = async (payer1Name, payer2Name, amount, nextPayer1Name, nextPayer2Name) => {
    if (!TEAMS_WEBHOOK_URL.startsWith('http')) {
        console.warn('TEAMS_WEBHOOK_URL is not set. Skipping notification.');
        return;
    }

    const totalAmount = (amount || 0).toFixed(2);
    
    // Updated message for two payers
    const message = {
        "text": `☕ Thanks to **${payer1Name}** and **${payer2Name}** for the chaii! (Total: ₹${totalAmount}) 🎉\n\n**Next up:** ${nextPayer1Name} and ${nextPayer2Name}`
    };

    try {
        await axios.post(TEAMS_WEBHOOK_URL, message, {
            headers: { 'Content-Type': 'application/json' }
        });
        console.log(`Sent notification to Teams: ${payer1Name} & ${payer2Name} paid.`);
    } catch (error) {
        console.error('Error sending notification to Teams:', error.message);
    }
};


// --- Express App Setup ---
app.use(cors({ "origin": "*", "methods": "GET,HEAD,PUT,PATCH,POST,DELETE" }));
app.use(express.json());

/**
 * @route   GET /api/turn
 * @desc    Get the current list of payers, sorted by who should pay next
 */
app.get('/api/turn', (req, res) => {
    // We always return the list sorted by the ratio
    const sortedPayers = getSortedPayers();
    res.json(sortedPayers);
});

/**
 * @route   POST /api/update
 * @desc    Manually update the stats for a single payer
 * @body    { "name": "Sarthak and Devansh", "amount": 150, "count": 1 }
 */
app.post('/api/update', async (req, res) => {
    const { name, amount, count } = req.body;

    // --- Validation ---
    if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'Request body must include a valid "name".' });
    }
    if (typeof amount !== 'number' || amount < 0) {
        return res.status(400).json({ error: 'Request body must include a valid, non-negative "amount".' });
    }
    // Ensure count is a whole number
    if (typeof count !== 'number' || count < 0 || !Number.isInteger(count)) {
        return res.status(400).json({ error: 'Request body must include a valid, non-negative integer "count".' });
    }
    // --- End Validation ---

    // 1. Find the payer in our state
    const payer = state.payers.find(p => p.name === name);

    if (!payer) {
        return res.status(404).json({ error: `Payer with name "${name}" not found.` });
    }

    // 2. Update their stats (overwrite)
    payer.amount = amount;
    payer.count = count;
    
    // 3. Recalculate the ratio
    // Avoid division by zero
    payer.ratio = (count > 0) ? (amount / count) : 0;

    console.log(`Manually Updated ${payer.name}: Amount=${amount}, Count=${count}, Ratio=${payer.ratio}`);

    // 4. Save the new state to our JSON file
    await writeDb();
    
    // 5. Respond with the new, re-sorted list
    res.json(getSortedPayers());
});


/**
 * Main function to start the server
 */
const startServer = async () => {
    // We MUST read the DB before we start listening for requests
    await readDb();
    
    app.listen(PORT, HOST, () => {
        console.log(`Chaii server running on http://${HOST}:${PORT}`);
        console.log("Current Payer State (Sorted by Ratio):");
        console.table(getSortedPayers());
    });
};

// Start the server
startServer();