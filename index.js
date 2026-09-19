import 'dotenv/config';
import { Telegraf } from 'telegraf';
import express from 'express';
import fs from 'fs/promises';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const SOURCE_CHANNEL_ID = process.env.CHANNEL_ID;

if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN topilmadi. .env faylida BOT_TOKEN o\'rnating.');
}

const bot = new Telegraf(BOT_TOKEN);
const DB_PATH = path.join(process.cwd(), 'database.json');
const pendingSave = new Map();
const channelPendingSave = new Map();

function extractCodeFromText(text) {
  if (!text || typeof text !== 'string') return null;

  const raw = text.trim();
  if (!raw) return null;

  const match = raw.match(/(?:kod|code|kino)\s*[:\-]?\s*(\d+|[a-zA-Z0-9\s-]{2,})/i);
  if (match) return match[1].trim();

  const numbers = [...raw.matchAll(/\d+/g)].map((n) => n[0]);
  if (numbers.length > 0) return numbers[numbers.length - 1];

  return raw;
}

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

function normalizeMovieKey(key) {
  if (key === null || key === undefined) return null;

  const text = String(key).trim();
  if (!text) return null;

  const explicit = text.match(/(?:^|\s|[\W_])(?:kod|code|kino|film|movie)\s*[:\-]?\s*([a-zA-Z0-9\-\s]{1,50})/i);
  if (explicit && explicit[1]) {
    const cleaned = explicit[1].trim();
    if (cleaned) return cleaned;
  }

  const plain = text.replace(/^(?:kod|code|kino|film|movie)\s*[:\-]?\s*/i, '').trim();
  if (plain) return plain;

  const digits = text.match(/\d+/g);
  if (digits && digits.length > 0) return digits[digits.length - 1];

  return text;
}

async function saveMovieByKey(key, messageId) {
  const db = await readDB();
  const cleanedKey = normalizeMovieKey(key);
  if (!cleanedKey) return;

  db[cleanedKey] = Number(messageId);
  await writeDB(db);
}

async function getMovieByKey(key) {
  const db = await readDB();
  const cleanedKey = normalizeMovieKey(key);
  if (!cleanedKey) return undefined;

  return db[cleanedKey] ?? db[String(cleanedKey)] ?? undefined;
}

bot.start((ctx) => {
  ctx.reply('Xush kelibsiz! Kino qidirish uchun raqam yoki istalgan nomni yozing. Kino saqlash uchun video/document yuboring yoki /save 101 deb yozing.');
});

bot.command('save', async (ctx) => {
  const args = ctx.message.text.split(/\s+/).slice(1);
  const key = normalizeMovieKey(args.join(' '));
  const reply = ctx.message.reply_to_message;

  if (!key) {
    await ctx.reply('Namuna: /save 101 yoki /save sherlok');
    return;
  }

  if (!reply || (!reply.video && !reply.document)) {
    await ctx.reply('Iltimos, video yoki faylga javob berib /save 101 yozing.');
    return;
  }

  await saveMovieByKey(key, reply.message_id);
  await ctx.reply(`✅ Kino "${key}" kodi saqlandi.`);
});

bot.command('kod', async (ctx) => {
  const args = ctx.message.text.split(/\s+/).slice(1);
  const key = normalizeMovieKey(args.join(' '));
  const reply = ctx.message.reply_to_message;

  if (!key) {
    await ctx.reply('Namuna: /kod 101');
    return;
  }

  if (!reply || (!reply.video && !reply.document)) {
    await ctx.reply('Iltimos, video yoki faylga javob berib /kod 101 yozing.');
    return;
  }

  await saveMovieByKey(key, reply.message_id);
  await ctx.reply(`✅ Kino "${key}" kodi saqlandi.`);
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

  await ctx.reply('Bu kinoni bazada qaysi raqam yoki so\'z bilan saqlamoqchisiz? Masalan: 101 yoki "sherlok". Agar kanalga allaqachon qo\'yilgan video bo\'lsa, /save 101 deb yozing.');
});

bot.on('channel_post', async (ctx) => {
  const post = ctx.channelPost;
  if (!post || (!post.video && !post.document)) return;

  const code = normalizeMovieKey(post.caption || '');
  if (code) {
    await saveMovieByKey(code, post.message_id);
    await ctx.telegram.sendMessage(post.chat.id, `✅ Kino kodi saqlandi: ${code}`);
    return;
  }

  const key = `${post.chat.id}:${post.message_id}`;
  channelPendingSave.set(key, post.message_id);
  await ctx.telegram.sendMessage(post.chat.id, 'Bu videoning kodi keyinchalik /save 101 yoki /kod 101 bilan biriktiriladi.');
});

bot.on('edited_channel_post', async (ctx) => {
  const post = ctx.editedChannelPost;
  if (!post || (!post.video && !post.document)) return;

  const code = normalizeMovieKey(post.caption || '');
  if (code) {
    await saveMovieByKey(code, post.message_id);
    await ctx.telegram.sendMessage(post.chat.id, `✅ Kino kodi yangilandi: ${code}`);
  }
});

bot.on('text', async (ctx) => {
  const text = ctx.message.text.trim();
  const chatId = String(ctx.chat.id);

  const saveInfo = pendingSave.get(chatId);
  if (saveInfo) {
    const key = normalizeMovieKey(text);

    if (!key) {
      await ctx.reply('Iltimos, saqlash uchun raqam yoki istalgan nom yozing.');
      return;
    }

    await saveMovieByKey(key, saveInfo.messageId);
    pendingSave.delete(chatId);

    await ctx.reply(`✅ Kino "${key}" nomi bilan bazaga saqlandi.`);
    return;
  }

  if (text.startsWith('/save ') || text.startsWith('/kod ')) {
    const key = normalizeMovieKey(text.split(/\s+/).slice(1).join(' '));
    if (!key) {
      await ctx.reply('Namuna: /save 101');
      return;
    }

    const reply = ctx.message.reply_to_message;
    if (!reply || (!reply.video && !reply.document)) {
      await ctx.reply('Iltimos, video yoki faylga javob berib /save 101 yozing.');
      return;
    }

    await saveMovieByKey(key, reply.message_id);
    await ctx.reply(`✅ Kino "${key}" kodi saqlandi.`);
    return;
  }

  if (!text) return;

  const messageId = await getMovieByKey(text);
  if (!messageId && messageId !== 0) {
    await ctx.reply('Bunday kino topilmadi. Qayta urinib ko\'ring.');
    return;
  }

  const sourceChatId = SOURCE_CHANNEL_ID || ctx.chat.id;

  if (!SOURCE_CHANNEL_ID) {
    await ctx.reply('CHANNEL_ID o\'rnatilmagan. .env faylida CHANNEL_ID ni yozing yoki botga kanal ID kiriting.');
    return;
  }

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