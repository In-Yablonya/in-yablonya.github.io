/*
 * Раздел «Проекты»: плитки игр и окно игры (скриншоты + кнопки скачивания).
 *
 * Здесь — описание игр: название, текст, иконка и скриншоты.
 * ССЫЛКИ НА ИГРЫ (скачивание и «Играть в браузере») лежат отдельно, в js/links.js:
 * при выходе новой версии правится только он. Ключ игры там совпадает с её id отсюда.
 *
 * Новая игра: добавьте здесь блок с новым id, положите иконку и скриншоты в img/games/<id>/,
 * а ссылки впишите в js/links.js.
 */
var GAMES = [
  {
    id: 'neon-catch',
    title: { ru: 'Neon Catch: Ultra', en: 'Neon Catch: Ultra' },
    description: {
      ru: 'Браузерная игра, в которой надо кликать по неоновому квадрату за время. Есть скины, улучшения, лидерборд, отзывы.',
      en: 'A browser game where you click a neon square against the clock. Skins, upgrades, a leaderboard and reviews.'
    },
    cover: 'img/games/neon-catch/icon.jpg',
    screenshots: [
      'img/games/neon-catch/screen-1.jpg',
      'img/games/neon-catch/screen-2.jpg',
      'img/games/neon-catch/screen-3.jpg'
    ]
  },
  {
    id: 'shootin',
    title: { ru: 'ShootIn', en: 'ShootIn' },
    description: {
      ru: 'Шутер-Платформер. 34 уровня, 8 боссов. Также есть поддержка чужих модов, а скачивать моды из сети легче лёгкого.',
      en: 'A shooter-platformer. 34 levels, 8 bosses. It also supports community mods, and downloading mods from the web is a breeze.'
    },
    cover: 'img/games/shootin/icon.jpg',
    screenshots: [
      'img/games/shootin/screen-1.jpg',
      'img/games/shootin/screen-2.jpg'
    ]
  },
  {
    id: 'be-bees',
    title: { ru: 'be_bees', en: 'be_bees' },
    description: {
      ru: 'Те же яйца, только в профиль. Те же шахматы, только тут пчёлы и осы. Играть можно локально и онлайн.',
      en: 'Same thing from a different angle: chess, but with bees and wasps. You can play locally and online.'
    },
    cover: 'img/games/be-bees/icon.jpg',
    screenshots: [
      'img/games/be-bees/screen-1.jpg',
      'img/games/be-bees/screen-2.jpg'
    ]
  },
  {
    id: 'afr',
    title: { ru: 'AFR', en: 'AFR' },
    description: {
      ru: 'Первая игра нашей студии. Трёхуровневый платформер, в котором нужно уклоняться и убегать от крестиков.',
      en: 'The first game by our studio. A three-level platformer where you dodge and run away from crosses.'
    },
    cover: 'img/games/afr/icon.jpg',
    screenshots: [
      'img/games/afr/screen-1.jpg',
      'img/games/afr/screen-2.jpg',
      'img/games/afr/screen-3.jpg'
    ]
  },
  {
    id: 'agraft18',
    title: { ru: 'AGraft18', en: 'AGraft18' },
    description: {
      ru: '2D-песочница, в которой можно строить, убивать врагов и мирных животных и гриндить, гриндить, гриндить…',
      en: 'A 2D sandbox where you can build, kill enemies and peaceful animals, and grind, grind, grind…'
    },
    cover: 'img/games/agraft18/icon.jpg',
    screenshots: [
      'img/games/agraft18/screen-1.jpg',
      'img/games/agraft18/screen-2.jpg'
    ]
  }
];

(function () {
  'use strict';

  var I = window.I18N;
  var Y = window.Yablonya;
  var h = Y.h;

  var PLACEHOLDER = 'img/placeholder.svg';
  var PLATFORMS = ['windows', 'linux', 'macos', 'android'];

  var grid = document.getElementById('games');
  var emptyNote = document.getElementById('games-empty');
  var dialog = document.getElementById('game-dialog');
  var dTitle = document.getElementById('game-title');
  var dGallery = document.getElementById('game-gallery');
  var dDesc = document.getElementById('game-desc');
  var dDownloads = document.getElementById('game-downloads');
  var dHints = document.getElementById('game-hints');

  var openGame = null;

  function has(obj, key) { return Object.prototype.hasOwnProperty.call(obj || {}, key); }

  // Если картинки нет — подставляем заглушку (один раз, чтобы не зациклиться).
  function img(src, alt, extra) {
    var el = h('img', { src: src, alt: alt || '', loading: 'lazy', decoding: 'async' });
    if (extra) Object.keys(extra).forEach(function (k) { el.setAttribute(k, extra[k]); });
    el.addEventListener('error', function () {
      if (el.getAttribute('data-fallback')) return;
      el.setAttribute('data-fallback', '1');
      el.src = PLACEHOLDER;
    });
    return el;
  }

  // ---------- плитки ----------
  function renderCards() {
    grid.textContent = '';
    emptyNote.hidden = GAMES.length > 0;
    GAMES.forEach(function (game) {
      var card = h('button', { class: 'game-card', type: 'button', 'aria-haspopup': 'dialog' },
        img(game.cover, '', { width: 512, height: 512 }),
        h('h2', { class: 'game-card__title', text: I.loc(game.title) }),
        h('p', { class: 'game-card__desc', text: I.loc(game.description) })
      );
      card.addEventListener('click', function () { show(game); });
      grid.append(card);
    });
  }

  // ---------- окно игры ----------
  function renderGallery(game) {
    dGallery.textContent = '';
    var shots = game.screenshots || [];
    if (!shots.length) {
      dGallery.append(h('p', { class: 'empty', text: I.t('game.noShots') }));
      return;
    }

    var main = h('div', { class: 'gallery__main' });
    var thumbs = h('div', { class: 'gallery__thumbs', role: 'group', 'aria-label': I.t('game.shots') });
    var buttons = [];

    function select(i) {
      main.textContent = '';
      main.append(img(shots[i], I.t('game.shot', { n: i + 1 }), { width: 960, height: 600, loading: 'eager' }));
      buttons.forEach(function (b, j) { b.setAttribute('aria-current', j === i ? 'true' : 'false'); });
    }

    shots.forEach(function (src, i) {
      var b = h('button', { class: 'gallery__thumb', type: 'button', 'aria-label': I.t('game.shot', { n: i + 1 }) },
        img(src, '', { width: 96, height: 56, loading: 'eager' }));
      b.addEventListener('click', function () { select(i); });
      buttons.push(b);
      thumbs.append(b);
    });

    dGallery.append(main);
    if (shots.length > 1) dGallery.append(thumbs);
    select(0);
  }

  // Кнопка скачивания: есть ссылка — это обычная ссылка на файл релиза,
  // браузер скачивает его сам, без перехода на другую страницу.
  function downloadButton(label, url, cls, isFile) {
    if (!url) {
      return h('span', { class: 'btn ' + cls, 'aria-disabled': 'true', role: 'link', text: label + ' (' + I.t('dl.soon') + ')' });
    }
    return h('a', { class: 'btn ' + cls, href: url, download: isFile ? '' : null,
      rel: 'noopener', target: isFile ? null : '_blank', text: label });
  }

  function renderDownloads(game) {
    dDownloads.textContent = '';
    dHints.textContent = '';
    var links = (window.GAME_LINKS || {})[game.id] || {};

    PLATFORMS.forEach(function (p) {
      if (!has(links, p)) return;
      dDownloads.append(downloadButton(I.t('dl.' + p), links[p], 'btn--primary', true));
    });
    if (has(links, 'web')) {
      dDownloads.append(downloadButton(I.t('dl.web'), links.web, 'btn--cyan', false));
    }

    if (has(links, 'windows')) dHints.append(hint('hint.windows'));
    if (has(links, 'android')) dHints.append(hint('hint.android'));
  }

  function hint(key) {
    return h('details', { class: 'hint' },
      h('summary', { text: I.t(key + '.title') }),
      h('p', { text: I.t(key + '.text') })
    );
  }

  function renderModal(game) {
    dTitle.textContent = I.loc(game.title);
    dDesc.textContent = I.loc(game.description);
    renderGallery(game);
    renderDownloads(game);
  }

  function show(game) {
    openGame = game;
    renderModal(game);
    dialog.showModal();
    dialog.scrollTop = 0;
  }

  dialog.addEventListener('close', function () { openGame = null; });

  document.addEventListener('yablonya:lang', function () {
    renderCards();
    if (openGame) renderModal(openGame);
  });

  renderCards();
})();
