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

// ---------- TELEGRAM BOT ----------
const bot = new Telegraf(BOT_TOKEN);

// ---------- JSON STORAGE ----------
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

function getUser(userId) {
    const users = readUsers();
    if (!users[userId]) {
        users[userId] = {
            user_id: userId,
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
        const ok = ['member', 'administrator', 'creator'].includes(member.status);
        if (ok) updateUser(userId, { verified: true });
        return ok;
    } catch (error) {
        console.error('Membership check error:', error.message);
        return false;
    }
}

// ---------- BOT COMMANDS ----------
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const firstName = ctx.from.first_name;

    try {
        const member = await isMember(userId, ctx);
        const userData = getUser(userId);

        if (member) {
            await ctx.replyWithMarkdown(
                `🎉 *WELCOME BACK ${firstName.toUpperCase()}!* 🎉

✅ You are a verified member!

━━━━━━━━━━━━━━━━━━━━
💰 *BALANCE:* $${(userData.balance || 0).toFixed(2)}
🏆 *WINS:* ${userData.wins || 0}
🎮 *GAMES:* ${userData.games_played || 0}
💀 *LOSS STREAK:* ${userData.loss_streak || 0}/3
━━━━━━━━━━━━━━━━━━━━

⚡ *IMPOSSIBLE MODE* – Bot never loses.

🎮 Tap below to play:`,
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "🎮 PLAY TIC-TAC-TOE", web_app: { url: `${APP_URL}/index.html` } }],
                            [{ text: "💰 BALANCE", callback_data: "balance" }, { text: "📊 STATS", callback_data: "stats" }],
                            [{ text: "📢 COMMUNITY", url: GROUP_LINK }]
                        ]
                    }
                }
            );
        } else {
            await ctx.replyWithMarkdown(
                `👋 *HELLO ${firstName.toUpperCase()}!*

━━━━━━━━━━━━━━━━━━━━
🎮 *IMPOSSIBLE TIC-TAC-TOE*
━━━━━━━━━━━━━━━━━━━━

⚠️ *First, join our community:*
👉 ${GROUP_LINK}

✅ *After joining, send /verify*

━━━━━━━━━━━━━━━━━━━━
💰 *HOW IT WORKS:*
• Win? +$${WIN_REWARD} (almost impossible)
• Lose 3 times → ${PENALTY_MINUTES} min penalty
• Use /watchad to remove penalty

━━━━━━━━━━━━━━━━━━━━
📱 *COMMANDS:*
/play – Start game
/verify – Check membership
/balance – Balance
/stats – Your stats
/watchad – Remove penalty`,
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "📢 JOIN COMMUNITY", url: GROUP_LINK }],
                            [{ text: "✅ VERIFY", callback_data: "verify" }]
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
    await ctx.reply("🔍 Checking membership...");
    const ok = await isMember(userId, ctx);
    if (ok) {
        const userData = getUser(userId);
        await ctx.replyWithMarkdown(
            `✅ *VERIFIED!*\n\n💰 Balance: $${(userData.balance || 0).toFixed(2)}\n🏆 Wins: ${userData.wins || 0}\n\n🎮 Tap below to play:`,
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
        `🎮 *Starting game!*`,
        { reply_markup: { inline_keyboard: [[{ text: "🎮 PLAY", web_app: { url: `${APP_URL}/index.html` } }]] } }
    );
});

bot.command('balance', async (ctx) => {
    const userData = getUser(ctx.from.id);
    await ctx.replyWithMarkdown(`💰 *Balance:* $${(userData.balance || 0).toFixed(2)}`);
});

bot.command('stats', async (ctx) => {
    const u = getUser(ctx.from.id);
    const winRate = u.games_played ? (u.wins / u.games_played * 100).toFixed(1) : 0;
    await ctx.replyWithMarkdown(
        `📊 *Stats*\n🎮 Games: ${u.games_played || 0}\n🏆 Wins: ${u.wins || 0}\n💀 Loss streak: ${u.loss_streak || 0}/3\n💰 Balance: $${(u.balance || 0).toFixed(2)}\n📈 Win rate: ${winRate}%`
    );
});

bot.command('watchad', async (ctx) => {
    const userId = ctx.from.id;
    const u = getUser(userId);
    const now = Math.floor(Date.now() / 1000);
    if (u.penalty_end <= now) return ctx.reply("No active penalty.");
    updateUser(userId, { penalty_end: 0, loss_streak: 0 });
    await bot.telegram.sendMessage(GROUP_ID, `📺 ${ctx.from.first_name} watched an ad to remove penalty.`).catch(()=>{});
    await ctx.reply("✅ Penalty removed! Use /play");
});

// ---------- CALLBACKS ----------
bot.action('balance', async (ctx) => {
    await ctx.answerCbQuery();
    const u = getUser(ctx.from.id);
    await ctx.reply(`💰 $${(u.balance || 0).toFixed(2)}`);
});
bot.action('stats', async (ctx) => {
    await ctx.answerCbQuery();
    const u = getUser(ctx.from.id);
    await ctx.reply(`📊 Games: ${u.games_played || 0} | Wins: ${u.wins || 0}`);
});
bot.action('verify', async (ctx) => {
    await ctx.answerCbQuery();
    const ok = await isMember(ctx.from.id, ctx);
    await ctx.reply(ok ? "✅ Verified! Use /play" : `❌ Join ${GROUP_LINK} first.`);
});

// ---------- API FOR MINI APP ----------
app.post('/api/verify', async (req, res) => {
    const { telegramId } = req.body;
    if (!telegramId) return res.status(400).json({ ok: false, error: 'No telegramId' });
    try {
        const fakeCtx = { telegram: bot.telegram };
        const member = await isMember(telegramId, fakeCtx);
        if (!member) return res.json({ ok: false, error: 'Join community first.' });
        const u = getUser(telegramId);
        res.json({ ok: true, message: 'Verified!', balance: u.balance, lossStreak: u.loss_streak, wins: u.wins });
    } catch (e) {
        res.status(500).json({ ok: false, error: 'Server error' });
    }
});

app.get('/api/user/:userId', (req, res) => {
    const u = getUser(parseInt(req.params.userId));
    const now = Math.floor(Date.now() / 1000);
    res.json({
        balance: u.balance,
        loss_streak: u.loss_streak,
        penalty_end: u.penalty_end,
        penalty_active: u.penalty_end > now,
        wins: u.wins,
        games_played: u.games_played
    });
});

app.post('/api/game/result', async (req, res) => {
    const { userId, result } = req.body;
    const u = getUser(userId);
    const now = Math.floor(Date.now() / 1000);
    if (u.penalty_end > now) return res.json({ success: false, error: "Penalty active" });

    if (result === 'win') {
        const newBalance = (u.balance || 0) + WIN_REWARD;
        updateUser(userId, { balance: newBalance, loss_streak: 0, games_played: (u.games_played || 0) + 1, wins: (u.wins || 0) + 1 });
        await bot.telegram.sendMessage(GROUP_ID, `🏆 Miracle! User ${userId} won $${WIN_REWARD}!`).catch(()=>{});
        return res.json({ success: true, balance: newBalance });
    }
    if (result === 'loss') {
        const newStreak = (u.loss_streak || 0) + 1;
        let penaltyEnd = u.penalty_end;
        let penaltyTriggered = false;
        if (newStreak >= 3) {
            penaltyEnd = now + PENALTY_MINUTES * 60;
            penaltyTriggered = true;
            await bot.telegram.sendMessage(GROUP_ID, `⚠️ User ${userId} lost 3 times → penalty 30min.`).catch(()=>{});
        }
        updateUser(userId, { loss_streak: newStreak, penalty_end: penaltyEnd, games_played: (u.games_played || 0) + 1 });
        return res.json({ success: true, loss_streak: newStreak, penalty_active: penaltyTriggered, penalty_end: penaltyEnd });
    }
    if (result === 'draw') {
        updateUser(userId, { games_played: (u.games_played || 0) + 1 });
        return res.json({ success: true });
    }
    res.json({ success: false });
});

app.post('/api/watchad', async (req, res) => {
    const { userId } = req.body;
    const u = getUser(userId);
    if (u.penalty_end <= Math.floor(Date.now() / 1000)) return res.json({ success: false, message: "No penalty" });
    updateUser(userId, { penalty_end: 0, loss_streak: 0 });
    await bot.telegram.sendMessage(GROUP_ID, `📺 User ${userId} watched an ad to unlock.`).catch(()=>{});
    res.json({ success: true });
});

app.post('/api/post-to-group', async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ ok: false });
    await bot.telegram.sendMessage(GROUP_ID, message).catch(()=>{});
    res.json({ ok: true });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/health', (req, res) => res.json({ status: 'ok', bot: '@tictactoe1st_bot' }));

// ---------- START ----------
const PORT = process.env.PORT || 3000;
bot.launch().then(() => console.log('🤖 Bot started')).catch(err => console.error('Bot error:', err));
app.listen(PORT, () => console.log(`🌐 Server on port ${PORT}`));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
