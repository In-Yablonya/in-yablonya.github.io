/*
 * Подключается в <head> синхронно, до отрисовки страницы:
 * выставляет тему и язык, чтобы не было «вспышки» не того оформления.
 *
 * Тема:  localStorage "yablonya.theme" = "light" | "dark"; если пусто — берём системную.
 * Язык:  localStorage "yablonya.lang"  = "ru" | "en";      если пусто — по языку браузера.
 */
(function () {
  'use strict';
  var root = document.documentElement;

  function read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  // ---------- тема ----------
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function applyTheme() {
    var pref = read('yablonya.theme');
    if (pref !== 'light' && pref !== 'dark') pref = 'system';
    var dark = pref === 'dark' || (pref === 'system' && mq && mq.matches);
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    root.setAttribute('data-theme-pref', pref);
  }
  applyTheme();
  if (mq) {
    if (mq.addEventListener) mq.addEventListener('change', applyTheme);
    else if (mq.addListener) mq.addListener(applyTheme);
  }
  window.YablonyaTheme = { apply: applyTheme };

  // ---------- язык ----------
  var lang = read('yablonya.lang');
  if (lang !== 'ru' && lang !== 'en') {
    var list = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || 'en'];
    lang = 'en';
    for (var i = 0; i < list.length; i++) {
      var code = String(list[i]).toLowerCase().slice(0, 2);
      if (code === 'ru') { lang = 'ru'; break; }
      if (code === 'en') { lang = 'en'; break; }
    }
  }
  root.setAttribute('lang', lang);
  window.YablonyaLang = lang;
})();

/*
 * Анимации появления включаются только после первого настоящего кадра: если браузер кадры не рисует
 * (фоновая вкладка, служебное окно), страница просто остаётся видимой, без «невидимых» блоков.
 */
(function () {
  if (window.requestAnimationFrame) {
    window.requestAnimationFrame(function () { document.documentElement.classList.add('anim-on'); });
  }
})();
