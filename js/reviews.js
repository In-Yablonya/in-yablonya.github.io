/*
 * «Отзывы»: оценка звёздами (1–5) и необязательный комментарий.
 * Читают все. Писать может любой посетитель (у него автоматически есть аккаунт): один аккаунт — один отзыв,
 * его можно изменить или удалить. Администратор дополнительно может удалить чужой отзыв (модерация).
 *
 * Отзывы можно отфильтровать (положительные 4–5, нейтральные 3, критические 1–2, либо любые звёзды
 * по строкам сводки) и отсортировать. Всё это происходит в браузере: данные приходят целиком.
 * Хранение и правила доступа: js/backend.js (раздел «Отзывы») и database.rules.json.
 */
(function () {
  'use strict';

  var Y = window.Yablonya;
  var I = window.I18N;
  var h = Y.h;
  var $ = Y.$;

  var statusEl = $('#rv-status');
  var avgNum = $('#rv-avg-num');
  var avgStars = $('#rv-avg-stars');
  var avgCount = $('#rv-avg-count');
  var presetsEl = $('#rv-presets');
  var barsEl = $('#rv-bars');
  var form = $('#rv-form');
  var formTitle = $('#rv-form-title');
  var picker = $('#rv-picker');
  var textEl = $('#rv-text');
  var sendBtn = $('#rv-send');
  var delMine = $('#rv-delete-mine');
  var formStatus = $('#rv-form-status');
  var sortEl = $('#rv-sort');
  var shownEl = $('#rv-shown');
  var listEl = $('#rv-list');
  var emptyEl = $('#rv-empty');

  // Пресеты фильтра: какие звёзды показывать. Пустой список — все отзывы.
  var PRESETS = [
    { id: 'all', stars: [] },
    { id: 'positive', stars: [4, 5] },
    { id: 'neutral', stars: [3] },
    { id: 'critical', stars: [1, 2] }
  ];

  var api = null;
  var isAdmin = false;
  var myName = '';
  var watchedFor = null;          // ID игрока, для которого сейчас идёт подписка (после смены аккаунта подписываемся заново)
  var stopWatching = null;
  var reviews = [];
  var selected = {};              // выбранные звёзды: { 5: true, 4: true }; пусто — показываем все
  var rating = 0;                 // оценка, выбранная в форме
  var formTouched = false;        // человек уже правит форму: не затираем её при обновлении данных
  var pickerEls = [];

  function setStatus(el, kind, text) {
    el.textContent = text || '';
    el.className = 'status' + (kind ? ' status--' + kind : '');
  }

  function fail(el, err, key) {
    console.error(err);
    setStatus(el, 'error', Y.explain(err, key));
  }

  function dateOnly(ts) {
    if (!ts) return '';
    try {
      return new Date(ts).toLocaleDateString(I.lang === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) { return ''; }
  }

  function number1(value) {
    try {
      return value.toLocaleString(I.lang === 'ru' ? 'ru-RU' : 'en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    } catch (e) { return value.toFixed(1); }
  }

  // «1 отзыв», «2 отзыва», «5 отзывов».
  function countText(n) {
    var key;
    if (I.lang === 'ru') {
      var m10 = n % 10;
      var m100 = n % 100;
      key = (m10 === 1 && m100 !== 11) ? '1' : (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) ? '2' : '5';
    } else {
      key = n === 1 ? '1' : '5';
    }
    return I.t('reviews.count.' + key, { n: n });
  }

  // Ряд из пяти звёзд: первые n закрашены.
  function stars(n, label) {
    var box = h('span', { class: 'stars', role: 'img', 'aria-label': label || I.t('reviews.stars.label', { n: n }) });
    for (var i = 1; i <= 5; i++) box.append(h('span', { class: 'stars__s' + (i <= n ? ' is-on' : ''), 'aria-hidden': 'true', text: '★' }));
    return box;
  }

  // ---------- фильтр ----------
  function selectedList() {
    return [1, 2, 3, 4, 5].filter(function (n) { return selected[n]; });
  }

  function setSelected(list) {
    selected = {};
    list.forEach(function (n) { selected[n] = true; });
    renderAll();
  }

  function toggleStar(n) {
    if (selected[n]) delete selected[n]; else selected[n] = true;
    renderAll();
  }

  function sameSet(a, b) {
    return a.length === b.length && a.every(function (n) { return b.indexOf(n) >= 0; });
  }

  // ---------- сводка и фильтры ----------
  function counts() {
    var c = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach(function (r) { c[r.rating]++; });
    return c;
  }

  function renderSummary() {
    var c = counts();
    var total = reviews.length;
    var sum = 0;
    reviews.forEach(function (r) { sum += r.rating; });
    var avg = total ? sum / total : 0;

    avgNum.textContent = total ? number1(avg) : '–';
    avgStars.textContent = '';
    if (total) avgStars.append(stars(Math.round(avg), I.t('reviews.avg.aria', { n: number1(avg) })));
    avgCount.textContent = total ? countText(total) : I.t('reviews.avg.none');

    barsEl.textContent = '';
    [5, 4, 3, 2, 1].forEach(function (n) {
      var pct = total ? Math.round(c[n] / total * 100) : 0;
      var row = h('button', {
        class: 'rv-bar', type: 'button', 'aria-pressed': selected[n] ? 'true' : 'false',
        'aria-label': I.t('reviews.bar.aria', { n: n, count: countText(c[n]) }),
        onclick: function () { toggleStar(n); }
      },
        h('span', { class: 'rv-bar__label', 'aria-hidden': 'true', text: n + ' ★' }),
        h('span', { class: 'rv-bar__track', 'aria-hidden': 'true' }, h('span', { class: 'rv-bar__fill', style: 'width:' + pct + '%' })),
        h('span', { class: 'rv-bar__n', 'aria-hidden': 'true', text: String(c[n]) })
      );
      barsEl.append(row);
    });
  }

  function renderPresets() {
    presetsEl.textContent = '';
    var current = selectedList();
    PRESETS.forEach(function (p) {
      var active = sameSet(current, p.stars);
      presetsEl.append(h('button', {
        class: 'btn btn--sm rv-preset' + (active ? ' is-active' : ''), type: 'button', 'aria-pressed': active ? 'true' : 'false',
        text: I.t('reviews.preset.' + p.id), onclick: function () { setSelected(p.stars); }
      }));
    });
  }

  // ---------- список ----------
  function compare(mode) {
    return function (a, b) {
      if (mode === 'old') return a.createdAt - b.createdAt;
      if (mode === 'high') return (b.rating - a.rating) || (b.createdAt - a.createdAt);
      if (mode === 'low') return (a.rating - b.rating) || (b.createdAt - a.createdAt);
      return b.createdAt - a.createdAt;
    };
  }

  function removeReview(r) {
    if (!api || !window.confirm(I.t('reviews.delete.confirm'))) return;
    api.deleteReview(r.id).catch(function (err) { fail(statusEl, err, 'reviews.error'); });
  }

  function reviewEl(r) {
    var meta = dateOnly(r.createdAt);
    if (r.updatedAt) meta += (meta ? ' · ' : '') + I.t('reviews.edited');

    var head = h('div', { class: 'review__head' }, stars(r.rating), h('strong', { text: r.name || '—' }));
    if (r.mine) head.append(h('span', { class: 'badge', text: I.t('reviews.mine.badge') }));

    var card = h('article', { class: 'review' + (r.mine ? ' review--mine' : '') }, head, h('p', { class: 'review__meta', text: meta }));
    if (r.text) card.append(h('p', { class: 'review__text', text: r.text }));
    if (isAdmin && !r.mine) {
      card.append(h('div', { class: 'row' },
        h('button', { class: 'btn btn--sm', type: 'button', text: I.t('post.delete'), onclick: function () { removeReview(r); } })));
    }
    return card;
  }

  function renderList() {
    var wanted = selectedList();
    var shown = reviews.filter(function (r) { return !wanted.length || wanted.indexOf(r.rating) >= 0; });
    shown.sort(compare(sortEl.value));

    listEl.textContent = '';
    shown.forEach(function (r) { listEl.append(reviewEl(r)); });

    shownEl.textContent = reviews.length ? I.t('reviews.shown', { n: shown.length, total: reviews.length }) : '';
    emptyEl.hidden = shown.length > 0;
    emptyEl.textContent = I.t(reviews.length ? 'reviews.empty.filtered' : 'reviews.empty');
  }

  // ---------- форма ----------
  function paintPicker(upTo) {
    pickerEls.forEach(function (p, i) { p.label.classList.toggle('is-on', i < upTo); });
  }

  function buildPicker() {
    picker.textContent = '';
    pickerEls = [];
    [1, 2, 3, 4, 5].forEach(function (n) {
      var input = h('input', { type: 'radio', name: 'rating', id: 'rv-star-' + n, value: String(n) });
      var label = h('label', { class: 'star-picker__star', for: 'rv-star-' + n, text: '★' });
      input.addEventListener('change', function () {
        rating = n; formTouched = true; paintPicker(rating); setStatus(formStatus, '', '');
      });
      label.addEventListener('mouseenter', function () { paintPicker(n); });
      label.addEventListener('mouseleave', function () { paintPicker(rating); });
      pickerEls.push({ input: input, label: label });
      picker.append(input, label);
    });
  }

  function updateFormTexts() {
    var mine = reviews.filter(function (r) { return r.mine; })[0];
    formTitle.textContent = I.t(mine ? 'reviews.form.edit' : 'reviews.form.new');
    sendBtn.textContent = I.t(mine ? 'reviews.save' : 'reviews.send');
    delMine.hidden = !mine;
    pickerEls.forEach(function (p, i) {
      var text = I.t('reviews.stars.label', { n: i + 1 });
      p.label.setAttribute('aria-label', text);
      p.label.setAttribute('title', text);
    });
  }

  // Подставляем в форму свой отзыв (если он есть), пока человек её не правит.
  function syncForm() {
    updateFormTexts();
    if (formTouched) return;
    var mine = reviews.filter(function (r) { return r.mine; })[0];
    rating = mine ? mine.rating : 0;
    textEl.value = mine ? mine.text : '';
    pickerEls.forEach(function (p, i) { p.input.checked = (i + 1) === rating; });
    paintPicker(rating);
  }

  textEl.addEventListener('input', function () { formTouched = true; });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!api) return;
    if (!rating) { setStatus(formStatus, 'error', I.t('reviews.rating.pick')); return; }

    sendBtn.disabled = true;
    setStatus(formStatus, '', I.t('support.loading'));
    // Имя берём заново: человек мог сменить никнейм в «Аккаунте» уже на этой странице.
    api.init(Y.currentPrefs())
      .then(function (state) { return api.saveReview(rating, textEl.value, Y.displayName(state.profile)); })
      .then(function (result) {
        formTouched = false;
        setStatus(formStatus, 'ok', I.t(result === 'created' ? 'reviews.created' : 'reviews.updated'));
        syncForm();
      })
      .catch(function (err) { fail(formStatus, err, 'reviews.error'); })
      .then(function () { sendBtn.disabled = false; });
  });

  delMine.addEventListener('click', function () {
    if (!api || !window.confirm(I.t('reviews.delete.mine.confirm'))) return;
    delMine.disabled = true;
    api.deleteMyReview()
      .then(function () {
        formTouched = false; rating = 0; textEl.value = '';
        setStatus(formStatus, 'ok', I.t('reviews.deleted'));
        syncForm();
      })
      .catch(function (err) { fail(formStatus, err, 'reviews.error'); })
      .then(function () { delMine.disabled = false; });
  });

  sortEl.addEventListener('change', renderList);

  // ---------- запуск ----------
  function renderAll() {
    renderSummary();
    renderPresets();
    renderList();
    updateFormTexts();
  }

  function loadFail(err) {
    console.error(err);
    setStatus(statusEl, 'error', Y.explain(err, 'reviews.loadError'));
  }

  // Подписка на отзывы; после смены аккаунта («Войти по ID») подписываемся заново: «мой» отзыв зависит от аккаунта.
  function watch(state) {
    if (watchedFor === state.playerId) return;
    if (stopWatching) stopWatching();
    watchedFor = state.playerId;
    stopWatching = api.watchReviews(function (list) { reviews = list; renderAll(); syncForm(); }, loadFail);
  }

  function start() {
    buildPicker();
    renderAll();
    if (!Y.firebaseConfigured()) {
      sendBtn.disabled = true;
      setStatus(statusEl, 'error', I.t('reviews.loadError'));
      return;
    }

    Y.backend()
      .then(function (b) {
        return b.init(Y.currentPrefs()).then(function (state) {
          api = b;
          isAdmin = !!state.support;
          myName = Y.displayName(state.profile);
          document.dispatchEvent(new CustomEvent('yablonya:state', { detail: state }));
          watch(state);
        });
      })
      .catch(loadFail);
  }

  document.addEventListener('yablonya:state', function (e) {
    var state = e.detail;
    if (!state || !api) return;
    isAdmin = !!state.support;
    myName = Y.displayName(state.profile);
    if (state.playerId !== watchedFor) { formTouched = false; watch(state); }
    else renderList();
  });

  document.addEventListener('yablonya:lang', function () { renderAll(); syncForm(); });
  start();
})();
