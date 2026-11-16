/*
 * Рейтинг пользователя: насколько вы хороший пользователь студии. Виден только самому игроку, в окне «Аккаунт»
 * (общей таблицы лидеров нет). Очки дают:
 *   - скачанные игры (каждая новая игра — много очков, повторные скачивания — чуть-чуть);
 *   - дни, в которые вы заходили на сайт;
 *   - время на сайте (пока страница открыта и вы на ней);
 *   - у администраторов ещё: опубликованные новости и посты, ответы в поддержке.
 *
 * Как это работает. Счётчики копятся на самом устройстве (localStorage, ключ yablonya.stats) и ничего не стоят базе.
 * Пока у посетителя нет аккаунта (он только смотрит сайт), в базу не попадает ничего: ни записи, ни входа.
 * Аккаунт создаётся, когда человек скачивает игру (или меняет никнейм, задаёт пароль, оставляет отзыв/комментарий,
 * пишет в поддержку); тогда накопленное уходит в players/<ID>/stats (см. addStats в js/backend.js), а дальше
 * счётчики отправляются пачками примерно раз в минуту. Правила базы: database.rules.json (players/$pid/stats).
 *
 * Счётчики считает браузер, поэтому накрутить их при желании можно (как и лайки): это игра, а не защита.
 * Очки и уровни настраиваются ниже, в POINTS и LEVELS.
 */
(function () {
  'use strict';

  var Y = window.Yablonya;
  var I = window.I18N;

  // ---------- настройки ----------
  var POINTS = {
    game: 10,              // за каждую скачанную игру (разные игры)
    repeatDownload: 2,     // за каждое повторное скачивание
    day: 3,                // за каждый день с визитом
    tenMinutes: 1,         // за каждые 10 минут на сайте…
    timeMax: 50,           // …но не больше стольки очков за время
    newsPost: 5,           // администраторы: за новость
    mossPost: 5,           // администраторы: за пост про «Империю Мха»
    supportReply: 1        // администраторы: за ответ в поддержке
  };

  // Уровни: с какого числа очков начинается каждый. Названия: ключи rating.level.<key> в js/i18n.js.
  var LEVELS = [
    { key: 'guest', at: 0 },
    { key: 'player', at: 10 },
    { key: 'regular', at: 30 },
    { key: 'friend', at: 80 },
    { key: 'legend', at: 200 }
  ];

  var STORAGE_KEY = 'yablonya.stats';
  var DAY_KEY = 'yablonya.stats.day';
  var TICK_MS = 5000;               // как часто засчитываем время
  var SAVE_EVERY_MS = 60 * 1000;    // как часто отправляем накопленное, когда аккаунт уже есть
  var GAME_ID = /^[a-z0-9-]{1,40}$/;

  // ---------- то, что накопилось на устройстве и ещё не ушло в базу ----------
  function empty() { return { days: 0, seconds: 0, downloads: 0, games: [] }; }

  function read() {
    try {
      var p = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (p && typeof p === 'object') {
        return {
          days: Math.max(0, Math.floor(Number(p.days) || 0)),
          seconds: Math.max(0, Math.floor(Number(p.seconds) || 0)),
          downloads: Math.max(0, Math.floor(Number(p.downloads) || 0)),
          games: Array.isArray(p.games) ? p.games.filter(function (g) { return GAME_ID.test(String(g)); }) : []
        };
      }
    } catch (e) { /* пусто или испорчено */ }
    return empty();
  }

  function write(p) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch (e) { /* нет места или хранилище закрыто: просто не считаем */ }
  }

  function isEmpty(p) { return !p.days && !p.seconds && !p.downloads && !p.games.length; }

  // Забрать накопленное (чтобы отправить) и обнулить; restore вернёт его, если отправка не удалась.
  function take() {
    var p = read();
    write(empty());
    return p;
  }

  function restore(p) {
    var now = read();
    now.days += p.days;
    now.seconds += p.seconds;
    now.downloads += p.downloads;
    p.games.forEach(function (g) { if (now.games.indexOf(g) < 0) now.games.push(g); });
    write(now);
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  // Новый день с визитом.
  function touchDay() {
    var t = today();
    try {
      if (localStorage.getItem(DAY_KEY) === t) return;
      localStorage.setItem(DAY_KEY, t);
    } catch (e) { return; }
    var p = read();
    p.days += 1;
    write(p);
  }

  // Время на сайте: считаем, пока страница видна и в фокусе.
  function tick() {
    if (document.visibilityState !== 'visible' || !document.hasFocus()) return;
    var p = read();
    p.seconds += TICK_MS / 1000;
    write(p);
  }

  // ---------- отправка в базу ----------
  function hasAccountCookie() { return /(?:^|;\s*)yablonya_id=[^;]+/.test(document.cookie); }

  var flushing = null;

  // Отправляет накопленное. register = true: если аккаунта ещё нет, создать его (человек скачал игру и т. п.).
  // Без register у посетителя без аккаунта ничего не отправляется: счётчики остаются на устройстве.
  function flush(register) {
    if (flushing) return flushing;
    if (isEmpty(read())) return Promise.resolve();
    if (!Y.firebaseConfigured() || location.protocol === 'file:') return Promise.resolve();
    if (!register && !hasAccountCookie()) return Promise.resolve();

    flushing = Y.backend()
      .then(function (b) {
        return b.init(Y.currentPrefs())
          .then(function (state) {
            if (state.registered) return true;
            return register ? b.register().then(function () { return true; }) : false;
          })
          .then(function (canSave) {
            if (!canSave) return null;                 // аккаунта нет и создавать его не нужно: счётчики остаются на устройстве
            var delta = take();
            if (isEmpty(delta)) return null;
            return b.addStats(delta).then(
              function (saved) { if (!saved) restore(delta); },
              function (err) { restore(delta); throw err; }
            );
          });
      })
      .catch(function (err) { console.warn('Рейтинг: счётчики не отправились, повторим позже:', err && (err.code || err.message)); })
      .then(function () {
        flushing = null;
        document.dispatchEvent(new CustomEvent('yablonya:stats'));
      });
    return flushing;
  }

  // Игрок скачал файл игры: засчитываем и, если аккаунта ещё не было, создаём его.
  function download(gameId) {
    if (!GAME_ID.test(String(gameId))) return Promise.resolve();
    var p = read();
    p.downloads += 1;
    if (p.games.indexOf(gameId) < 0) p.games.push(gameId);
    write(p);
    return flush(true);
  }

  // ---------- очки и уровни ----------
  // Итог для показа: сохранённое в базе (saved, может быть null) плюс то, что ещё на устройстве.
  function total(saved) {
    var p = read();
    var s = saved || { days: 0, seconds: 0, downloads: 0, games: [], newsPosts: 0, mossPosts: 0, supportReplies: 0 };
    var games = (s.games || []).slice();
    p.games.forEach(function (g) { if (games.indexOf(g) < 0) games.push(g); });
    return {
      days: (s.days || 0) + p.days,
      seconds: (s.seconds || 0) + p.seconds,
      downloads: Math.max((s.downloads || 0) + p.downloads, games.length),
      games: games.length,
      newsPosts: s.newsPosts || 0,
      mossPosts: s.mossPosts || 0,
      supportReplies: s.supportReplies || 0
    };
  }

  function score(t, isAdmin) {
    var points = t.games * POINTS.game
      + Math.max(0, t.downloads - t.games) * POINTS.repeatDownload
      + t.days * POINTS.day
      + Math.min(POINTS.timeMax, Math.floor(t.seconds / 600) * POINTS.tenMinutes);
    if (isAdmin) points += t.newsPosts * POINTS.newsPost + t.mossPosts * POINTS.mossPost + t.supportReplies * POINTS.supportReply;
    return points;
  }

  // Уровень по очкам: { key, index, next: { key, at } | null, progress: 0..1 до следующего }.
  function level(points) {
    var index = 0;
    LEVELS.forEach(function (l, i) { if (points >= l.at) index = i; });
    var cur = LEVELS[index];
    var next = LEVELS[index + 1] || null;
    return {
      key: cur.key,
      index: index,
      next: next,
      progress: next ? Math.min(1, (points - cur.at) / (next.at - cur.at)) : 1
    };
  }

  // «2 ч 15 мин» / «2 h 15 min» / «меньше минуты».
  function duration(seconds) {
    var minutes = Math.floor(seconds / 60);
    if (minutes < 1) return I.t('rating.time.less');
    var h = Math.floor(minutes / 60);
    var m = minutes % 60;
    return (h ? I.t('rating.time.h', { n: h }) + ' ' : '') + (m || !h ? I.t('rating.time.m', { n: m }) : '');
  }

  // ---------- запуск ----------
  touchDay();
  setInterval(tick, TICK_MS);

  // Когда у игрока есть аккаунт, раз в минуту отправляем накопленное время (если набралось хотя бы полминуты).
  setInterval(function () {
    if (hasAccountCookie() && read().seconds >= 30) flush(false);
  }, SAVE_EVERY_MS);

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden' && hasAccountCookie()) flush(false);
  });

  // Аккаунт появился (или игрок вошёл по ID): отправляем то, что накопилось до этого.
  document.addEventListener('yablonya:registered', function () { flush(false); });

  // Страница открылась: если аккаунт уже есть, отправляем накопленное в простое.
  window.addEventListener('load', function () {
    if (!hasAccountCookie()) return;
    if (window.requestIdleCallback) window.requestIdleCallback(function () { flush(false); }, { timeout: 5000 });
    else setTimeout(function () { flush(false); }, 2500);
  });

  Y.stats = {
    download: download,
    flush: flush,
    total: total,
    score: score,
    level: level,
    duration: duration,
    LEVELS: LEVELS,
    POINTS: POINTS
  };
})();
