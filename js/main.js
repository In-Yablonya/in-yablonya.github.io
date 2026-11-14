/*
 * Общее для всех страниц: переключатели темы и языка, окна <dialog>,
 * вспомогательные функции, загрузка Firebase (js/backend.js) и кэш данных с тихой предзагрузкой в простое.
 */
(function () {
  'use strict';

  var I = window.I18N;
  var SCRIPT_URL = document.currentScript && document.currentScript.src;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  // h('div', { class: 'x', text: '…' }, child, 'текст') — безопасное создание DOM без innerHTML.
  function h(tag, attrs) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c != null && c !== false) el.append(c);
    }
    return el;
  }

  function store(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* без сохранения */ }
  }

  function formatDate(ts) {
    if (!ts) return '';
    try {
      return new Date(ts).toLocaleString(I.lang === 'ru' ? 'ru-RU' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
    } catch (e) { return ''; }
  }

  // ---------- переключатели темы и языка ----------
  function updateToggles() {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    $$('[data-theme-toggle]').forEach(function (b) {
      b.textContent = dark ? '☀' : '☾';
      b.setAttribute('aria-label', I.t('aria.theme'));
      b.setAttribute('title', I.t('aria.theme'));
    });
    $$('[data-lang-toggle]').forEach(function (b) {
      b.textContent = I.lang === 'ru' ? 'EN' : 'RU';
      b.setAttribute('aria-label', I.t('aria.lang'));
      b.setAttribute('title', I.t('aria.lang'));
    });
  }

  function announcePrefs() {
    document.dispatchEvent(new CustomEvent('yablonya:prefs', {
      detail: {
        lang: I.lang,
        theme: document.documentElement.getAttribute('data-theme-pref') || 'system'
      }
    }));
  }

  document.addEventListener('click', function (e) {
    var themeBtn = e.target.closest('[data-theme-toggle]');
    if (themeBtn) {
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      store('yablonya.theme', dark ? 'light' : 'dark');
      window.YablonyaTheme.apply();
      updateToggles();
      announcePrefs();
      return;
    }
    var langBtn = e.target.closest('[data-lang-toggle]');
    if (langBtn) {
      I.setLang(I.lang === 'ru' ? 'en' : 'ru');
      announcePrefs();
    }
  });

  document.addEventListener('yablonya:lang', updateToggles);
  updateToggles();

  // ---------- окна <dialog> ----------
  // Закрываются по крестику, Esc и клику на тёмную подложку.
  function wireDialog(dialog) {
    var pressedOnBackdrop = false;
    dialog.addEventListener('mousedown', function (e) { pressedOnBackdrop = (e.target === dialog); });
    dialog.addEventListener('click', function (e) {
      if (e.target === dialog && pressedOnBackdrop) dialog.close();
    });
    $$('[data-close]', dialog).forEach(function (b) {
      b.addEventListener('click', function () { dialog.close(); });
    });
  }
  $$('dialog').forEach(wireDialog);

  // ---------- Firebase (грузится только когда нужен) ----------
  function firebaseConfigured() {
    var c = window.firebaseConfig;
    if (!c) return false;
    return ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'appId'].every(function (k) {
      return typeof c[k] === 'string' && c[k] !== '' && c[k].indexOf('...') === -1;
    });
  }

  var backendPromise = null;
  function backend() {
    if (location.protocol === 'file:') return Promise.reject(new Error('file-protocol'));
    if (!firebaseConfigured()) return Promise.reject(new Error('not-configured'));
    if (!backendPromise) {
      var url = new URL('backend.js', SCRIPT_URL).href;
      backendPromise = import(url).catch(function (err) { backendPromise = null; throw err; });
    }
    return backendPromise;
  }

  // Текст ошибки для окна: объясняет частые причины и добавляет технический код, чтобы было ясно, что не так.
  // notConfiguredKey — какой текст показать, если Firebase ещё не подключён.
  function explain(err, fallbackKey, notConfiguredKey) {
    var msg = err && err.message;
    if (msg === 'file-protocol') return I.t('error.file');
    if (msg === 'not-configured') return I.t(notConfiguredKey || 'support.unavailable');
    var code = err && (err.code || msg);
    return I.t(fallbackKey) + (code ? ' (' + code + ')' : '');
  }

  // Запоминаем, администратор ли игрок: кнопки для администраторов показываются сразу, не дожидаясь Firebase.
  // Настоящие права всё равно проверяют правила базы.
  var ADMIN_HINT_KEY = 'yablonya.admin';

  function adminHint() {
    try { return localStorage.getItem(ADMIN_HINT_KEY) === '1'; } catch (e) { return false; }
  }

  document.addEventListener('yablonya:state', function (e) {
    var admin = !!(e.detail && e.detail.support);
    try {
      if (admin) localStorage.setItem(ADMIN_HINT_KEY, '1'); else localStorage.removeItem(ADMIN_HINT_KEY);
    } catch (err) { /* не критично */ }
  });

  // Имя игрока: свой никнейм или «Пользователь N» (на языке сайта).
  function displayName(profile) {
    profile = profile || {};
    if (profile.nickname) return profile.nickname;
    return I.t('user.default', { n: profile.number != null ? profile.number : '' }).trim();
  }

  // ---------- кэш данных (новости, отзывы, посты) ----------
  // Данные «Новостей», «Отзывов» и «Империи Мха» лежат в базе, и первый ответ приходит не сразу.
  // Поэтому их заранее, пока человек читает другие страницы, кладут в кэш браузера (localStorage):
  // страница при открытии рисует то, что лежит в кэше, а свежие данные из базы подменяют его через мгновение.
  // В кэше только публичные данные; «своё» (свой отзыв, своя оценка) в нём не хранится.
  var CACHE_PREFIX = 'yablonya.cache.';
  var CACHE_MAX_AGE = 30 * 24 * 3600 * 1000;      // совсем старый кэш не показываем
  var CACHE_MAX_SIZE = 900000;                    // символов на одну запись: localStorage небольшой
  var PREFETCH_FRESH = 60 * 1000;                 // что обновлялось недавно, второй раз не читаем
  var PREFETCH_PARTS = ['news', 'newsComments', 'newsReactions', 'reviews', 'mossPosts'];

  var cache = {
    entry: function (name) {
      try {
        var e = JSON.parse(localStorage.getItem(CACHE_PREFIX + name));
        if (e && e.v === 1 && typeof e.at === 'number' && Date.now() - e.at < CACHE_MAX_AGE) return e;
      } catch (err) { /* кэша нет или он испорчен */ }
      return null;
    },
    get: function (name) {
      var e = cache.entry(name);
      return e ? e.data : null;
    },
    age: function (name) {
      var e = cache.entry(name);
      return e ? Date.now() - e.at : Infinity;
    },
    set: function (name, data) {
      try {
        var raw = JSON.stringify({ v: 1, at: Date.now(), data: data });
        if (raw.length > CACHE_MAX_SIZE) localStorage.removeItem(CACHE_PREFIX + name);
        else localStorage.setItem(CACHE_PREFIX + name, raw);
      } catch (err) { /* нет места или хранилище закрыто: страница просто загрузится как обычно */ }
    }
  };

  // Предзагрузка: в простое, после загрузки страницы, и маленькими порциями.
  // Она же при первом заходе выдаёт ID (b.init), поэтому подключаемся и тогда, когда данные не нужны.
  function prefetchData() {
    var conn = navigator.connection;
    var saving = !!(conn && conn.saveData);                    // человек включил экономию трафика: данные не тянем
    var stale = saving ? [] : PREFETCH_PARTS.filter(function (name) { return cache.age(name) > PREFETCH_FRESH; });
    var hasId = /(?:^|;\s*)yablonya_id=[^;]+/.test(document.cookie);
    if (!stale.length && hasId) return;                        // и ID уже есть, и кэш свежий: Firebase не нужен

    backend()
      .then(function (b) {
        return b.init(window.Yablonya.currentPrefs()).then(function () {
          if (stale.length) return b.prefetch(stale, function (name, data) { cache.set(name, data); });
        });
      })
      .catch(function (err) { console.warn('Предзагрузка не удалась:', err && err.message); });
  }

  window.addEventListener('load', function () {
    if (!firebaseConfigured()) return;
    if (window.requestIdleCallback) window.requestIdleCallback(prefetchData, { timeout: 4000 });
    else setTimeout(prefetchData, 1500);
  });

  // Если Firebase уже загружен, сообщаем ему о смене языка/темы (чтобы сохранить в players/<id>).
  document.addEventListener('yablonya:prefs', function (e) {
    if (!backendPromise) return;
    backendPromise.then(function (b) { return b.savePrefs(e.detail); }).catch(function () { /* не критично */ });
  });

  window.Yablonya = {
    $: $,
    $$: $$,
    h: h,
    formatDate: formatDate,
    wireDialog: wireDialog,
    firebaseConfigured: firebaseConfigured,
    backend: backend,
    cache: cache,
    displayName: displayName,
    adminHint: adminHint,
    explain: explain,
    currentPrefs: function () {
      return { lang: I.lang, theme: document.documentElement.getAttribute('data-theme-pref') || 'system' };
    }
  };
})();
