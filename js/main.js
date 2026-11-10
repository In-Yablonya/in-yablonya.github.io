/*
 * Общее для всех страниц: переключатели темы и языка, окна <dialog>,
 * вспомогательные функции и ленивая загрузка Firebase (js/backend.js).
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

  // Первый заход: ID выдаётся сам, без нажатий. Если cookie с ID уже есть, Firebase не грузим —
  // он подключится позже, когда понадобится (аккаунт, поддержка).
  function hasIdCookie() {
    return /(?:^|;\s*)yablonya_id=[^;]+/.test(document.cookie);
  }

  window.addEventListener('load', function () {
    if (!firebaseConfigured() || hasIdCookie()) return;
    var issue = function () {
      backend()
        .then(function (b) { return b.init(window.Yablonya.currentPrefs()); })
        .catch(function (err) { console.warn('ID пока не выдан:', err && err.message); });
    };
    if (window.requestIdleCallback) window.requestIdleCallback(issue, { timeout: 3000 });
    else setTimeout(issue, 1500);
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
    displayName: displayName,
    adminHint: adminHint,
    explain: explain,
    currentPrefs: function () {
      return { lang: I.lang, theme: document.documentElement.getAttribute('data-theme-pref') || 'system' };
    }
  };
})();
