// .env faylidan muhit o'zgaruvchilarini yuklash
require('dotenv').config();

const { Bot, InlineKeyboard } = require('grammy');
const fs = require('fs');
const path = require('path');

// Bot ob'ektini yaratish
const bot = new Bot(process.env.BOT_TOKEN);

// Asosiy o'zgaruvchilar
const CHANNEL_ID = process.env.CHANNEL_ID;
const REQUIRED_CHANNEL = process.env.REQUIRED_CHANNEL;
const DB_FILE = path.join(__dirname, 'database.json');

// database.json fayli yo'q bo'lsa, uni yaratish
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({}));
}

// Bazadan ma'lumotlarni o'qish
function getDatabase() {
    const data = fs.readFileSync(DB_FILE);
    return JSON.parse(data);
}

// Bazaga ma'lumotlarni saqlash
function saveDatabase(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// B) Majburiy obunani tekshiruvchi middleware / funksiya
async function checkSubscription(ctx, next) {
    // Vaqtincha majburiy obuna o'chirib qo'yildi
    return next();
    
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
            
            // Bazaga yozish
            const db = getDatabase();
            db[code] = messageId;
            saveDatabase(db);
            console.log(`Yangi kino saqlandi: Kod = ${code}, Message ID = ${messageId}`);
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
bot.command('start', checkSubscription, async (ctx) => {
    await ctx.reply('Assalomu alaykum! Kino kodini yuboring va men sizga kinoni tashlab beraman.');
});

// C) Kinoni izlab topish va yuborish
bot.on('message:text', checkSubscription, async (ctx) => {
    const code = ctx.message.text.trim();
    
    // Kiritilgan matn faqat raqamlardan iborat ekanligini tekshirish
    if (!/^\d+$/.test(code)) {
        return ctx.reply('Iltimos, faqat raqamli kod yuboring.');
    }
    
    // Bazadan kodni qidirish
    const db = getDatabase();
    const messageId = db[code];
    
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
