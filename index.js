// .env faylidan muhit o'zgaruvchilarini yuklash
import 'dotenv/config';

import { Bot, InlineKeyboard } from 'grammy';
import { kv } from '@vercel/kv';

// Bot ob'ektini yaratish
const bot = new Bot(process.env.BOT_TOKEN);


// Asosiy o'zgaruvchilar
const CHANNEL_ID = process.env.CHANNEL_ID;
const REQUIRED_CHANNEL = process.env.REQUIRED_CHANNEL;
// Vercel KV ga ulanish uchun .env da KV_REST_API_URL va KV_REST_API_TOKEN bo'lishi kerak.

// B) Majburiy obunani tekshiruvchi middleware / funksiya
async function checkSubscription(ctx, next) {
    // Agar majburiy kanal berilmagan bo'lsa, davom etamiz
    if (!REQUIRED_CHANNEL) return next();
    
    try {
        const userId = ctx.from.id;
        // Foydalanuvchi statusini tekshirish
        const member = await ctx.api.getChatMember(REQUIRED_CHANNEL, userId);
        
        if (['member', 'administrator', 'creator'].includes(member.status)) {
            // Agar a'zo bo'lsa, keyingi jarayonga o'tkazamiz
            return next();
        } else {
            // Obuna bo'lmagan bo'lsa ogohlantirish va inline tugma
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
        // Agar bot majburiy kanalda admin bo'lmasa, xato beradi
        await ctx.reply(`Obunani tekshirishda xatolik yuz berdi. Bot kanalda admin ekanligini tekshiring: ${REQUIRED_CHANNEL}`);
    }
}

// A) Auto-Indexing (Kanal postlarini ushlash)
bot.on('channel_post', async (ctx) => {
    // Agar xabar bizning kino kanalidan kelmagan bo'lsa, e'tibor bermaymiz
    if (ctx.channelPost.chat.id.toString() !== CHANNEL_ID) return;

    const msg = ctx.channelPost;
    
    // Xabarda video va caption (izoh) mavjudligini tekshiramiz
    if (msg.video && msg.caption) {
        // Izoh ichidan faqat raqamlardan iborat bo'lgan so'zni (kodni) qidiramiz
        const match = msg.caption.match(/\b\d+\b/);
        
        if (match) {
            const code = match[0];
            const messageId = msg.message_id;
            
            // Bazaga yozish (Vercel KV ga)
            try {
                await kv.set(code, messageId);
                console.log(`Yangi kino saqlandi: Kod = ${code}, Message ID = ${messageId}`);
            } catch (err) {
                console.error('KV ga saqlashda xato:', err);
            }
        }
    }
});

// "Tekshirish" tugmasi bosilganda ishlovchi handler
bot.callbackQuery('check_sub', async (ctx) => {
    try {
        const userId = ctx.from.id;
        const member = await ctx.api.getChatMember(REQUIRED_CHANNEL, userId);
        
        if (['member', 'administrator', 'creator'].includes(member.status)) {
            await ctx.answerCallbackQuery({ text: 'Obuna tasdiqlandi! Endi kino kodini yuborishingiz mumkin.', show_alert: true });
            // Xabarni o'chirib tashlash (tozalik uchun)
            await ctx.deleteMessage();
        } else {
            await ctx.answerCallbackQuery({ text: 'Hali obuna bo\'lmagansiz! Iltimos, kanalga a\'zo bo\'ling.', show_alert: true });
        }
    } catch (error) {
        console.error('Callback error:', error);
        await ctx.answerCallbackQuery({ text: 'Xatolik yuz berdi.', show_alert: true });
    }
});

// /start buyrug'i uchun handler
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

// C) Kinoni izlab topish va yuborish
bot.on('message:text', checkSubscription, async (ctx) => {
    const code = ctx.message.text.trim();
    
    // Kiritilgan matn faqat raqamlardan iborat ekanligini tekshirish
    if (!/^\d+$/.test(code)) {
        return ctx.reply('Iltimos, faqat raqamli kod yuboring.');
    }
    
    // Bazadan kodni qidirish (Vercel KV dan)
    try {
        const messageId = await kv.get(code);
        
        if (messageId) {
            try {
                // copyMessage orqali aynan kanaldan nusxalab foydalanuvchiga jo'natish
                await ctx.api.copyMessage(
                    ctx.chat.id,        // Qabul qiluvchi (foydalanuvchi)
                    CHANNEL_ID,         // Manba kanal ID-si
                    messageId           // Xabar ID-si
                );
            } catch (error) {
                console.error('Copy message error:', error);
                await ctx.reply('Kinoni yuborishda xatolik yuz berdi. Ehtimol, kino kanaldan o\'chirib tashlangan.');
            }
        } else {
            await ctx.reply('Kechirasiz, bunday kod bilan kino topilmadi.');
        }
    } catch (err) {
        console.error('KV dan qidirishda xato:', err);
        await ctx.reply('Ma\'lumotlar bazasi bilan xatolik yuz berdi.');
    }
});

// D) Xatoliklar va cheklovlarni boshqarish (Global)
bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`Error while handling update ${ctx.update.update_id}:`);
    const e = err.error;
    console.error(e);
});

// Botni ishga tushirish
bot.start({
    onStart: (botInfo) => {
        console.log(`Bot muvaffaqiyatli ishga tushdi: @${botInfo.username}`);
    }
});

// Render uchun oddiy HTTP server (Web Service sifatida yuklash uchun kerak)
import http from 'http';
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot ishlamoqda...');
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`Web server port: ${PORT} da ishga tushdi.`);
});

