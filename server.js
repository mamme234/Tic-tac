require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { Telegraf } = require('telegraf');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ---------- CONFIGURATION ----------
const BOT_TOKEN = process.env.BOT_TOKEN;
const GROUP_ID = process.env.CHAT_ID || -1003984859530;
const GROUP_LINK = "https://t.me/gangs234";
const PENALTY_MINUTES = 30;
const WIN_REWARD = 0.1;
const APP_URL = process.env.APP_URL || "https://tic-tac-ip0u.onrender.com";

// Log configuration (without exposing full token)
console.log('🚀 Starting server with config:');
console.log(`   BOT_TOKEN: ${BOT_TOKEN ? BOT_TOKEN.substring(0, 10) + '...' : 'MISSING!'}`);
console.log(`   GROUP_ID: ${GROUP_ID}`);
console.log(`   APP_URL: ${APP_URL}`);
console.log(`   PORT: ${process.env.PORT || 3000}`);

// Check if BOT_TOKEN is configured
if (!BOT_TOKEN) {
    console.error('❌ BOT_TOKEN is not set in environment variables!');
    process.exit(1);
}

// ---------- TELEGRAM BOT ----------
const bot = new Telegraf(BOT_TOKEN);

// ---------- JSON STORAGE ----------
const DATA_FILE = path.join(__dirname, 'users.json');

if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2));
    console.log('✅ Created users.json file');
}

function readUsers() {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading users.json:', error);
        return {};
    }
}

function writeUsers(users) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));
    } catch (error) {
        console.error('Error writing users.json:', error);
    }
}

function getUser(userId, username = null, firstName = null) {
    const users = readUsers();
    if (!users[userId]) {
        users[userId] = {
            user_id: userId,
            username: username,
            first_name: firstName,
            balance: 0,
            total_profit: 0,
            loss_streak: 0,
            penalty_end: 0,
            games_played: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            verified: false,
            created_at: Date.now(),
            last_active: Date.now()
        };
        writeUsers(users);
        console.log(`✅ New user created: ${userId} (${firstName || username || 'Unknown'})`);
    }
    return users[userId];
}

function updateUser(userId, updates) {
    const users = readUsers();
    if (!users[userId]) {
        users[userId] = { user_id: userId, created_at: Date.now() };
    }
    Object.assign(users[userId], updates);
    if (updates.balance !== undefined) {
        users[userId].total_profit = updates.balance;
    }
    writeUsers(users);
    return users[userId];
}

// ---------- MEMBERSHIP CHECK ----------
async function isMember(userId, ctx) {
    try {
        console.log(`Checking membership for user ${userId} in group ${GROUP_ID}`);
        const member = await ctx.telegram.getChatMember(GROUP_ID, userId);
        const ok = ['member', 'administrator', 'creator'].includes(member.status);
        console.log(`User ${userId} membership status: ${member.status}, isMember: ${ok}`);
        if (ok) updateUser(userId, { verified: true });
        return ok;
    } catch (error) {
        console.error('Membership check error:', error.message);
        if (error.response && error.response.error_code === 403) {
            console.error('❌ Bot is not an admin of the group! Add bot as admin first.');
        }
        return false;
    }
}

// ---------- BOT COMMANDS ----------
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const firstName = ctx.from.first_name;
    const username = ctx.from.username;
    
    console.log(`📱 /start from user ${userId} (${firstName})`);
    
    try {
        const userData = getUser(userId, username, firstName);
        const member = await isMember(userId, ctx);
        
        if (member) {
            await ctx.replyWithMarkdown(
                `🎉 *WELCOME BACK ${firstName.toUpperCase()}!* 🎉\n\n` +
                `✅ You are a verified member!\n\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `💰 *BALANCE:* $${(userData.balance || 0).toFixed(2)}\n` +
                `💵 *TOTAL PROFIT:* $${(userData.total_profit || 0).toFixed(2)}\n` +
                `🏆 *WINS:* ${userData.wins || 0}\n` +
                `🎮 *GAMES:* ${userData.games_played || 0}\n` +
                `━━━━━━━━━━━━━━━━━━━━\n\n` +
                `⚡ *IMPOSSIBLE MODE* – Bot never loses!\n\n` +
                `🎮 Tap below to play:`,
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "🎮 PLAY TIC-TAC-TOE", web_app: { url: `${APP_URL}/index.html` } }],
                            [{ text: "💰 BALANCE", callback_data: "balance" }, { text: "📊 STATS", callback_data: "stats" }],
                            [{ text: "🏆 LEADERBOARD", callback_data: "leaderboard" }]
                        ]
                    }
                }
            );
        } else {
            await ctx.replyWithMarkdown(
                `👋 *HELLO ${firstName.toUpperCase()}!*\n\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `🎮 *IMPOSSIBLE TIC-TAC-TOE*\n` +
                `━━━━━━━━━━━━━━━━━━━━\n\n` +
                `⚠️ *First, join our community:*\n` +
                `👉 ${GROUP_LINK}\n\n` +
                `✅ *After joining, send /verify again*\n\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `💰 *HOW IT WORKS:*\n` +
                `• Win? +$${WIN_REWARD} (almost impossible)\n` +
                `• Lose 3 times → ${PENALTY_MINUTES} min penalty\n` +
                `• Use /watchad to remove penalty\n\n` +
                `📱 *COMMANDS:*\n` +
                `/play – Start game\n` +
                `/verify – Check membership\n` +
                `/balance – Balance\n` +
                `/stats – Your stats\n` +
                `/leaderboard – Top players\n` +
                `/watchad – Remove penalty`,
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "📢 JOIN COMMUNITY", url: GROUP_LINK }]
                        ]
                    }
                }
            );
        }
    } catch (err) {
        console.error('Start command error:', err);
        await ctx.reply('❌ An error occurred. Please try again later.');
    }
});

bot.command('verify', async (ctx) => {
    const userId = ctx.from.id;
    console.log(`🔍 /verify from user ${userId}`);
    await ctx.reply("🔍 Checking membership...");
    const ok = await isMember(userId, ctx);
    if (ok) {
        const userData = getUser(userId);
        await ctx.replyWithMarkdown(
            `✅ *VERIFIED!*\n\n` +
            `💰 Balance: $${(userData.balance || 0).toFixed(2)}\n` +
            `🏆 Wins: ${userData.wins || 0}\n\n` +
            `🎮 Tap below to play:`,
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "🎮 PLAY GAME", web_app: { url: `${APP_URL}/index.html` } }]
                    ]
                }
            }
        );
    } else {
        await ctx.replyWithMarkdown(`❌ *Not verified.*\nPlease join ${GROUP_LINK} then /verify again.`);
    }
});

bot.command('play', async (ctx) => {
    const userId = ctx.from.id;
    if (!(await isMember(userId, ctx))) {
        return ctx.replyWithMarkdown(`❌ Join ${GROUP_LINK} first and /verify.`);
    }
    const userData = getUser(userId);
    const now = Math.floor(Date.now() / 1000);
    if (userData.penalty_end > now) {
        const remain = userData.penalty_end - now;
        return ctx.replyWithMarkdown(`⛔ *PENALTY:* ${Math.floor(remain/60)}m ${remain%60}s left.\nUse /watchad to unlock.`);
    }
    if (userData.penalty_end > 0) updateUser(userId, { penalty_end: 0, loss_streak: 0 });
    await ctx.replyWithMarkdown(
        `🎮 *Starting game!*\n💰 Balance: $${(userData.balance || 0).toFixed(2)}`,
        { reply_markup: { inline_keyboard: [[{ text: "🎮 PLAY", web_app: { url: `${APP_URL}/index.html` } }]] } }
    );
});

bot.command('balance', async (ctx) => {
    const userData = getUser(ctx.from.id);
    await ctx.replyWithMarkdown(`💰 *Balance:* $${(userData.balance || 0).toFixed(2)}\n💵 *Total Profit:* $${(userData.total_profit || 0).toFixed(2)}`);
});

bot.command('stats', async (ctx) => {
    const u = getUser(ctx.from.id);
    const winRate = u.games_played ? ((u.wins / u.games_played) * 100).toFixed(1) : 0;
    await ctx.replyWithMarkdown(
        `📊 *YOUR STATS*\n\n` +
        `🎮 Games: ${u.games_played || 0}\n` +
        `🏆 Wins: ${u.wins || 0}\n` +
        `🤝 Draws: ${u.draws || 0}\n` +
        `💀 Losses: ${u.losses || 0}\n` +
        `📈 Win rate: ${winRate}%\n` +
        `💀 Loss streak: ${u.loss_streak || 0}/3\n` +
        `💰 Balance: $${(u.balance || 0).toFixed(2)}`
    );
});

bot.command('leaderboard', async (ctx) => {
    const users = readUsers();
    const topUsers = Object.values(users).sort((a, b) => (b.balance || 0) - (a.balance || 0)).slice(0, 10);
    let text = `🏆 *TOP 10 PLAYERS* 🏆\n\n`;
    topUsers.forEach((u, i) => {
        const name = u.first_name || u.username || `User ${u.user_id}`;
        text += `${i+1}. ${name.substring(0, 20)}\n   💰 $${(u.balance || 0).toFixed(2)} | 🏆 ${u.wins || 0} wins\n\n`;
    });
    await ctx.replyWithMarkdown(text);
});

bot.command('watchad', async (ctx) => {
    const userId = ctx.from.id;
    const u = getUser(userId);
    const now = Math.floor(Date.now() / 1000);
    if (u.penalty_end <= now) return ctx.reply("No active penalty.");
    updateUser(userId, { penalty_end: 0, loss_streak: 0 });
    await ctx.reply("✅ Penalty removed! Use /play");
});

// ---------- CALLBACKS ----------
bot.action('balance', async (ctx) => {
    await ctx.answerCbQuery();
    const u = getUser(ctx.from.id);
    await ctx.reply(`💰 Balance: $${(u.balance || 0).toFixed(2)}`);
});
bot.action('stats', async (ctx) => {
    await ctx.answerCbQuery();
    const u = getUser(ctx.from.id);
    await ctx.reply(`📊 Games: ${u.games_played || 0} | Wins: ${u.wins || 0}`);
});
bot.action('leaderboard', async (ctx) => {
    await ctx.answerCbQuery();
    const users = readUsers();
    const top5 = Object.values(users).sort((a, b) => (b.balance || 0) - (a.balance || 0)).slice(0, 5);
    let text = "🏆 *Top 5*\n";
    top5.forEach((u, i) => {
        text += `${i+1}. ${u.first_name || u.username}: $${(u.balance || 0).toFixed(2)}\n`;
    });
    await ctx.reply(text);
});

// ---------- API FOR MINI APP ----------
app.post('/api/verify', async (req, res) => {
    const { telegramId } = req.body;
    console.log(`🔍 API /verify called for user ${telegramId}`);
    
    if (!telegramId) {
        return res.status(400).json({ ok: false, error: 'No telegramId' });
    }
    
    try {
        const fakeCtx = { telegram: bot.telegram };
        const member = await isMember(telegramId, fakeCtx);
        
        if (!member) {
            return res.json({ ok: false, error: 'Join community first.' });
        }
        
        const u = getUser(telegramId);
        console.log(`✅ User ${telegramId} verified, balance: ${u.balance}`);
        res.json({ 
            ok: true, 
            message: 'Verified!', 
            balance: u.balance || 0, 
            lossStreak: u.loss_streak || 0, 
            wins: u.wins || 0
        });
    } catch (e) {
        console.error('API verify error:', e);
        res.status(500).json({ ok: false, error: 'Server error: ' + e.message });
    }
});

app.get('/api/user/:userId', (req, res) => {
    const userId = parseInt(req.params.userId);
    console.log(`📊 API /user/${userId} called`);
    
    try {
        const u = getUser(userId);
        const now = Math.floor(Date.now() / 1000);
        res.json({
            balance: u.balance || 0,
            loss_streak: u.loss_streak || 0,
            penalty_end: u.penalty_end || 0,
            penalty_active: (u.penalty_end || 0) > now,
            wins: u.wins || 0,
            games_played: u.games_played || 0,
            draws: u.draws || 0,
            losses: u.losses || 0
        });
    } catch (e) {
        console.error('API user error:', e);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/game/result', async (req, res) => {
    const { userId, result } = req.body;
    console.log(`🎮 API /game/result: user ${userId}, result: ${result}`);
    
    try {
        const u = getUser(userId);
        const now = Math.floor(Date.now() / 1000);
        
        if (u.penalty_end > now) {
            return res.json({ success: false, error: "Penalty active" });
        }

        if (result === 'win') {
            const newBalance = (u.balance || 0) + WIN_REWARD;
            updateUser(userId, { 
                balance: newBalance, 
                loss_streak: 0, 
                games_played: (u.games_played || 0) + 1, 
                wins: (u.wins || 0) + 1 
            });
            await bot.telegram.sendMessage(GROUP_ID, `🏆 MIRACLE! User won $${WIN_REWARD}!`).catch(()=>{});
            return res.json({ success: true, balance: newBalance });
        }
        
        if (result === 'loss') {
            const newStreak = (u.loss_streak || 0) + 1;
            let penaltyEnd = u.penalty_end || 0;
            let penaltyTriggered = false;
            if (newStreak >= 3) {
                penaltyEnd = now + PENALTY_MINUTES * 60;
                penaltyTriggered = true;
                await bot.telegram.sendMessage(GROUP_ID, `⚠️ User lost 3 times → penalty 30min.`).catch(()=>{});
            }
            updateUser(userId, { 
                loss_streak: newStreak, 
                penalty_end: penaltyEnd, 
                games_played: (u.games_played || 0) + 1,
                losses: (u.losses || 0) + 1
            });
            return res.json({ success: true, loss_streak: newStreak, penalty_active: penaltyTriggered, penalty_end: penaltyEnd });
        }
        
        if (result === 'draw') {
            updateUser(userId, { 
                games_played: (u.games_played || 0) + 1,
                draws: (u.draws || 0) + 1
            });
            return res.json({ success: true });
        }
        
        res.json({ success: false });
    } catch (e) {
        console.error('API game result error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/watchad', async (req, res) => {
    const { userId } = req.body;
    console.log(`📺 API /watchad called for user ${userId}`);
    
    try {
        const u = getUser(userId);
        if (u.penalty_end <= Math.floor(Date.now() / 1000)) {
            return res.json({ success: false, message: "No penalty" });
        }
        updateUser(userId, { penalty_end: 0, loss_streak: 0 });
        await bot.telegram.sendMessage(GROUP_ID, `📺 User watched an ad to unlock.`).catch(()=>{});
        res.json({ success: true, message: "Penalty removed!" });
    } catch (e) {
        console.error('API watchad error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/post-to-group', async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ ok: false });
    await bot.telegram.sendMessage(GROUP_ID, message).catch(()=>{});
    res.json({ ok: true });
});

// Serve the HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', bot: '@tictactoe1st_bot', timestamp: new Date().toISOString() });
});

// ---------- START SERVER ----------
const PORT = process.env.PORT || 3000;

// Launch bot
bot.launch().then(() => {
    console.log('🤖 Bot @tictactoe1st_bot is running...');
    console.log(`📢 Group ID: ${GROUP_ID}`);
    console.log(`🌐 Mini App URL: ${APP_URL}`);
    console.log(`✅ Bot is ready!`);
}).catch((err) => {
    console.error('❌ Bot launch error:', err);
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
