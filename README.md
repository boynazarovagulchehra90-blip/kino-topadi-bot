# kino-topadi-bot

Bu bot sizning Telegram kanalidagi videolarni kod bo'yicha topib, foydalanuvchiga yuboradi.

## Qanday ishlaydi
1. Kanalga kino videolarini yuborasiz.
2. Videoning izohiga kod yozasiz, masalan: `101` yoki `sherlok`.
3. Botga shu kodni yozsangiz, kanal videosi qaytariladi.

## Sozlash
1. `.env` fayl yarating.
2. Quyidagilarni yozing:

```env
BOT_TOKEN=your_telegram_bot_token
CHANNEL_ID=-1001234567890
PORT=3000
```

3. `npm install`
4. `npm start`

## Foydalanish
- Kanalga video yuboring
- Video izohiga `Kod: 101` yoki `101` yozing
- Botga `101` ni yozing
- Bot sizga kanal videolarini chiqaradi

## Yangilanishlar
- Endi video kanalda allaqachon bo'lsa ham, keyin kode berish mumkin.
- `/save 101` yoki `/kod 101` komandasi ishlatiladi.
- Video ustiga javob berib ham kod qo'shish mumkin.
- Bot kanal videolarini kod bo'yicha topib beradi.
