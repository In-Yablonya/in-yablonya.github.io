// Проверка ссылок на игры из js/links.js: node .claude/check-links.js
// Для каждой ссылки отправляется запрос; в ответ ждём «200». Заодно проверяется, что у каждой игры
// из js/projects.js есть запись в links.js. Нужен Node.js 18+ и интернет.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

// Берёт из файла только данные (всё до функции, которая работает со страницей) и возвращает нужные переменные.
function load(file, names) {
  const ctx = {};
  let code = fs.readFileSync(path.join(root, file), 'utf8');
  const page = code.indexOf('(function () {');
  if (page !== -1) code = code.slice(0, page);
  vm.runInNewContext(code + '\n' + names.map((n) => `this.${n} = typeof ${n} !== 'undefined' ? ${n} : undefined;`).join('\n'), ctx);
  return ctx;
}

const LINK_KEYS = ['windows', 'linux', 'macos', 'android', 'web'];
const links = load('js/links.js', ['GAME_LINKS']).GAME_LINKS;
const games = load('js/projects.js', ['GAMES']).GAMES || [];

if (!links) { console.error('В js/links.js не найден GAME_LINKS'); process.exit(1); }

async function check(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(20000) });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, status: e.name === 'TimeoutError' ? 'нет ответа за 20 с' : 'ошибка сети' };
  }
}

(async () => {
  let bad = 0;

  for (const game of games) {
    if (!links[game.id]) { console.log(`✗ ${game.id}: нет записи в js/links.js`); bad++; }
  }
  for (const id of Object.keys(links)) {
    if (!games.some((g) => g.id === id)) { console.log(`! ${id}: такой игры нет в js/projects.js (лишняя запись)`); }
  }

  for (const [id, set] of Object.entries(links)) {
    for (const key of Object.keys(set)) {
      const url = set[key];
      const label = `${id} / ${key}`.padEnd(24);
      if (!LINK_KEYS.includes(key)) { console.log(`! ${label} неизвестный ключ (допустимы: ${LINK_KEYS.join(', ')})`); bad++; continue; }
      if (!url) { console.log(`… ${label} пусто: на сайте будет кнопка «скоро»`); continue; }
      if (!/^https?:\/\//i.test(url)) { console.log(`✗ ${label} ссылка должна начинаться с https://`); bad++; continue; }
      const r = await check(url);
      console.log(`${r.ok ? '✓' : '✗'} ${label} ${r.status}  ${r.ok ? '' : url}`);
      if (!r.ok) bad++;
    }
  }

  console.log(bad ? `\nПроблем: ${bad}. Проверьте строки со знаком ✗.` : '\nВсе ссылки работают.');
  process.exit(bad ? 1 : 0);
})();
