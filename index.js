const bot = require('./src/bot');
const adminPanel = require('./src/admin');
const { dbHelpers } = require('./src/database');
const config = require('./src/config');
const { Markup } = require('telegraf');

// Initialize admin panel
adminPanel(bot);

// Handle join requests
bot.on('chat_join_request', async (ctx) => {
    const { from, chat } = ctx.chatJoinRequest;
    await dbHelpers.addJoinRequest(from.id, chat.id);
    console.log(`Join request from ${from.id} to ${chat.id} saved.`);
});

// Simple state management for admin inputs
let adminState = {};

bot.on('message', async (ctx, next) => {
    console.log(`[DEBUG] Incoming message from ${ctx.from.id}: ${ctx.message.text}`);
    if (ctx.from.id.toString() !== config.adminId.toString()) return next();

    const state = adminState[ctx.from.id];
    if (!state) return next();

    const text = ctx.message.text;

    if (state === 'adding_channel') {
        const parts = text.split('|').map(p => p.trim());
        if (parts.length === 3) {
            await dbHelpers.addChannel({ id: parts[0], title: parts[1], link: parts[2] });
            ctx.reply('Kanal muvaffaqiyatli qo\'shildi!');
            delete adminState[ctx.from.id];
        } else {
            ctx.reply('Noto\'g\'ri format. Iltimos: `ID | Title | Link` ko\'rinishida yuboring.');
        }
    } else if (state === 'updating_link') {
        await dbHelpers.updateSettings({ codeLink: text });
        ctx.reply('Link yangilandi!');
        delete adminState[ctx.from.id];
    } else if (state === 'broadcasting') {
        const users = await dbHelpers.getUsers();
        let count = 0;
        let blocked = 0;
        
        ctx.reply(`Xabar yuborish boshlandi... Total users: ${users.length}`);

        for (const user of users) {
            try {
                await ctx.telegram.copyMessage(user.id, ctx.from.id, ctx.message.message_id);
                count++;
            } catch (e) {
                if (e.description === 'Forbidden: bot was blocked by the user') {
                    await dbHelpers.setBlocked(user.id);
                    blocked++;
                }
            }
        }
        ctx.reply(`Xabar ${count} kishiga yuborildi. ${blocked} kishi botni bloklagan.`);
        delete adminState[ctx.from.id];
    } else if (state === 'forwarding') {
        const users = await dbHelpers.getUsers();
        let count = 0;
        let blocked = 0;
        
        ctx.reply(`Forward boshlandi...`);

        for (const user of users) {
            try {
                await ctx.telegram.forwardMessage(user.id, ctx.from.id, ctx.message.message_id);
                count++;
            } catch (e) {
                if (e.description === 'Forbidden: bot was blocked by the user') {
                    await dbHelpers.setBlocked(user.id);
                    blocked++;
                }
            }
        }
        ctx.reply(`Xabar ${count} kishiga forward qilindi. ${blocked} kishi botni bloklagan.`);
        delete adminState[ctx.from.id];
    }
});

// Intercept admin actions to set state
bot.action('add_channel', (ctx) => {
    adminState[ctx.from.id] = 'adding_channel';
    ctx.editMessageText('Kanal ma\'lumotlarini quyidagi formatda yuboring:\n`ID | Title | Link`');
});

bot.action('admin_link', (ctx) => {
    adminState[ctx.from.id] = 'updating_link';
    ctx.editMessageText('Yangi linkni yuboring.');
});

bot.action('admin_broadcast', (ctx) => {
    adminState[ctx.from.id] = 'broadcasting';
    ctx.editMessageText('Hammaga yuboriladigan xabarni kiriting.');
});

bot.action('admin_forward', (ctx) => {
    adminState[ctx.from.id] = 'forwarding';
    ctx.editMessageText('Menga forward qilingan xabarni yuboring.');
});

bot.launch().then(() => {
    console.log('Bot is running...');
}).catch(err => {
    console.error('Launch failed:', err);
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
