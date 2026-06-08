require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const sqlite3 = require('sqlite3').verbose();
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

// ---------- DATABASE SETUP ----------
const db = new sqlite3.Database('./tictactoe.db');

db.run(`
    CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY,
        username TEXT,
        balance REAL DEFAULT 0,
        loss_streak INTEGER DEFAULT 0,
        penalty_end INTEGER DEFAULT 0,
        game_board TEXT,
        current_player TEXT,
        games_played INTEGER DEFAULT 0,
        wins INTEGER DEFAULT 0
    )
`);

// Helper functions
function getUser(userId, callback) {
    db.get("SELECT balance, loss_streak, penalty_end, game_board, current_player, games_played, wins FROM users WHERE user_id = ?", [userId], (err, row) => {
        if (err) return callback(err, null);
        if (!row) {
            db.run("INSERT INTO users (user_id) VALUES (?)", [userId], (err) => {
                if (err) return callback(err, null);
                getUser(userId, callback);
            });
        } else {
            callback(null, {
                balance: row.balance,
                loss_streak: row.loss_streak,
                penalty_end: row.penalty_end,
                game_board: row.game_board,
                current_player: row.current_player,
                games_played: row.games_played,
                wins: row.wins
            });
        }
    });
}

function updateUser(userId, updates, callback) {
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    values.push(userId);
    db.run(`UPDATE users SET ${fields} WHERE user_id = ?`, values, callback);
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
    
    try {
        const member = await ctx.telegram.getChatMember(GROUP_ID, userId);
        const isMember = ['member', 'administrator', 'creator'].includes(member.status);
        
        if (isMember) {
            updateUser(userId, { username: ctx.from.username || null }, () => {});
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
                `After joining, send /verify again.`
            );
        }
    } catch (error) {
        console.error('Verify error:', error);
        await ctx.reply("❌ Error checking membership. Make sure the bot is admin of the group.");
    }
});

bot.command('play', async (ctx) => {
    const userId = ctx.from.id;
    
    // Check membership
    try {
        const member = await ctx.telegram.getChatMember(GROUP_ID, userId);
        const isMember = ['member', 'administrator', 'creator'].includes(member.status);
        
        if (!isMember) {
            await ctx.replyWithMarkdown(
                `❌ **Access Denied** ❌\n\n` +
                `You must join our community first:\n` +
                `${GROUP_LINK}\n\n` +
                `After joining, send /verify`
            );
            return;
        }
    } catch (error) {
        await ctx.reply("❌ Error verifying membership. Make sure the bot is admin of the group.");
        return;
    }
    
    getUser(userId, async (err, userData) => {
        if (err) return ctx.reply("Database error");
        
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
            updateUser(userId, { penalty_end: 0, loss_streak: 0 }, () => {});
        }
        
        // Start new game
        const board = JSON.stringify([null, null, null, null, null, null, null, null, null]);
        updateUser(userId, { game_board: board, current_player: 'X' }, () => {
            const keyboard = renderBoard(JSON.parse(board));
            ctx.replyWithMarkdown(
                "🎮 **Tic-Tac-Toe - IMPOSSIBLE MODE** 🎮\n\n" +
                "You are ❌ | Bot is ⭕\n" +
                "⚠️ **Bot uses perfect AI - you cannot win!**\n\n" +
                "Make your first move:",
                keyboard
            );
        });
    });
});

bot.command('balance', async (ctx) => {
    const userId = ctx.from.id;
    getUser(userId, (err, userData) => {
        if (err) return ctx.reply("Database error");
        ctx.replyWithMarkdown(
            `💰 **Your Balance** 💰\n\n` +
            `💵 $${userData.balance.toFixed(2)}\n\n` +
            `Win reward: +$${WIN_REWARD}\n` +
            `Can you beat the unbeatable bot?`
        );
    });
});

bot.command('watchad', async (ctx) => {
    const userId = ctx.from.id;
    getUser(userId, async (err, userData) => {
        if (err) return ctx.reply("Database error");
        
        const now = Math.floor(Date.now() / 1000);
        
        if (userData.penalty_end <= now) {
            await ctx.replyWithMarkdown(
                "📺 **No active penalty**\n\n" +
                "You can play normally. Use /play to start a game!"
            );
            return;
        }
        
        // Simulate ad watch (in production, integrate real ad network)
        updateUser(userId, { penalty_end: 0, loss_streak: 0 }, async () => {
            // Post to group
            try {
                await ctx.telegram.sendMessage(
                    GROUP_ID,
                    `📺 ${ctx.from.first_name} watched an ad to remove penalty!`
                );
            } catch (e) {}
            
            await ctx.replyWithMarkdown(
                "✅ **Ad Watched!** ✅\n\n" +
                "🔓 Penalty removed!\n" +
                "🎮 Use /play to start a new game!"
            );
        });
    });
});

bot.command('stats', async (ctx) => {
    const userId = ctx.from.id;
    getUser(userId, (err, userData) => {
        if (err) return ctx.reply("Database error");
        
        const winRate = userData.games_played > 0 
            ? (userData.wins / userData.games_played * 100).toFixed(1) 
            : 0;
        
        ctx.replyWithMarkdown(
            `📊 **Your Stats** 📊\n\n` +
            `🎮 Games played: ${userData.games_played}\n` +
            `🏆 Wins: ${userData.wins}\n` +
            `💀 Loss streak: ${userData.loss_streak}/3\n` +
            `💰 Balance: $${userData.balance.toFixed(2)}\n` +
            `📈 Win rate: ${winRate}%\n\n` +
            `⚠️ Bot is unbeatable - winning is a miracle!`
        );
    });
});

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

bot.action(/move_(\d+)/, async (ctx) => {
    const moveIndex = parseInt(ctx.match[1]);
    const userId = ctx.from.id;
    
    await ctx.answerCbQuery();
    
    getUser(userId, async (err, userData) => {
        if (err) return ctx.editMessageText("Database error");
        
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
            }, async () => {
                await ctx.telegram.sendMessage(
                    GROUP_ID,
                    `🏆 **MIRACLE!** @${ctx.from.username || ctx.from.first_name} DEFEATED the unbeatable bot and won $${WIN_REWARD}! 🏆`
                );
                await ctx.editMessageText(
                    `🎉 **UNBELIEVABLE VICTORY!** 🎉\n\n` +
                    `You defeated the impossible bot!\n` +
                    `💰 +$${WIN_REWARD} added\n` +
                    `💵 New balance: $${newBalance.toFixed(2)}\n\n` +
                    `Use /play to start a new game!`
                );
            });
            return;
        }
        
        if (isDraw(board)) {
            updateUser(userId, {
                game_board: null,
                current_player: null,
                games_played: userData.games_played + 1
            }, async () => {
                await ctx.telegram.sendMessage(GROUP_ID, `🤝 ${ctx.from.first_name} drew with the bot.`);
                await ctx.editMessageText(
                    "🤝 **DRAW!**\n\nYou survived but didn't win.\nUse /play to try again!"
                );
            });
            return;
        }
        
        // Bot's turn
        updateUser(userId, { game_board: JSON.stringify(board), current_player: 'O' }, async () => {
            await ctx.editMessageText("🤖 Bot is thinking...", renderBoard(board));
            
            // Bot move after delay
            setTimeout(async () => {
                getUser(userId, async (err, updatedData) => {
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
                                }, async () => {
                                    await ctx.telegram.sendMessage(
                                        GROUP_ID,
                                        `⚠️ ${ctx.from.first_name} lost 3 times! Penalty activated (30 min).`
                                    );
                                    await ctx.editMessageText(
                                        `💀 **BOT WINS!** 💀\n\n` +
                                        `Loss streak: ${lossStreak}/3\n` +
                                        `❌ **PENALTY TRIGGERED!** ❌\n\n` +
                                        `You are locked for 30 minutes.\n` +
                                        `Use /watchad to unlock immediately.`
                                    );
                                });
                            } else {
                                updateUser(userId, {
                                    loss_streak: lossStreak,
                                    game_board: null,
                                    current_player: null,
                                    games_played: updatedData.games_played + 1
                                }, async () => {
                                    await ctx.editMessageText(
                                        `💀 **BOT WINS!** 💀\n\n` +
                                        `Loss streak: ${lossStreak}/3\n\n` +
                                        `Use /play to try again!`
                                    );
                                });
                            }
                            return;
                        }
                        
                        if (isDraw(currentBoard)) {
                            updateUser(userId, {
                                game_board: null,
                                current_player: null,
                                games_played: updatedData.games_played + 1
                            }, async () => {
                                await ctx.telegram.sendMessage(GROUP_ID, `🤝 ${ctx.from.first_name} drew with the bot.`);
                                await ctx.editMessageText(
                                    "🤝 **DRAW!**\n\nUse /play to try again!"
                                );
                            });
                            return;
                        }
                        
                        updateUser(userId, {
                            game_board: JSON.stringify(currentBoard),
                            current_player: 'X'
                        }, async () => {
                            await ctx.editMessageText(
                                "✅ **Your turn!**\n\nMake your move:",
                                renderBoard(currentBoard)
                            );
                        });
                    }
                });
            }, 500);
        });
    });
});

bot.action('reset', async (ctx) => {
    const userId = ctx.from.id;
    await ctx.answerCbQuery();
    
    updateUser(userId, { game_board: null, current_player: null }, async () => {
        await ctx.editMessageText("🔄 Game reset! Starting new game...");
        
        const board = JSON.stringify([null, null, null, null, null, null, null, null, null]);
        updateUser(userId, { game_board: board, current_player: 'X' }, () => {
            const keyboard = renderBoard(JSON.parse(board));
            ctx.replyWithMarkdown(
                "🎮 **New Game Started** 🎮\n\nMake your first move:",
                keyboard
            );
        });
    });
});

bot.action('noop', async (ctx) => {
    await ctx.answerCbQuery("Invalid move!");
});

// ---------- EXPRESS SERVER (Health Check / Webhook if needed) ----------
app.get('/health', (req, res) => {
    res.json({ status: 'ok', bot: '@tictactoe1st_bot' });
});

// Start bot and server
const PORT = process.env.PORT || 3000;

bot.launch().then(() => {
    console.log('🤖 Bot @tictactoe1st_bot is running...');
});

app.listen(PORT, () => {
    console.log(`🌐 Web server running on port ${PORT}`);
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
