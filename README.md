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
REQUIRED_CHANNEL=@your_channel
# Private kanal bo'lsa, invite linkini yozing:
# REQUIRED_CHANNEL_URL=https://t.me/+your_invite_link
ADMIN_ID=123456789
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

## Foydalanuvchilar statistikasi

1. Telegram'da `@userinfobot` yoki boshqa ishonchli usul orqali o'z Telegram `user_id` raqamingizni oling.
2. `.env` faylidagi `ADMIN_ID` qiymatiga shu raqamni yozing.
3. Paketlar o'rnatilmagan bo'lsa, `npm install` buyrug'ini bajaring.
4. Botga `/start` yuborgan har bir foydalanuvchi `database.json` faylining `users` bo'limiga bir marta saqlanadi. Takroriy `/start` yangi yozuv yaratmaydi.
5. Admin botga `/stat` yuborsa, jami saqlangan foydalanuvchilar soni chiqadi. Boshqa foydalanuvchilarga bu buyruq bajarilmaydi.

`database.json` kino kodlarini yuqori darajadagi raqamli kalitlarda, foydalanuvchilarni esa `users` obyektida saqlaydi. Mavjud kino ma'lumotlari o'zgarmaydi.
