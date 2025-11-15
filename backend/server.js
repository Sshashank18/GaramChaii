const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3001;
const axios = require('axios'); // NEW: Import axios

app.use(cors(
    {
        "origin": "*",
        "methods": "GET,HEAD,PUT,PATCH,POST,DELETE",
    }
));
app.use(express.json());

// --- PASTE YOUR URL FROM TEAMS HERE ---
const TEAMS_WEBHOOK_URL = 'https://iitgoffice.webhook.office.com/webhookb2/e2e4aa8f-fa6d-4187-b317-500f95139baf@850aa78d-94e1-4bc6-9cf3-8c11b530701c/IncomingWebhook/5817b4c72b50460f96e04dec15ca5e79/a1e8034b-6795-438f-913d-d802b8f572e7/V2h89Ia0XQxvnE6dPZMYB6XXsJva25HQcOpu9EsuGxnf41'; // NEW

// --- This is our "database" for this quick app ---
let payers = [
    "Pradeep and Rohan Dayal",
    "Tapish and Shashank",
    "Vasu and Naman",
    "Abhilash And saruav",
    "Sarthak and Devansh",
    "Ashwin and Rohit",
];

// NEW: Function to send a message to Teams
// We make this async so it doesn't block our main code.
const sendTeamsNotification = async (payerName, nextPayerName) => {
    // Check if the user has actually pasted the URL
    if (!TEAMS_WEBHOOK_URL.startsWith('http')) {
        console.warn('TEAMS_WEBHOOK_URL is not set. Skipping notification.');
        return; // Don't try to send a message
    }

    // This is the message format Teams expects
    const message = {
        "text": `☕ Thanks to **${payerName}** for the chaii! 🎉\n\n**Next turn:** ${nextPayerName}`
    };

    try {
        // Send the message!
        await axios.post(TEAMS_WEBHOOK_URL, message, {
            headers: { 'Content-Type': 'application/json' }
        });
        console.log(`Sent notification to Teams: ${payerName} paid.`);
    } catch (error) {
        // Log an error if Teams is down or the URL is wrong
        console.error('Error sending notification to Teams:', error.message);
    }
};

/**
 * @route   GET /api/turn
 * @desc    Get the current list of payers
 */
app.get('/api/turn', (req, res) => {
    res.json(payers);
});

/**
 * @route   POST /api/next
 * @desc    Move the current payer to the back of the line
 */
app.post('/api/next', (req, res) => {
    if (payers.length === 0) {
        return res.status(400).json({ error: 'No payers in the list.' });
    }

    // 1. Take the first person (current payer)
    const currentPayer = payers.shift();

    // 2. Push them to the back of the list
    payers.push(currentPayer);

    // 3. Get the name of the *next* person
    const nextPayer = payers.length > 0 ? payers[0] : "N/A";

    // 4. NEW: Send the notification. 
    // We call the function but don't 'await' it.
    // This lets the server send the response to React immediately
    // while the notification is sent in the background (fire-and-forget).
    sendTeamsNotification(currentPayer, nextPayer);

    // 5. Return the new list to React
    res.json(payers);
});

app.listen(PORT, () => {
    console.log(`Chaii server running on http://localhost:${PORT}`);
    console.log("Current Payer List:", payers);
});