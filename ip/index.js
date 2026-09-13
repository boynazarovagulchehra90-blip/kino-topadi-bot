import { Telegraf } from 'telegraf';

export const code = async (inputs) => {
  // 1. Token va Telegram-dan kelgan ma'lumotni olish
  const botToken = inputs.botToken; // Activepieces inputs bo'limida botToken deb nomlang
  const update = inputs.body;       // Webhook triggeridan kelgan body (JSON)

  if (!botToken || !update) {
    return { status: 'error', message: 'Token yoki body yetib kelmadi' };
  }

  const bot = new Telegraf(botToken);

  // 2. Buyruqlar va mantiq
  bot.start((ctx) => ctx.reply('Salom! Bot Activepieces-da ishlamoqda! 🚀'));
  
  bot.on('text', (ctx) => {
    ctx.reply(`Siz yozdingiz: ${ctx.message.text}`);
  });

  // 3. Telegram-dan kelgan update-ni qayta ishlash
  try {
    await bot.handleUpdate(update);
    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false, error: error.message };
  }
};