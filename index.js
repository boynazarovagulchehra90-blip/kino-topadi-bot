import 'dotenv/config';
import { Telegraf } from 'telegraf';
import express from 'express';
import fs from 'fs/promises';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;
const bot = new Telegraf(process.env.BOT_TOKEN);
const DB_PATH = path.join(process.cwd(), 'database.json');
const pendingSave = new Map();

app.get('/', (req, res) => {
  res.send('Bot muvaffaqiyatli ishlayapti!');
});

app.listen(PORT, () => {
  console.log(`Server ${PORT}-portda ishga tushdi`);
});

async function readDB() {
  try {
    const data = await fs.readFile(DB_PATH, 'utf-8');
    const parsed = JSON.parse(data);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    return {};
  }
}

async function writeDB(data) {
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
}

async function saveMovieByKey(key, messageId) {
  const db = await readDB();
  const cleanedKey = String(key).trim();
  if (!cleanedKey) return;

  db[cleanedKey] = Number(messageId);
  await writeDB(db);
}

async function getMovieByKey(key) {
  const db = await readDB();
  const cleanedKey = String(key).trim();
  return cleanedKey ? db[cleanedKey] : undefined;
}

bot.start((ctx) => {
  ctx.reply('Xush kelibsiz! Kino qidirish uchun raqam yoki istalgan nomni yozing. Kino saqlash uchun video/document yuboring.');
});

bot.on(['video', 'document'], async (ctx) => {
  const message = ctx.message;
  const userId = ctx.from.id;
  const chatId = String(ctx.chat.id);

  pendingSave.set(chatId, {
    userId,
    messageId: message.message_id,
    type: message.video ? 'video' : 'document',
  });

  await ctx.reply('Bu kinoni bazada qaysi raqam yoki so\'z bilan saqlamoqchisiz? Masalan: 101 yoki "sherlok"');
});

bot.on('text', async (ctx) => {
  const text = ctx.message.text.trim();
  const chatId = String(ctx.chat.id);

  const saveInfo = pendingSave.get(chatId);
  if (saveInfo) {
    const key = text.replace(/\s+/g, ' ').trim();

    if (!key) {
      await ctx.reply('Iltimos, saqlash uchun raqam yoki istalgan nom yozing.');
      return;
    }

    await saveMovieByKey(key, saveInfo.messageId);
    pendingSave.delete(chatId);

    await ctx.reply(`✅ Kino "${key}" nomi bilan bazaga saqlandi.`);
    return;
  }

  if (!text) return;

  const messageId = await getMovieByKey(text);
  if (!messageId && messageId !== 0) {
    await ctx.reply('Bunday kino topilmadi. Qayta urinib ko\'ring.');
    return;
  }

  const sourceChatId = process.env.CHANNEL_ID || ctx.chat.id;

  try {
    await ctx.telegram.copyMessage(ctx.chat.id, sourceChatId, Number(messageId));
  } catch (error) {
    console.error('Copy message xatosi:', error);
    await ctx.reply(`Kino topildi, lekin uni ko\'chirishda xatolik yuz berdi. Message ID: ${messageId}`);
  }
});

bot.action('check_sub', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await ctx.reply('Obuna tekshirildi!');
  } catch (error) {
    console.error('Callback xatoligi:', error);
  }
});

bot.launch()
  .then(() => console.log('Bot muvaffaqiyatli ishga tushdi!'))
  .catch((err) => console.error('Botni ishga tushirishda xatolik:', err));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));