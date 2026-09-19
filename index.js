import 'dotenv/config';
import { Telegraf } from 'telegraf';
import express from 'express';
import axios from 'axios';

// Express server sozlamasi (Render to'xtab qolmasligi uchun)
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot muvaffaqiyatli ishlayapti!');
});

app.listen(PORT, () => {
  console.log(`Server ${PORT}-portda ishga tushdi`);
});

// Bot ob'ektini yaratish
const bot = new Telegraf(process.env.BOT_TOKEN);

// Start buyrug'i
bot.start((ctx) => {
  ctx.reply('Xush kelibsiz! Kino topish uchun kino kodini yoki nomini yuboring.');
});

// Obunani tekshirish (bot.action ishlatiladi)
bot.action('check_sub', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await ctx.reply('Obuna tekshirildi!');
  } catch (error) {
    console.error('Callback xatoligi:', error);
  }
});

// Xabarlarni tutib olish va ishlov berish
// Oddiy namuna (agar kinolar ob'ektda saqlangan bo'lsa):
const movies = {
    '1': { title: 'Forsaj 10', file_id: 'BAACAgIAAxkBAA...' },
    '2': { title: 'Avatar 2', file_id: 'BAACAgIAAxkBAA...' }
};

bot.on('text', async (ctx) => {
    const code = ctx.message.text.trim(); // Foydalanuvchi yuborgan kod (masalan "1")

    if (movies[code]) {
        // Agar kino topilsa
        await ctx.reply(`🎬 Kino: ${movies[code].title}`);
        // await ctx.replyWithVideo(movies[code].file_id); // Video yuborish uchun
    } else {
        // Agar bunday kodli kino topilmasa
        await ctx.reply("❌ Bunday kodli kino topilmadi. Qaytadan urinib ko'ring.");
    }
});

// Botni ishga tushirish
bot.launch()
  .then(() => console.log('Bot muvaffaqiyatli ishga tushdi!'))
  .catch((err) => console.error('Botni ishga tushirishda xatolik:', err));

// Jarayonni to'g'ri to'xtatish
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));