require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { Telegraf } = require('telegraf');

const app = express();
app.use(cors());
app.use(express.json());
// Serve static files from root directory (where your HTML is)
app.use(express.static(__dirname));

// ---------- CONFIGURATION ----------
const BOT_TOKEN = process.env.BOT_TOKEN;
const GROUP_ID = process.env.CHAT_ID || -1003984859530;
const GROUP_LINK = "https://t.me/gangs234";
const PENALTY_MINUTES = 30;
const WIN_REWARD = 0.1;
const APP_URL = process.env.APP_URL || "https://your-app.onrender.com";

// ---------- TELEGRAM BOT SETUP ----------
const bot = new Telegraf(BOT_TOKEN);

// ---------- JSON FILE STORAGE ----------
const DATA_FILE = path.join(__dirname, 'users.json');

if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2));
}

function readUsers() {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return {};
    }
}

function writeUsers(users) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));
}

function getUser(userId, username = null) {
    const users = readUsers();
    if (!users[userId]) {
        users[userId] = {
            user_id: userId,
            username: username,
            balance: 0,
            loss_streak: 0,
            penalty_end: 0,
            games_played: 0,
            wins: 0,
            verified: false,
            created_at: Date.now()
        };
        writeUsers(users);
    }
    return users[userId];
}

function updateUser(userId, updates) {
    const users = readUsers();
    if (!users[userId]) {
        users[userId] = { user_id: userId, created_at: Date.now() };
    }
    Object.assign(users[userId], updates);
    writeUsers(users);
}

// ---------- MEMBERSHIP CHECK ----------
async function isMember(userId, ctx) {
    try {
        const member = await ctx.telegram.getChatMember(GROUP_ID, userId);
        const isMemberStatus = ['member', 'administrator', 'creator'].includes(member.status);
        if (isMemberStatus) {
            updateUser(userId, { verified: true });
            return true;
        }
        return false;
    } catch (error) {
        console.error('Membership check error:', error);
        return false;
    }
}

// ---------- BOT COMMANDS ----------
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const firstName = ctx.from.first_name;
    const userName = ctx.from.username;
    
    // Check membership
    const member = await isMember(userId, ctx);
    const userData = getUser(userId);
    
    if (member) {
        const welcomeMessage = `🎉 *WELCOME BACK ${firstName.toUpperCase()}!* 🎉

✅ You are already a verified member!

━━━━━━━━━━━━━━━━━━━━
💰 *BALANCE:* $${userData.balance.toFixed(2)}
🏆 *WINS:* ${userData.wins}
🎮 *GAMES PLAYED:* ${userData.games_played}
💀 *LOSS STREAK:* ${userData.loss_streak}/3
━━━━━━━━━━━━━━━━━━━━

⚡ *IMPOSSIBLE MODE ACTIVE*
Bot uses perfect AI - You can NEVER win!

🎮 *Click the button below to play!*`;
        
        const keyboard = {
            inline_keyboard: [
                [{ text: "🎮 PLAY TIC-TAC-TOE", web_app: { url: `${APP_URL}/index.html` } }],
                [{ text: "💰 BALANCE", callback_data: "balance" }, { text: "📊 STATS", callback_data: "stats" }],
                [{ text: "📢 COMMUNITY", url: GROUP_LINK }]
            ]
        };
        
        await ctx.replyWithMarkdown(welcomeMessage, { reply_markup: keyboard });
    } else {
        const welcomeMessage = `👋 *HELLO ${firstName.toUpperCase()}!* 👋

━━━━━━━━━━━━━━━━━━━━
🎮 *IMPOSSIBLE TIC-TAC-TOE BOT*
━━━━━━━━━━━━━━━━━━━━

⚠️ *FIRST, JOIN OUR COMMUNITY:*
👉 ${GROUP_LINK}

✅ *After joining, click /verify*

━━━━━━━━━━━━━━━━━━━━
💰 *HOW IT WORKS:*
• Beat the bot? +$${WIN_REWARD} (IMPOSSIBLE!)
• Lose 3 times → ${PENALTY_MINUTES}min penalty
• Use /watchad to remove penalty

━━━━━━━━━━━━━━━━━━━━
📱 *COMMANDS:*
/play - Start game
/verify - Check membership
/balance - Check balance
/stats - Your stats
/watchad - Remove penalty
━━━━━━━━━━━━━━━━━━━━`;
        
        const keyboard = {
            inline_keyboard: [
                [{ text: "📢 JOIN COMMUNITY", url: GROUP_LINK }],
                [{ text: "✅ VERIFY", callback_data: "verify" }]
            ]
        };
        
        await ctx.replyWithMarkdown(welcomeMessage, { reply_markup: keyboard });
    }
});

bot.command('verify', async (ctx) => {
    const userId = ctx.from.id;
    const firstName = ctx.from.first_name;
    
    await ctx.reply("🔍 Checking your membership...");
    
    const member = await isMember(userId, ctx);
    
    if (member) {
        updateUser(userId, { verified: true });
        const userData = getUser(userId);
        
        await ctx.replyWithMarkdown(
            `✅ *VERIFIED!* ✅\n\n` +
            `Welcome ${firstName}!\n\n` +
            `💰 Balance: $${userData.balance.toFixed(2)}\n` +
            `🏆 Wins: ${userData.wins}\n\n` +
            `🎮 Click below to start playing:`,
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "🎮 PLAY GAME 🎮", web_app: { url: `${APP_URL}/index.html` } }]
                    ]
                }
            }
        );
    } else {
        await ctx.replyWithMarkdown(
            `❌ *NOT VERIFIED* ❌\n\n` +
            `Please join: ${GROUP_LINK}\n\n` +
            `Then click /verify again.\n\n` +
            `⚠️ Make sure the bot is admin of the group!`
        );
    }
});

bot.command('play', async (ctx) => {
    const userId = ctx.from.id;
    
    // Check membership
    const member = await isMember(userId, ctx);
    
    if (!member) {
        await ctx.replyWithMarkdown(
            `❌ *Access Denied* ❌\n\n` +
            `You must join our community first:\n` +
            `${GROUP_LINK}\n\n` +
            `After joining, send /verify`
        );
        return;
    }
    
    const userData = getUser(userId);
    const now = Math.floor(Date.now() / 1000);
    
    if (userData.penalty_end > now) {
        const remain = userData.penalty_end - now;
        const minutes = Math.floor(remain / 60);
        const seconds = remain % 60;
        await ctx.replyWithMarkdown(
            `⛔ *PENALTY ACTIVE* ⛔\n\n` +
            `Time remaining: ${minutes}m ${seconds}s\n` +
            `Use /watchad to unlock immediately.`
        );
        return;
    }
    
    // Clear expired penalty
    if (userData.penalty_end > 0) {
        updateUser(userId, { penalty_end: 0, loss_streak: 0 });
    }
    
    await ctx.replyWithMarkdown(
        `🎮 *Starting Game!* 🎮\n\n` +
        `Click below to play against the unbeatable bot:`,
        {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🎮 PLAY TIC-TAC-TOE", web_app: { url: `${APP_URL}/index.html` } }]
                ]
            }
        }
    );
});

bot.command('balance', async (ctx) => {
    const userId = ctx.from.id;
    const userData = getUser(userId);
    await ctx.replyWithMarkdown(
        `💰 *Your Balance* 💰\n\n` +
        `💵 $${userData.balance.toFixed(2)}\n\n` +
        `🏆 Wins: ${userData.wins}\n` +
        `🎮 Games played: ${userData.games_played}\n` +
        `💀 Loss streak: ${userData.loss_streak}/3\n\n` +
        `Win reward: +$${WIN_REWARD}`
    );
});

bot.command('stats', async (ctx) => {
    const userId = ctx.from.id;
    const userData = getUser(userId);
    const winRate = userData.games_played > 0 ? (userData.wins / userData.games_played * 100).toFixed(1) : 0;
    
    await ctx.replyWithMarkdown(
        `📊 *Your Statistics* 📊\n\n` +
        `🎮 Games played: ${userData.games_played}\n` +
        `🏆 Wins: ${userData.wins}\n` +
        `💀 Loss streak: ${userData.loss_streak}/3\n` +
        `💰 Balance: $${userData.balance.toFixed(2)}\n` +
        `📈 Win rate: ${winRate}%\n` +
        `✅ Verified: ${userData.verified ? 'Yes' : 'No'}\n\n` +
        `⚠️ Bot is unbeatable - winning is a miracle!`
    );
});

bot.command('watchad', async (ctx) => {
    const userId = ctx.from.id;
    const userData = getUser(userId);
    const now = Math.floor(Date.now() / 1000);
    
    if (userData.penalty_end <= now) {
        await ctx.replyWithMarkdown(
            "📺 *No active penalty*\n\n" +
            "You can play normally. Use /play to start a game!"
        );
        return;
    }
    
    // Simulate ad watch
    updateUser(userId, { penalty_end: 0, loss_streak: 0 });
    
    // Post to group
    try {
        await bot.telegram.sendMessage(
            GROUP_ID,
            `📺 ${ctx.from.first_name} watched an ad to remove penalty!`
        );
    } catch(e) {
        console.error('Failed to post to group:', e);
    }
    
    await ctx.replyWithMarkdown(
        "✅ *Ad Watched!* ✅\n\n" +
        "🔓 Penalty removed!\n" +
        "🎮 Use /play to start a new game!"
    );
});

// Handle callback queries
bot.action('balance', async (ctx) => {
    const userId = ctx.from.id;
    const userData = getUser(userId);
    await ctx.answerCbQuery();
    await ctx.replyWithMarkdown(`💰 Balance: $${userData.balance.toFixed(2)}`);
});

bot.action('stats', async (ctx) => {
    const userId = ctx.from.id;
    const userData = getUser(userId);
    const winRate = userData.games_played > 0 ? (userData.wins / userData.games_played * 100).toFixed(1) : 0;
    await ctx.answerCbQuery();
    await ctx.replyWithMarkdown(
        `📊 Games: ${userData.games_played} | Wins: ${userData.wins} | Win rate: ${winRate}%`
    );
});

bot.action('verify', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const member = await isMember(userId, ctx);
    
    if (member) {
        updateUser(userId, { verified: true });
        await ctx.replyWithMarkdown(
            `✅ *VERIFIED!* Use /play to start!`
        );
    } else {
        await ctx.replyWithMarkdown(
            `❌ Please join ${GROUP_LINK} first!`
        );
    }
});

// ---------- API ENDPOINTS FOR FRONTEND ----------

// Verify membership from mini app
app.post('/api/verify', async (req, res) => {
    const { telegramId } = req.body;
    
    if (!telegramId) {
        return res.status(400).json({ ok: false, error: 'No telegramId' });
    }
    
    try {
        // Create a fake context to use isMember function
        const fakeCtx = { telegram: bot.telegram };
        const member = await isMember(telegramId, fakeCtx);
        
        if (member) {
            const userData = getUser(telegramId);
            res.json({ 
                ok: true, 
                message: 'Welcome! You are verified!',
                balance: userData.balance,
                lossStreak: userData.loss_streak,
                wins: userData.wins
            });
        } else {
            res.json({ 
                ok: false, 
                error: 'Please join the community first.' 
            });
        }
    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({ ok: false, error: 'Server error' });
    }
});

// Get user data
app.get('/api/user/:userId', async (req, res) => {
    const userId = parseInt(req.params.userId);
    const userData = getUser(userId);
    const now = Math.floor(Date.now() / 1000);
    
    res.json({
        balance: userData.balance,
        loss_streak: userData.loss_streak,
        penalty_end: userData.penalty_end,
        penalty_active: userData.penalty_end > now,
        penalty_remaining: Math.max(0, userData.penalty_end - now),
        verified: userData.verified,
        games_played: userData.games_played,
        wins: userData.wins
    });
});

// Save game result
app.post('/api/game/result', async (req, res) => {
    const { userId, result } = req.body;
    const userData = getUser(userId);
    const now = Math.floor(Date.now() / 1000);
    
    if (userData.penalty_end > now) {
        return res.json({ success: false, error: "Penalty active" });
    }
    
    let response = { success: true };
    
    if (result === 'win') {
        const newBalance = userData.balance + WIN_REWARD;
        updateUser(userId, {
            balance: newBalance,
            loss_streak: 0,
            games_played: userData.games_played + 1,
            wins: userData.wins + 1
        });
        response.balance = newBalance;
        response.message = `🎉 WIN! +$${WIN_REWARD}`;
        
        // Post to group
        try {
            await bot.telegram.sendMessage(GROUP_ID, `🏆 MIRACLE! ${userData.username || 'User'} won and earned $${WIN_REWARD}!`);
        } catch(e) {
            console.error('Failed to post to group:', e);
        }
        
    } else if (result === 'loss') {
        const newLossStreak = userData.loss_streak + 1;
        let penaltyEnd = userData.penalty_end;
        let penaltyTriggered = false;
        
        if (newLossStreak >= 3) {
            penaltyEnd = now + (PENALTY_MINUTES * 60);
            penaltyTriggered = true;
            response.penalty_active = true;
            response.penalty_end = penaltyEnd;
            
            try {
                await bot.telegram.sendMessage(GROUP_ID, `⚠️ ${userData.username || 'User'} lost 3 times! Penalty activated for 30 minutes.`);
            } catch(e) {
                console.error('Failed to post to group:', e);
            }
        }
        
        updateUser(userId, {
            loss_streak: newLossStreak,
            penalty_end: penaltyEnd,
            games_played: userData.games_played + 1
        });
        
        response.loss_streak = newLossStreak;
        response.message = penaltyTriggered ? "❌ PENALTY ACTIVATED! 30min lock." : "💀 Bot wins!";
        
    } else if (result === 'draw') {
        updateUser(userId, {
            games_played: userData.games_played + 1
        });
        response.message = "🤝 Draw!";
    }
    
    res.json(response);
});

// Watch ad to remove penalty
app.post('/api/watchad', async (req, res) => {
    const { userId } = req.body;
    const userData = getUser(userId);
    const now = Math.floor(Date.now() / 1000);
    
    if (userData.penalty_end <= now) {
        return res.json({ success: false, message: "No active penalty" });
    }
    
    updateUser(userId, { penalty_end: 0, loss_streak: 0 });
    
    try {
        await bot.telegram.sendMessage(GROUP_ID, `📺 ${userData.username || 'User'} watched an ad to remove penalty!`);
    } catch(e) {
        console.error('Failed to post to group:', e);
    }
    
    res.json({ success: true, message: "Penalty removed!" });
});

// Post to group (for frontend)
app.post('/api/post-to-group', async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ ok: false });
    
    try {
        await bot.telegram.sendMessage(GROUP_ID, message);
        res.json({ ok: true });
    } catch (error) {
        console.error('Post to group error:', error);
        res.status(500).json({ ok: false });
    }
});

// Serve the HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        bot: '@tictactoe1st_bot',
        timestamp: new Date().toISOString(),
        group_id: GROUP_ID
    });
});

// ---------- START SERVER ----------
const PORT = process.env.PORT || 3000;

// Launch bot
bot.launch().then(() => {
    console.log('🤖 Bot @tictactoe1st_bot is running...');
    console.log(`📢 Group ID: ${GROUP_ID}`);
    console.log(`🌐 Mini App URL: ${APP_URL}`);
    console.log(`📁 HTML file location: ${path.join(__dirname, 'index.html')}`);
    console.log(`✅ Bot is ready!`);
}).catch((err) => {
    console.error('Bot launch error:', err);
});

// Start express server
app.listen(PORT, () => {
    console.log(`🌐 Web server running on port ${PORT}`);
    console.log(`📍 Open http://localhost:${PORT} to test locally`);
});

// Graceful stop
process.once('SIGINT', () => {
    bot.stop('SIGINT');
    process.exit(0);
});
process.once('SIGTERM', () => {
    bot.stop('SIGTERM');
    process.exit(0);
});
