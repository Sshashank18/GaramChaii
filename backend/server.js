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

// If running on Fly.io (production), use the mounted volume.
// If running locally, use the local folder.
const DB_FILE = process.env.NODE_ENV === 'production' 
    ? '/data/chai_db.json' 
    : path.join(__dirname, 'chai_db.json');

const INITIAL_STATE = {
    payers: [
        "Pradeep", "Rohan Dayal", "Tapish", "Shashank", "Vasu", "Naman",
        "Abhilash", "saruav", "Sarthak", "Devansh", "Ashwin", "Rohit",
    ].map(name => ({
        name,
        count: 0,           // Times paid
        amount: 0,          // Total amount paid
        attendanceCount: 0, // NEW: Times attended
        ratio: 0            // NEW: Calculated as amount / attendanceCount
    }))
};

let state = { payers: [] };

/**
 * Recalculates the ratio using the new logic:
 * (Amount / Attendance) * PaidCount
 */
const recalculateAllRatios = () => {
    state.payers.forEach(p => {
        // Avoid division by zero
        if (p.attendanceCount > 0) {
            // The requested formula:
            p.ratio = (p.amount / p.attendanceCount) * p.count;
        } else {
            p.ratio = 0;
        }
    });
};

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

        // --- Migration Check ---
        let needsResave = false;
        state.payers.forEach(p => {
            if (p.attendanceCount === undefined) {
                p.attendanceCount = p.count || 0; 
                needsResave = true;
            }
        });

        // --- CRITICAL CHANGE HERE ---
        // We calculate ratios immediately after loading. 
        // This updates the logic in memory without altering the raw data (amount/count) in the file yet.
        recalculateAllRatios(); 

        if (needsResave) {
            console.warn("Hydrating old DB file with 'attendanceCount' field...");
            await writeDb(); 
        }
        
        console.log("Loaded state from chai_db.json with NEW ratio logic.");
    } catch (error) {
        console.warn("WARN: Could not read DB file. Using initial state.", error.message);
        state = INITIAL_STATE;
        // Apply logic to initial state too
        recalculateAllRatios();
        await writeDb();
    }
};

const getSortedPayers = () => {
    // Sort by the ratio (amount / attendanceCount).
    // Lowest ratio (paid least per attendance) pays next.
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

// Notification function for "Next Turn"
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
    // --- UPDATED: Now expects 'amount' and 'attendees' array ---
    const { amount, attendees } = req.body;

    // --- UPDATED: Validation ---
    if (typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ error: 'Request body must include a valid "amount".' });
    }
    if (!Array.isArray(attendees) || attendees.length === 0) {
        return res.status(400).json({ error: 'Request body must include a non-empty "attendees" array.' });
    }
    if (state.payers.length < 2) {
        return res.status(400).json({ error: 'Not enough payers in the list.' });
    }

    const sortedPayers = getSortedPayers();
    const payer1 = sortedPayers[0];
    const payer2 = sortedPayers[1];
    const amountPerPayer = amount / 2;

    // Update the two payers
    payer1.count++;
    payer1.amount += amountPerPayer;
    
    payer2.count++;
    payer2.amount += amountPerPayer;

    // --- NEW: Update attendance for everyone present ---
    attendees.forEach(name => {
        const payer = state.payers.find(p => p.name === name);
        if (payer) {
            payer.attendanceCount++;
        } else {
            console.warn(`Attendee "${name}" not found in payers list.`);
        }
    });

    // --- NEW: Recalculate ratios for ALL payers ---
    recalculateAllRatios();
  
    await writeDb();

    // Get the *new* sorted list to find the next payers
    const nextSortedPayers = getSortedPayers();
    const nextPayer1Name = nextSortedPayers[0] ? nextSortedPayers[0].name : "N/A";
    const nextPayer2Name = nextSortedPayers[1] ? nextSortedPayers[1].name : "N/A";

    sendPaymentNotification(payer1.name, payer2.name, amount, nextPayer1Name, nextPayer2Name);
    res.json(getSortedPayers()); // Send the final sorted list back
});

// POST to send a notification WITHOUT paying
app.post('/api/notify', async (req, res) => {
    const sortedPayers = getSortedPayers();
    if (state.payers.length < 2) {
        return res.status(400).json({ error: 'Not enough payers to notify.' });
    }
    
    const nextPayer1Name = sortedPayers[0] ? sortedPayers[0].name : "N/A";
    const nextPayer2Name = sortedPayers[1] ? sortedPayers[1].name : "N/A";

    await sendNextTurnNotification(nextPayer1Name, nextPayer2Name);
    res.status(200).json({ message: 'Notification sent successfully.' });
});

// POST to *manually update* (updates data, no notification)
app.post('/api/update', async (req, res) => {
    // --- UPDATED: Now accepts 'attendanceCount' ---
    const { name, amount, count, attendanceCount } = req.body;

    // --- UPDATED: Validation ---
    if (!name || 
        typeof amount !== 'number' || 
        typeof count !== 'number' || 
        typeof attendanceCount !== 'number' || // Check new field
        amount < 0 || count < 0 || attendanceCount < 0 || // Check new field
        !Number.isInteger(count) || !Number.isInteger(attendanceCount)) { // Check new field
        return res.status(400).json({ error: 'Invalid payload. Must include name, amount, count, and attendanceCount.' });
    }
    const payer = state.payers.find(p => p.name === name);
    if (!payer) {
        return res.status(404).json({ error: `Payer not found.` });
    }

    // --- UPDATED: Set all fields ---
    payer.amount = amount;
    payer.count = count;
    payer.attendanceCount = attendanceCount;
    payer.ratio = (attendanceCount > 0) ? (amount / attendanceCount) : 0; // Use new ratio logic

    await writeDb();
    res.json(getSortedPayers());
});

// Start the server
const startServer = async () => {
    await readDb(); // Reads DB and performs migration if needed
    app.listen(PORT, HOST, () => {
        console.log(`Chaii server running on http://${HOST}:${PORT}`);
        console.table(getSortedPayers());
    });
};
startServer();