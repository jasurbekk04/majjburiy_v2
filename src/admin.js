const { Markup } = require('telegraf');
const { dbHelpers } = require('./database');
const config = require('./config');

const adminPanel = (bot) => {
    // Admin checking middleware for this module
    const isAdmin = (ctx) => {
        const userId = ctx.from?.id?.toString();
        const configId = config.adminId?.toString();
        const Match = userId === configId;
        
        console.log(`[DEBUG] UserID: "${userId}" | ConfigID: "${configId}" | Match: ${Match}`);
        
        if (!Match && ctx.message?.text === '/admin') {
            console.log(`[ALERT] Admin panel attempt by non-admin!`);
        }
        return Match;
    };

    bot.command('admin', async (ctx) => {
        if (!isAdmin(ctx)) return;
        
        const stats = await dbHelpers.getStats();
        const text = `📊 **Statistika**\n\n` +
            `Total: ${stats.total}\n` +
            `Faol: ${stats.active}\n` +
            `Bloklagan: ${stats.blocked}\n` +
            `Oxirgi 24 soat: ${stats.joinedLast24h}\n` +
            `Ulangan kanallar: ${stats.channelsCount}`;

        ctx.replyWithMarkdown(text, Markup.inlineKeyboard([
            [Markup.button.callback('📢 Kanallar', 'admin_channels'), Markup.button.callback('🔗 Link sozlamasi', 'admin_link')],
            [Markup.button.callback('✉️ Xabar yuborish', 'admin_broadcast'), Markup.button.callback('⏩ Forward yuborish', 'admin_forward')],
            [Markup.button.callback('🔄 Yangilash', 'admin_refresh')]
        ]));
    });

    bot.action('admin_refresh', async (ctx) => {
        if (!isAdmin(ctx)) return;
        const stats = await dbHelpers.getStats();
        const text = `📊 **Statistika**\n\n` +
            `Total: ${stats.total}\n` +
            `Faol: ${stats.active}\n` +
            `Bloklagan: ${stats.blocked}\n` +
            `Oxirgi 24 soat: ${stats.joinedLast24h}\n` +
            `Ulangan kanallar: ${stats.channelsCount}`;
        
        try {
            await ctx.editMessageText(text, {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('📢 Kanallar', 'admin_channels'), Markup.button.callback('🔗 Link sozlamasi', 'admin_link')],
                    [Markup.button.callback('✉️ Xabar yuborish', 'admin_broadcast'), Markup.button.callback('⏩ Forward yuborish', 'admin_forward')],
                    [Markup.button.callback('🔄 Yangilash', 'admin_refresh')]
                ])
            });
        } catch (e) {}
    });

    // Channel management
    bot.action('admin_channels', async (ctx) => {
        if (!isAdmin(ctx)) return;
        const settings = await dbHelpers.getSettings();
        const channels = settings.channels || [];
        
        let text = '📢 **Ulangan kanallar:**\n\n';
        if (channels.length === 0) text += 'Hozircha kanallar yo\'q.';
        
        const buttons = channels.map(c => [Markup.button.callback(`❌ ${c.title}`, `remove_channel_${c.id}`)]);
        buttons.push([Markup.button.callback('➕ Kanal qo\'shish', 'add_channel')]);
        buttons.push([Markup.button.callback('⬅️ Orqaga', 'admin_refresh')]);

        ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard(buttons)
        });
    });

    // Add channel logic (simplified: asks for ID, Link, Title in one step or multi-step)
    // For simplicity, we'll use regex or multi-step later.
    bot.action('add_channel', async (ctx) => {
        if (!isAdmin(ctx)) return;
        ctx.reply('Kanal ma\'lumotlarini quyidagi formatda yuboring:\n`ID | Title | Link`');
        // We'll catch this in a scene or temporary state. For now, using raw listener.
    });

    // Link settings
    bot.action('admin_link', async (ctx) => {
        if (!isAdmin(ctx)) return;
        const settings = await dbHelpers.getSettings();
        ctx.reply(`Hozirgi link: ${settings.codeLink}\n\nYangi linkni yuboring.`);
    });

    // Broadcasting logic
    bot.action('admin_broadcast', async (ctx) => {
        if (!isAdmin(ctx)) return;
        ctx.reply('Foydalanuvchilarga yuboriladigan xabarni kiriting. Pastiga tugma qo\'shishni xohlaysizmi? (Tugma nomi | Link)');
    });

    bot.action('admin_forward', async (ctx) => {
        if (!isAdmin(ctx)) return;
        ctx.reply('Yubormoqchi bo\'lgan xabaringizni menga forward qiling.');
    });

    // Handle channel removal
    bot.action(/^remove_channel_(.+)$/, async (ctx) => {
        if (!isAdmin(ctx)) return;
        const channelId = ctx.match[1];
        await dbHelpers.removeChannel(channelId);
        ctx.answerCbQuery('Kanal o\'chirildi');
        return admin_channels_refresh(ctx);
    });

    const admin_channels_refresh = async (ctx) => {
        const settings = await dbHelpers.getSettings();
        const channels = settings.channels || [];
        let text = '📢 **Ulangan kanallar:**\n\n';
        const buttons = channels.map(c => [Markup.button.callback(`❌ ${c.title}`, `remove_channel_${c.id}`)]);
        buttons.push([Markup.button.callback('➕ Kanal qo\'shish', 'add_channel')]);
        buttons.push([Markup.button.callback('⬅️ Orqaga', 'admin_refresh')]);
        ctx.editMessageText(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
    };
};

module.exports = adminPanel;
