require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // serve frontend

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID; // -1003984859530

// Verify if a user is a member of the group/channel
app.post('/api/verify', async (req, res) => {
    const { telegramId } = req.body;
    if (!telegramId) return res.status(400).json({ ok: false, error: 'No telegramId' });

    try {
        const url = `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: CHAT_ID, user_id: telegramId })
        });
        const data = await response.json();
        if (data.ok) {
            const status = data.result.status;
            // member, administrator, creator are approved
            const isMember = ['member', 'administrator', 'creator'].includes(status);
            if (isMember) return res.json({ ok: true, message: 'Welcome!' });
            else return res.json({ ok: false, error: 'Please join the community first.' });
        } else {
            return res.status(400).json({ ok: false, error: 'Invalid user or bot not admin.' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, error: 'Server error' });
    }
});

// Post a message to the group/channel
app.post('/api/post-to-group', async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ ok: false });

    try {
        const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: CHAT_ID, text: message, parse_mode: 'HTML' })
        });
        const data = await response.json();
        if (data.ok) res.json({ ok: true });
        else res.status(500).json({ ok: false, error: data.description });
    } catch (err) {
        res.status(500).json({ ok: false });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
