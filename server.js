require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { Telegraf, Markup } = require('telegraf');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ---------- CONFIGURATION ----------
const BOT_TOKEN = process.env.BOT_TOKEN;
const GROUP_ID = process.env.CHAT_ID || -1003984859530;
const GROUP_LINK = "https://t.me/gangs234";
const PENALTY_MINUTES = 30;
const WIN_REWARD = 0.1;

// ---------- TELEGRAM BOT SETUP ----------
const bot = new Telegraf(BOT_TOKEN);

// ---------- JSON FILE STORAGE (No SQLite needed) ----------
const DATA_FILE = path.join(__dirname, 'users.json');

// Initialize data file if it doesn't exist
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
            game_board: null,
            current_player: null,
            games_played: 0,
            wins: 0,
            created_at: Date.now()
        };
        writeUsers(users);
    }
    return users[userId];
}

function updateUser(userId, updates) {
    const users = readUsers();
    if (!users[userId]) {
        users[userId] = {
            user_id: userId,
            balance: 0,
            loss_streak: 0,
            penalty_end: 0,
            game_board: null,
            current_player: null,
            games_played: 0,
            wins: 0,
            created_at: Date.now()
        };
    }
    Object.assign(users[userId], updates);
    writeUsers(users);
}

// ---------- TIC-TAC-TOE AI (UNBEATABLE) ----------
function checkWinner(board) {
    const lines = [
        [0,1,2], [3,4,5], [6,7,8],
        [0,3,6], [1,4,7], [2,5,8],
        [0,4,8], [2,4,6]
    ];
    for (let line of lines) {
        const [a,b,c] = line;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }
    return null;
}

function isDraw(board) {
    return board.every(cell => cell !== null);
}

function minimax(board, depth, isMax) {
    const winner = checkWinner(board);
    if (winner === 'O') return 10 - depth;
    if (winner === 'X') return -10 + depth;
    if (isDraw(board)) return 0;
    
    if (isMax) {
        let best = -Infinity;
        for (let i = 0; i < 9; i++) {
            if (!board[i]) {
                board[i] = 'O';
                best = Math.max(best, minimax(board, depth + 1, false));
                board[i] = null;
            }
        }
        return best;
    } else {
        let best = Infinity;
        for (let i = 0; i < 9; i++) {
            if (!board[i]) {
                board[i] = 'X';
                best = Math.min(best, minimax(board, depth + 1, true));
                board[i] = null;
            }
        }
        return best;
    }
}

function getBestMove(board) {
    let bestScore = -Infinity;
    let bestMove = null;
    for (let i = 0; i < 9; i++) {
        if (!board[i]) {
            board[i] = 'O';
            const score = minimax(board, 0, false);
            board[i] = null;
            if (score > bestScore) {
                bestScore = score;
                bestMove = i;
            }
        }
    }
    return bestMove;
}

// ---------- CHECK MEMBERSHIP ----------
async function isMember(userId, ctx) {
    try {
        const member = await ctx.telegram.getChatMember(GROUP_ID, userId);
        return ['member', 'administrator', 'creator'].includes(member.status);
    } catch (error) {
        console.error('Membership check error:', error);
        return false;
    }
}

// ---------- RENDER BOARD ----------
function renderBoard(board) {
    const symbols = { null: "◻️", 'X': "❌", 'O': "⭕" };
    const keyboard = [];
    
    for (let i = 0; i < 9; i += 3) {
        const row = [];
        for (let j = 0; j < 3; j++) {
            const idx = i + j;
            const text = symbols[board[idx]];
            const callback = board[idx] === null ? `move_${idx}` : 'noop';
            row.push(Markup.button.callback(text, callback));
        }
        keyboard.push(row);
    }
    keyboard.push([Markup.button.callback("🔄 New Game", "reset")]);
    
    return Markup.inlineKeyboard(keyboard);
}

// ---------- TELEGRAM BOT HANDLERS ----------
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const firstName = ctx.from.first_name;
    
    await ctx.replyWithMarkdown(
        `👋 **Welcome ${firstName}!**\n\n` +
        `🎮 **IMPOSSIBLE TIC-TAC-TOE BOT** 🎮\n\n` +
        `⚠️ **First, join our community:**\n` +
        `👉 ${GROUP_LINK}\n\n` +
        `✅ After joining, send /verify\n\n` +
        `💰 **How it works:**\n` +
        `• Beat the bot? +$${WIN_REWARD} (impossible!)\n` +
        `• Lose 3 times → ${PENALTY_MINUTES}min penalty\n` +
        `• Use /watchad to remove penalty\n\n` +
        `Commands:\n` +
        `/play - Start a game\n` +
        `/verify - Check group membership\n` +
        `/balance - Check your balance\n` +
        `/watchad - Remove penalty\n` +
        `/stats - Your game stats`
    );
});

bot.command('verify', async (ctx) => {
    const userId = ctx.from.id;
    await ctx.reply("🔍 Checking your membership...");
    
    const member = await isMember(userId, ctx);
    
    if (member) {
        updateUser(userId, { username: ctx.from.username || null });
        await ctx.replyWithMarkdown(
            `✅ **VERIFIED!**\n\n` +
            `You're a member of ${GROUP_LINK}\n` +
            `🎮 Use /play to start your game!`
        );
    } else {
        await ctx.replyWithMarkdown(
            `❌ **NOT VERIFIED** ❌\n\n` +
            `You must join our community first:\n` +
            `${GROUP_LINK}\n\n` +
            `After joining, send /verify again.\n\n` +
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
            `❌ **Access Denied** ❌\n\n` +
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
            `⛔ **PENALTY ACTIVE** ⛔\n\n` +
            `Time remaining: ${minutes}m ${seconds}s\n` +
            `Use /watchad to unlock immediately.`
        );
        return;
    }
    
    // Clear expired penalty
    if (userData.penalty_end > 0) {
        updateUser(userId, { penalty_end: 0, loss_streak: 0 });
    }
    
    // Start new game
    const board = [null, null, null, null, null, null, null, null, null];
    updateUser(userId, { 
        game_board: JSON.stringify(board), 
        current_player: 'X' 
    });
    
    const keyboard = renderBoard(board);
    await ctx.replyWithMarkdown(
        "🎮 **Tic-Tac-Toe - IMPOSSIBLE MODE** 🎮\n\n" +
        "You are ❌ | Bot is ⭕\n" +
        "⚠️ **Bot uses perfect AI - you cannot win!**\n\n" +
        "Make your first move:",
        keyboard
    );
});

bot.command('balance', async (ctx) => {
    const userId = ctx.from.id;
    const userData = getUser(userId);
    await ctx.replyWithMarkdown(
        `💰 **Your Balance** 💰\n\n` +
        `💵 $${userData.balance.toFixed(2)}\n\n` +
        `Win reward: +$${WIN_REWARD}\n` +
        `Can you beat the unbeatable bot?`
    );
});

bot.command('watchad', async (ctx) => {
    const userId = ctx.from.id;
    const userData = getUser(userId);
    const now = Math.floor(Date.now() / 1000);
    
    if (userData.penalty_end <= now) {
        await ctx.replyWithMarkdown(
            "📺 **No active penalty**\n\n" +
            "You can play normally. Use /play to start a game!"
        );
        return;
    }
    
    // Simulate ad watch
    updateUser(userId, { penalty_end: 0, loss_streak: 0 });
    
    // Post to group
    try {
        await ctx.telegram.sendMessage(
            GROUP_ID,
            `📺 ${ctx.from.first_name} watched an ad to remove penalty!`
        );
    } catch (e) {
        console.error('Failed to post to group:', e);
    }
    
    await ctx.replyWithMarkdown(
        "✅ **Ad Watched!** ✅\n\n" +
        "🔓 Penalty removed!\n" +
        "🎮 Use /play to start a new game!"
    );
});

bot.command('stats', async (ctx) => {
    const userId = ctx.from.id;
    const userData = getUser(userId);
    
    const winRate = userData.games_played > 0 
        ? (userData.wins / userData.games_played * 100).toFixed(1) 
        : 0;
    
    await ctx.replyWithMarkdown(
        `📊 **Your Stats** 📊\n\n` +
        `🎮 Games played: ${userData.games_played}\n` +
        `🏆 Wins: ${userData.wins}\n` +
        `💀 Loss streak: ${userData.loss_streak}/3\n` +
        `💰 Balance: $${userData.balance.toFixed(2)}\n` +
        `📈 Win rate: ${winRate}%\n\n` +
        `⚠️ Bot is unbeatable - winning is a miracle!`
    );
});

// ---------- CALLBACK HANDLERS ----------
bot.action(/move_(\d+)/, async (ctx) => {
    const moveIndex = parseInt(ctx.match[1]);
    const userId = ctx.from.id;
    
    await ctx.answerCbQuery();
    
    const userData = getUser(userId);
    const now = Math.floor(Date.now() / 1000);
    
    if (userData.penalty_end > now) {
        const remain = userData.penalty_end - now;
        const minutes = Math.floor(remain / 60);
        const seconds = remain % 60;
        await ctx.editMessageText(
            `⛔ PENALTY ACTIVE ⛔\n\nTime remaining: ${minutes}m ${seconds}s\nUse /watchad to unlock.`
        );
        return;
    }
    
    let board = JSON.parse(userData.game_board || "[]");
    if (!board.length) board = Array(9).fill(null);
    
    if (userData.current_player !== 'X') {
        await ctx.answerCbQuery("Not your turn!");
        return;
    }
    
    if (board[moveIndex] !== null) {
        await ctx.answerCbQuery("Invalid move!");
        return;
    }
    
    // Human move
    board[moveIndex] = 'X';
    let winner = checkWinner(board);
    
    if (winner === 'X') {
        const newBalance = userData.balance + WIN_REWARD;
        updateUser(userId, {
            balance: newBalance,
            loss_streak: 0,
            game_board: null,
            current_player: null,
            games_played: userData.games_played + 1,
            wins: userData.wins + 1
        });
        
        try {
            await ctx.telegram.sendMessage(
                GROUP_ID,
                `🏆 **MIRACLE!** @${ctx.from.username || ctx.from.first_name} DEFEATED the unbeatable bot and won $${WIN_REWARD}! 🏆`
            );
        } catch (e) {}
        
        await ctx.editMessageText(
            `🎉 **UNBELIEVABLE VICTORY!** 🎉\n\n` +
            `You defeated the impossible bot!\n` +
            `💰 +$${WIN_REWARD} added\n` +
            `💵 New balance: $${newBalance.toFixed(2)}\n\n` +
            `Use /play to start a new game!`
        );
        return;
    }
    
    if (isDraw(board)) {
        updateUser(userId, {
            game_board: null,
            current_player: null,
            games_played: userData.games_played + 1
        });
        
        try {
            await ctx.telegram.sendMessage(GROUP_ID, `🤝 ${ctx.from.first_name} drew with the bot.`);
        } catch (e) {}
        
        await ctx.editMessageText(
            "🤝 **DRAW!**\n\nYou survived but didn't win.\nUse /play to try again!"
        );
        return;
    }
    
    // Bot's turn
    updateUser(userId, { game_board: JSON.stringify(board), current_player: 'O' });
    await ctx.editMessageText("🤖 Bot is thinking...", renderBoard(board));
    
    // Bot move after delay
    setTimeout(async () => {
        const updatedData = getUser(userId);
        let currentBoard = JSON.parse(updatedData.game_board || "[]");
        if (!currentBoard.length || updatedData.current_player !== 'O') return;
        
        const botMove = getBestMove(currentBoard);
        if (botMove !== null) {
            currentBoard[botMove] = 'O';
            winner = checkWinner(currentBoard);
            
            if (winner === 'O') {
                const lossStreak = updatedData.loss_streak + 1;
                let penaltyEnd = updatedData.penalty_end;
                
                if (lossStreak >= 3) {
                    penaltyEnd = Math.floor(Date.now() / 1000) + (PENALTY_MINUTES * 60);
                    updateUser(userId, {
                        penalty_end: penaltyEnd,
                        loss_streak: lossStreak,
                        game_board: null,
                        current_player: null,
                        games_played: updatedData.games_played + 1
                    });
                    
                    try {
                        await ctx.telegram.sendMessage(
                            GROUP_ID,
                            `⚠️ ${ctx.from.first_name} lost 3 times! Penalty activated (30 min).`
                        );
                    } catch (e) {}
                    
                    await ctx.editMessageText(
                        `💀 **BOT WINS!** 💀\n\n` +
                        `Loss streak: ${lossStreak}/3\n` +
                        `❌ **PENALTY TRIGGERED!** ❌\n\n` +
                        `You are locked for 30 minutes.\n` +
                        `Use /watchad to unlock immediately.`
                    );
                } else {
                    updateUser(userId, {
                        loss_streak: lossStreak,
                        game_board: null,
                        current_player: null,
                        games_played: updatedData.games_played + 1
                    });
                    
                    await ctx.editMessageText(
                        `💀 **BOT WINS!** 💀\n\n` +
                        `Loss streak: ${lossStreak}/3\n\n` +
                        `Use /play to try again!`
                    );
                }
                return;
            }
            
            if (isDraw(currentBoard)) {
                updateUser(userId, {
                    game_board: null,
                    current_player: null,
                    games_played: updatedData.games_played + 1
                });
                
                try {
                    await ctx.telegram.sendMessage(GROUP_ID, `🤝 ${ctx.from.first_name} drew with the bot.`);
                } catch (e) {}
                
                await ctx.editMessageText(
                    "🤝 **DRAW!**\n\nUse /play to try again!"
                );
                return;
            }
            
            updateUser(userId, {
                game_board: JSON.stringify(currentBoard),
                current_player: 'X'
            });
            
            await ctx.editMessageText(
                "✅ **Your turn!**\n\nMake your move:",
                renderBoard(currentBoard)
            );
        }
    }, 500);
});

bot.action('reset', async (ctx) => {
    const userId = ctx.from.id;
    await ctx.answerCbQuery();
    
    updateUser(userId, { game_board: null, current_player: null });
    await ctx.editMessageText("🔄 Game reset! Starting new game...");
    
    const board = [null, null, null, null, null, null, null, null, null];
    updateUser(userId, { game_board: JSON.stringify(board), current_player: 'X' });
    const keyboard = renderBoard(board);
    await ctx.replyWithMarkdown(
        "🎮 **New Game Started** 🎮\n\nMake your first move:",
        keyboard
    );
});

bot.action('noop', async (ctx) => {
    await ctx.answerCbQuery("Invalid move!");
});

// ---------- EXPRESS SERVER ----------
app.get('/health', (req, res) => {
    res.json({ status: 'ok', bot: '@tictactoe1st_bot', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
    res.json({ message: 'Tic-Tac-Toe Bot is running!', bot: '@tictactoe1st_bot' });
});

// ---------- START BOT AND SERVER ----------
const PORT = process.env.PORT || 3000;

bot.launch().then(() => {
    console.log('🤖 Bot @tictactoe1st_bot is running...');
}).catch((err) => {
    console.error('Failed to launch bot:', err);
});

app.listen(PORT, () => {
    console.log(`🌐 Web server running on port ${PORT}`);
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
