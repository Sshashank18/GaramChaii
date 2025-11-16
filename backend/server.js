const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

//Do "fly deploy" if changes

// --- PASTE YOUR URL FROM TEAMS HERE ---
const TEAMS_WEBHOOK_URL = 'https://iitgoffice.webhook.office.com/webhookb2/e2e4aa8f-fa6d-4187-b317-500f95139baf@850aa78d-94e1-4bc6-9cf3-8c11b530701c/IncomingWebhook/5817b4c72b50460f96e04dec15ca5e79/a1e8034b-6795-438f-913d-d802b8f572e7/V2h89Ia0XQxvnE6dPZMYB6XXsJva25HQcOpu9EsuGxnf41';

// --- State Management & Persistence ---

const DB_FILE = path.join(__dirname, 'chai_db.json');

const INITIAL_STATE = {
    payers: [
        "Pradeep", "Rohan Dayal", "Tapish", "Shashank", "Vasu", "Naman",
        "Abhilash", "saruav", "Sarthak", "Devansh", "Ashwin", "Rohit",
    ].map(name => ({ name, count: 0, amount: 0, ratio: 0 }))
};

let state = { payers: [] };

const writeDb = async () => {
    try {
        await fs.writeFile(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
    } catch (error) { console.error("Error writing to DB file:", error.message); }
};

const readDb = async () => {
    try {
        const data = await fs.readFile(DB_FILE, 'utf-8');
        state = JSON.parse(data);
        if (!state.payers) { throw new Error('Invalid DB file structure.'); }
        console.log("Loaded state from chai_db.json");
    } catch (error) {
        console.warn("WARN: Could not read DB file. Using initial state.", error.message);
        state = INITIAL_STATE;
        await writeDb();
    }
};

const getSortedPayers = () => {
    return state.payers.sort((a, b) => a.ratio - b.ratio);
};

// --- Teams Notifications ---

// Notification for *paying*
const sendPaymentNotification = async (payer1Name, payer2Name, amount, nextPayer1Name, nextPayer2Name) => {
    if (!TEAMS_WEBHOOK_URL.startsWith('http')) return;
    const message = {
        "text": `☕ Thanks to **${payer1Name}** and **${payer2Name}** for the chaii! (Total: ₹${(amount || 0).toFixed(2)}) 🎉\n\n**Next up:** ${nextPayer1Name} and ${nextPayer2Name}`
    };
    try {
        await axios.post(TEAMS_WEBHOOK_URL, message, { headers: { 'Content-Type': 'application/json' } });
        console.log(`Sent PAYMENT notification to Teams.`);
    } catch (error) { console.error('Error sending notification:', error.message); }
};

// --- NEW: Notification function for "Next Turn" ---
const sendNextTurnNotification = async (nextPayer1Name, nextPayer2Name) => {
    if (!TEAMS_WEBHOOK_URL.startsWith('http')) {
        console.warn('TEAMS_WEBHOOK_URL is not set. Skipping notification.');
        return;
    }
    const message = {
        "text": `🔔 **Reminder:** The next two to pay for chaii are **${nextPayer1Name}** and **${nextPayer2Name}**!`
    };
    try {
        await axios.post(TEAMS_WEBHOOK_URL, message, { headers: { 'Content-Type': 'application/json' } });
        console.log(`Sent NEXT TURN reminder notification to Teams.`);
    } catch (error) {
        console.error('Error sending notification:', error.message);
    }
};


// --- Express App Setup ---
app.use(cors({ "origin": "*", "methods": "GET,HEAD,PUT,PATCH,POST,DELETE" }));
app.use(express.json());

// GET the sorted list
app.get('/api/turn', (req, res) => {
    res.json(getSortedPayers());
});

// POST to *pay* (updates data, sends payment notification)
app.post('/api/pay', async (req, res) => {
    const { amount } = req.body;
    if (typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ error: 'Request body must include a valid "amount".' });
    }
    if (state.payers.length < 2) {
        return res.status(400).json({ error: 'Not enough payers in the list.' });
    }

    const sortedPayers = getSortedPayers();
    const payer1 = sortedPayers[0];
    const payer2 = sortedPayers[1];
    const amountPerPayer = amount / 2;

    payer1.count++;
    payer1.amount += amountPerPayer;
    payer1.ratio = payer1.amount / payer1.count;
    payer2.count++;
    payer2.amount += amountPerPayer;
    payer2.ratio = payer2.amount / payer2.count;

    await writeDb();

    const nextPayer1Name = sortedPayers[2] ? sortedPayers[2].name : "N/A";
    const nextPayer2Name = sortedPayers[3] ? sortedPayers[3].name : "N/A";

    sendPaymentNotification(payer1.name, payer2.name, amount, nextPayer1Name, nextPayer2Name);
    res.json(getSortedPayers());
});

// --- NEW: Endpoint to send a notification WITHOUT paying ---
app.post('/api/notify', async (req, res) => {
    const sortedPayers = getSortedPayers();
    if (state.payers.length < 2) {
        return res.status(400).json({ error: 'Not enough payers to notify.' });
    }
    
    const nextPayer1Name = sortedPayers[0] ? sortedPayers[0].name : "N/A";
    const nextPayer2Name = sortedPayers[1] ? sortedPayers[1].name : "N/A";

    // Call the new notification function
    await sendNextTurnNotification(nextPayer1Name, nextPayer2Name);

    res.status(200).json({ message: 'Notification sent successfully.' });
});

// POST to *manually update* (updates data, no notification)
app.post('/api/update', async (req, res) => {
    const { name, amount, count } = req.body;
    if (!name || typeof amount !== 'number' || typeof count !== 'number' || amount < 0 || count < 0 || !Number.isInteger(count)) {
        return res.status(400).json({ error: 'Invalid payload.' });
    }
    const payer = state.payers.find(p => p.name === name);
    if (!payer) {
        return res.status(404).json({ error: `Payer not found.` });
    }
    payer.amount = amount;
    payer.count = count;
    payer.ratio = (count > 0) ? (amount / count) : 0;

    await writeDb();
    res.json(getSortedPayers());
});

// Start the server
const startServer = async () => {
    await readDb();
    app.listen(PORT, HOST, () => {
        console.log(`Chaii server running on http://${HOST}:${PORT}`);
        console.table(getSortedPayers());
    });
};
startServer();