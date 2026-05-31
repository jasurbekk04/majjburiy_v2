const { Telegraf, Markup } = require('telegraf');
const config = require('./config');
const { dbHelpers } = require('./database');

const bot = new Telegraf(config.botToken);

// Middleware: Check mandatory subscription
bot.use(async (ctx, next) => {
    if (!ctx.from || ctx.from.is_bot) return next();
    
    // Admin check bypass
    if (ctx.from.id.toString() === config.adminId.toString()) return next();

    // Skip check for callback queries that verify sub
    if (ctx.callbackQuery && ctx.callbackQuery.data === 'check_sub') return next();

    const settings = await dbHelpers.getSettings();
    const channels = settings.channels || [];

    if (channels.length === 0) return next();

    let notSubscribed = [];

    for (const channel of channels) {
        try {
            // Check if user is a member
            const member = await ctx.telegram.getChatMember(channel.id, ctx.from.id);
            const isMember = ['member', 'administrator', 'creator', 'restricted'].includes(member.status);
            
            if (!isMember) {
                // If not member, check if they sent a join request (zayafka)
                const hasRequested = await dbHelpers.checkJoinRequest(ctx.from.id, channel.id);
                if (!hasRequested) {
                    notSubscribed.push(channel);
                }
            }
        } catch (e) {
            console.error(`Error checking sub for channel ${channel.id}:`, e.message);
        }
    }

    if (notSubscribed.length > 0) {
        const buttons = notSubscribed.map(c => Markup.button.url(c.title, c.link));
        buttons.push(Markup.button.callback('✅ Tekshirish', 'check_sub'));
        
        return ctx.reply('Botdan foydalanish uchun quyidagi kanallarga a\'zo bo\'ling:', 
            Markup.inlineKeyboard(buttons, { columns: 1 })
        );
    }

    return next();
});

// Start command
bot.start(async (ctx) => {
    await dbHelpers.saveUser(ctx.from);
    ctx.reply('Xush kelibsiz! Botdan foydalanish uchun kodni yuboring.');
});

// Check subscription callback
bot.action('check_sub', async (ctx) => {
    const settings = await dbHelpers.getSettings();
    const channels = settings.channels || [];
    let notSubscribed = [];

    for (const channel of channels) {
        try {
            const member = await ctx.telegram.getChatMember(channel.id, ctx.from.id);
            const isMember = ['member', 'administrator', 'creator', 'restricted'].includes(member.status);
            if (!isMember) notSubscribed.push(channel);
        } catch (e) {}
    }

    if (notSubscribed.length > 0) {
        return ctx.answerCbQuery('Siz hali barcha kanallarga a\'zo bo\'lmagansiz!', { show_alert: true });
    }

    await ctx.deleteMessage();
    ctx.reply('Tabriklaymiz! Endi botdan foydalanishingiz mumkin.');
});

// Text message handler
bot.on('text', async (ctx, next) => {
    const text = ctx.message.text;
    
    // Agar bu buyruq bo'lsa (masalan /admin), keyingi handlerga o'tkazamiz
    if (text.startsWith('/')) return next();

    const settings = await dbHelpers.getSettings();

    // Check if it's a "code"
    // Assuming a code is something numeric or specific. You can adjust this.
    const isCode = /^\d+$/.test(text) || text.length > 3; // Basic heuristic: digits or >3 chars

    if (isCode) {
        return ctx.reply(`Siz yuborgan kod bo'yicha link:\n${settings.codeLink}\n\nIltimos, obuna bo'lishni unutmang.`);
    } else {
        return ctx.reply('Iltimos, to\'g\'ri kodni kiriting.');
    }
});

module.exports = bot;
