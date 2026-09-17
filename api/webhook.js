require('dotenv').config();
const { Bot, InlineKeyboard } = require('grammy');
const { kv } = require('@vercel/kv');

const bot = new Bot(process.env.BOT_TOKEN);

const CHANNEL_ID = process.env.CHANNEL_ID;
const REQUIRED_CHANNEL = process.env.REQUIRED_CHANNEL;

async function checkSubscription(ctx, next) {
    if (!REQUIRED_CHANNEL) return next();
    
    try {
        const userId = ctx.from.id;
        const member = await ctx.api.getChatMember(REQUIRED_CHANNEL, userId);
        
        if (['member', 'administrator', 'creator'].includes(member.status)) {
            return next();
        } else {
            const channelUrl = REQUIRED_CHANNEL.startsWith('@') 
                ? `https://t.me/${REQUIRED_CHANNEL.replace('@', '')}` 
                : 'https://t.me/c/' + REQUIRED_CHANNEL.replace('-100', '') + '/1';

            const keyboard = new InlineKeyboard()
                .url(REQUIRED_CHANNEL, channelUrl)
                .row()
                .text('Obunani tasdiqlash', 'check_sub');
                
            await ctx.reply('Botdan foydalanish uchun quyidagi kanalga obuna bo\'lishingiz majburiy!', {
                reply_markup: keyboard
            });
        }
    } catch (error) {
        console.error('Subscription check error:', error);
        await ctx.reply(`Obunani tekshirishda xatolik yuz berdi. Bot kanalda admin ekanligini tekshiring: ${REQUIRED_CHANNEL}`);
    }
}

bot.on('channel_post', async (ctx) => {
    if (ctx.channelPost.chat.id.toString() !== CHANNEL_ID) return;

    const msg = ctx.channelPost;
    
    if (msg.video && msg.caption) {
        const match = msg.caption.match(/\b\d+\b/);
        
        if (match) {
            const code = match[0];
            const messageId = msg.message_id;
            
            // Vercel KV ga saqlash
            await kv.set(code, messageId);
            console.log(`Yangi kino saqlandi: Kod = ${code}, Message ID = ${messageId}`);
        }
    }
});

bot.callbackQuery('check_sub', async (ctx) => {
    try {
        const userId = ctx.from.id;
        const member = await ctx.api.getChatMember(REQUIRED_CHANNEL, userId);
        
        if (['member', 'administrator', 'creator'].includes(member.status)) {
            await ctx.answerCallbackQuery({ text: 'Obuna tasdiqlandi! Endi kino kodini yuborishingiz mumkin.', show_alert: true });
            await ctx.deleteMessage();
        } else {
            await ctx.answerCallbackQuery({ text: 'Hali obuna bo\'lmagansiz! Iltimos, kanalga a\'zo bo\'ling.', show_alert: true });
        }
    } catch (error) {
        console.error('Callback error:', error);
        await ctx.answerCallbackQuery({ text: 'Xatolik yuz berdi.', show_alert: true });
    }
});

bot.command('start', async (ctx) => {
    await ctx.reply('Assalomu alaykum! Kino kodini yuboring va men sizga kinoni tashlab beraman.');
    
    // Obunani shu yerda tekshiramiz
    if (REQUIRED_CHANNEL) {
        try {
            const userId = ctx.from.id;
            const member = await ctx.api.getChatMember(REQUIRED_CHANNEL, userId);
            
            if (!['member', 'administrator', 'creator'].includes(member.status)) {
                const channelUrl = REQUIRED_CHANNEL.startsWith('@') 
                    ? `https://t.me/${REQUIRED_CHANNEL.replace('@', '')}` 
                    : 'https://t.me/c/' + REQUIRED_CHANNEL.replace('-100', '') + '/1';

                const keyboard = new InlineKeyboard()
                    .url(REQUIRED_CHANNEL, channelUrl)
                    .row()
                    .text('Obunani tasdiqlash', 'check_sub');
                    
                await ctx.reply('Botdan to\'liq foydalanish uchun quyidagi kanalga obuna bo\'lishingiz majburiy!', {
                    reply_markup: keyboard
                });
            }
        } catch (error) {
            console.error('Subscription check error in /start:', error);
        }
    }
});

bot.on('message:text', checkSubscription, async (ctx) => {
    const code = ctx.message.text.trim();
    
    if (!/^\d+$/.test(code)) {
        return ctx.reply('Iltimos, faqat raqamli kod yuboring.');
    }
    
    // Vercel KV dan o'qish
    const messageId = await kv.get(code);
    
    if (messageId) {
        try {
            await ctx.api.copyMessage(
                ctx.chat.id,
                CHANNEL_ID,
                messageId
            );
        } catch (error) {
            console.error('Copy message error:', error);
            await ctx.reply('Kinoni yuborishda xatolik yuz berdi. Ehtimol, kino kanaldan o\'chirib tashlangan.');
        }
    } else {
        await ctx.reply('Kechirasiz, bunday kod bilan kino topilmadi.');
    }
});

bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`Error while handling update ${ctx.update.update_id}:`);
    console.error(err.error);
});

// Vercel Serverless Function uchun to'g'ridan-to'g'ri handleUpdate ishlatamiz
// webhookCallback('express') ishlatilmaydi — Vercel req.header() metodini qo'llab-quvvatlamaydi

module.exports = async function handler(req, res) {
    // GET so'rovi: webhook o'rnatish yoki sog'liq tekshiruvi
    if (req.method === 'GET') {
        if (req.url && req.url.includes('/set-webhook')) {
            try {
                const webhookUrl = `https://${req.headers.host}/api/webhook`;
                const apiUrl = `https://api.telegram.org/bot${process.env.BOT_TOKEN}/setWebhook?url=${webhookUrl}`;

                const response = await fetch(apiUrl);
                const data = await response.json();

                return res.status(200).json({
                    message: "Webhook sozlandi!",
                    url: webhookUrl,
                    telegram_response: data
                });
            } catch (err) {
                return res.status(500).json({ error: "Xatolik yuz berdi", details: err.message });
            }
        }
        return res.status(200).send('Bot is running... ✅');
    }

    // POST so'rovi: Telegram webhook update
    if (req.method === 'POST') {
        try {
            // req.body string bo'lishi mumkin (Vercel ba'zan parse qilmaydi)
            let update = req.body;
            if (typeof update === 'string') {
                update = JSON.parse(update);
            }

            if (!update || typeof update !== 'object') {
                return res.status(400).send('Bad Request: invalid update');
            }

            // Express yoki middleware'siz to'g'ridan-to'g'ri handleUpdate chaqiramiz
            await bot.handleUpdate(update);
            return res.status(200).send('OK');
        } catch (err) {
            console.error('handleUpdate xatosi:', err);
            return res.status(500).json({ error: err.message });
        }
    }

    // Boshqa metodlar
    return res.status(405).send('Method Not Allowed');
};
