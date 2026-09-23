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

function extractDigitsFromText(text) {
  if (!text || typeof text !== 'string') return null;

  const numbers = [...String(text).matchAll(/\d+/g)].map((n) => n[0]);
  return numbers.length > 0 ? numbers[numbers.length - 1] : null;
}

function extractCodeFromText(text) {
  if (!text || typeof text !== 'string') return null;

  const raw = text.trim();
  if (!raw) return null;

  const match = raw.match(/(?:kod|code|kino|film|movie|kanal|channel|kanalim)\s*[:\-]?\s*([a-zA-Z0-9\s\-]{1,80})/i);
  if (match) {
    const digits = extractDigitsFromText(match[1]);
    if (digits) return digits;
  }

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

async function saveUser(user) {
  const db = await readDB();
  if (!db.users || typeof db.users !== 'object' || Array.isArray(db.users)) {
    db.users = {};
  }

  const userId = String(user.id);
  if (db.users[userId]) return false;

  db.users[userId] = {
    user_id: user.id,
    username: user.username || null,
  };
  await writeDB(db);
  return true;
}

async function getUserCount() {
  const db = await readDB();
  return db.users && typeof db.users === 'object' && !Array.isArray(db.users)
    ? Object.keys(db.users).length
    : 0;
}

function isAdmin(ctx) {
  return process.env.ADMIN_ID && String(ctx.from?.id) === String(process.env.ADMIN_ID).trim();
}

function normalizeMovieKey(key) {
  if (key === null || key === undefined) return null;

  const text = String(key).trim();
  if (!text) return null;

  const explicit = text.match(/(?:^|\s|[\W_])(?:kod|code|kino|film|movie|kanal|channel|kanalim)\s*[:\-]?\s*([a-zA-Z0-9\-\s]{1,80})/i);
  if (explicit && explicit[1]) {
    const digits = extractDigitsFromText(explicit[1]);
    if (digits) return digits;
  }

  const plain = text.replace(/^(?:kod|code|kino|film|movie|kanal|channel|kanalim)\s*[:\-]?\s*/i, '').trim();
  const plainDigits = extractDigitsFromText(plain);
  if (plainDigits) return plainDigits;

  return /^\d+$/.test(plain) ? plain : null;
}

async function getNextAvailableCode() {
  const db = await readDB();
  const numericKeys = Object.keys(db)
    .map((key) => Number(key))
    .filter((value) => Number.isInteger(value) && value > 0);

  return numericKeys.length > 0 ? Math.max(...numericKeys) + 1 : 1;
}

async function saveMovieByKey(key, messageId) {
  const db = await readDB();
  let cleanedKey = normalizeMovieKey(key);

  if (!cleanedKey) {
    cleanedKey = String(await getNextAvailableCode());
  }

  if (db[cleanedKey] !== undefined) return false;

  db[cleanedKey] = Number(messageId);
  await writeDB(db);
  return cleanedKey;
}

async function getMovieByKey(key) {
  const db = await readDB();
  const cleanedKey = normalizeMovieKey(key);
  if (!cleanedKey) return undefined;

  return db[cleanedKey] ?? db[String(cleanedKey)] ?? undefined;
}

async function deleteMovieByKey(key) {
  const db = await readDB();
  const cleanedKey = normalizeMovieKey(key);
  if (!cleanedKey) return false;

  if (db[cleanedKey] === undefined && db[String(cleanedKey)] === undefined) {
    return false;
  }

  delete db[cleanedKey];
  delete db[String(cleanedKey)];
  await writeDB(db);
  return true;
}

bot.start(async (ctx) => {
  try {
    await saveUser(ctx.from);
  } catch (error) {
    console.error('Foydalanuvchini saqlashda xatolik:', error);
  }

  const userCount = await getUserCount();
  return ctx.reply(`Xush kelibsiz!\n\nBotdagi jami obunachilar: ${userCount}\n\nKino qidirish uchun faqat raqamli kod yuboring. Kino saqlash uchun video/document yuboring yoki /save 101 deb yozing.`);
});

bot.command('stat', async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.reply('Bu buyruq faqat bot admini uchun mavjud.');
    return;
  }

  await ctx.reply(`Botdagi jami obunachilar: ${await getUserCount()}`);
});

bot.command('save', async (ctx) => {
  const args = ctx.message.text.split(/\s+/).slice(1);
  const key = normalizeMovieKey(args.join(' '));
  const reply = ctx.message.reply_to_message;

  if (!key) {
    await ctx.reply('Namuna: /save 101');
    return;
  }

  if (!reply || (!reply.video && !reply.document)) {
    await ctx.reply('Iltimos, video yoki faylga javob berib /save 101 yozing.');
    return;
  }

  const saved = await saveMovieByKey(key, reply.message_id);
  if (saved) {
    await ctx.reply(`✅ Kino "${key}" kodi saqlandi.`);
  } else {
    await ctx.reply(`⚠️ "${key}" kodi avvaldan mavjud. Bir xil kodni qayta saqlamayman.`);
  }
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

  const saved = await saveMovieByKey(key, reply.message_id);
  if (saved) {
    await ctx.reply(`✅ Kino "${key}" kodi saqlandi.`);
  } else {
    await ctx.reply(`⚠️ "${key}" kodi avvaldan mavjud. Bir xil kodni qayta saqlamayman.`);
  }
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

  await ctx.reply('Bu kinoni bazada qaysi raqamli kod bilan saqlamoqchisiz? Masalan: 101. Agar kanalga allaqachon qo\'yilgan video bo\'lsa, /save 101 deb yozing.');
});

bot.on('channel_post', async (ctx) => {
  const post = ctx.channelPost;
  if (!post || (!post.video && !post.document)) return;

  const code = normalizeMovieKey(post.caption || '');
  if (code) {
    const saved = await saveMovieByKey(code, post.message_id);
    if (!saved) {
      console.log(`Takroriy kod qoldirildi: ${code}`);
    }
    return;
  }

  const nextCode = await saveMovieByKey(null, post.message_id);
  if (nextCode) {
    console.log(`Avtomatik saqlandi: ${nextCode}`);
  }
});

bot.on('edited_channel_post', async (ctx) => {
  const post = ctx.editedChannelPost;
  if (!post || (!post.video && !post.document)) return;

  const code = normalizeMovieKey(post.caption || '');
  if (code) {
    const saved = await saveMovieByKey(code, post.message_id);
    if (!saved) {
      console.log(`Takroriy kod qoldirildi: ${code}`);
    }
  }
});

bot.on('text', async (ctx) => {
  const text = ctx.message.text.trim();
  const chatId = String(ctx.chat.id);

  const saveInfo = pendingSave.get(chatId);
  if (saveInfo) {
    const key = normalizeMovieKey(text);

    if (!key) {
      await ctx.reply('Iltimos, saqlash uchun faqat raqamli kod yozing.');
      return;
    }

    const saved = await saveMovieByKey(key, saveInfo.messageId);
    pendingSave.delete(chatId);

    if (saved) {
      await ctx.reply(`✅ Kino "${key}" nomi bilan bazaga saqlandi.`);
    } else {
      await ctx.reply(`⚠️ "${key}" kodi avvaldan mavjud. Bir xil kodni qayta saqlamayman.`);
    }
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

    const saved = await saveMovieByKey(key, reply.message_id);
    if (saved) {
      await ctx.reply(`✅ Kino "${key}" kodi saqlandi.`);
    } else {
      await ctx.reply(`⚠️ "${key}" kodi avvaldan mavjud. Bir xil kodni qayta saqlamayman.`);
    }
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
    const msg = String(error?.description || error?.message || '');

    if (msg.includes('message to copy not found') || msg.includes('message not found')) {
      await deleteMovieByKey(text);
      await ctx.reply('Bu kino kanaldan o\'chirilgan. Kod bazasi tozalandı va keyingi urinishda yangisi ishlatiladi.');
      return;
    }

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