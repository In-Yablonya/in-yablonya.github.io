// Забыл пароль? Вычисляет «почту» аккаунта по его ID: node .claude/login-email.js <ID игрока>
//
// Игроки входят по паре «ID + пароль», а Firebase хранит вход как «почта + пароль». Почта вычисляется из ID
// (см. loginEmail в js/backend.js) и настоящей не является. Скрипт печатает этот адрес, чтобы найти пользователя
// в консоли Firebase: Authentication → Users.
//
// Как сбросить пароль игроку (сначала убедитесь, что просит владелец аккаунта):
//   1. Authentication → Users → найдите адрес из этого скрипта → «Удалить аккаунт».
//   2. Realtime Database → Данные → passwordOwner → удалите запись с ID игрока.
//   3. Готово: игрок входит по одному ID и задаёт новый пароль в окне «Аккаунт».
const crypto = require('crypto');

const id = String(process.argv[2] || '').trim();
if (!/^[A-Za-z0-9_-]{20,128}$/.test(id)) {
  console.error('Использование: node .claude/login-email.js <ID игрока>');
  process.exit(1);
}
const hex = crypto.createHash('sha256').update('yablonya-login:' + id).digest('hex');
console.log('u' + hex.slice(0, 40) + '@accounts.yablonya.invalid');
