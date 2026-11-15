/*
 * Отзывы об играх: блок в окне игры («Проекты»), под кнопками скачивания.
 * Работает так же, как раздел «Отзывы» (js/reviews.js): оценка звёздами (1–5) и необязательный комментарий, сводка со
 * средней оценкой, фильтры (пресеты и строки со звёздами), сортировка. Читают все; писать может любой посетитель
 * (аккаунт у него есть автоматически): один аккаунт — один отзыв об одной игре, его можно изменить или удалить.
 * Администратор дополнительно может удалить чужой отзыв.
 *
 * Отличие от «Отзывов»: отзывы привязаны к игре, лежат в gameReviews/<id игры>/… (см. js/backend.js и
 * database.rules.json), а подписка на них идёт только, пока окно этой игры открыто.
 *
 * Подключение: projects.js вызывает Yablonya.GameReviews.open(id игры, контейнер) при открытии окна игры и
 * Yablonya.GameReviews.close() при закрытии.
 */
(function () {
  'use strict';

  var Y = window.Yablonya;
  var I = window.I18N;
  var h = Y.h;

  // Пресеты фильтра: какие звёзды показывать. Пустой список — все отзывы.
  var PRESETS = [
    { id: 'all', stars: [] },
    { id: 'positive', stars: [4, 5] },
    { id: 'neutral', stars: [3] },
    { id: 'critical', stars: [1, 2] }
  ];

  // Подключение к базе: одно на страницу, не зависит от того, какая игра открыта.
  var api = null;                 // модуль backend.js
  var state = null;               // последнее известное состояние игрока (ID, профиль, права)
  var isAdmin = false;
  var connecting = null;

  // Открытая игра. Пока окно закрыто, gameId === null.
  var gameId = null;
  var els = {};                   // элементы блока
  var reviews = [];
  var selected = {};              // выбранные звёзды: { 5: true, 4: true }; пусто — показываем все
  var rating = 0;                 // оценка, выбранная в форме
  var formTouched = false;        // человек уже правит форму: не затираем её при обновлении данных
  var pickerEls = [];
  var watchedFor = null;          // ID игрока, для которого идёт подписка (после смены аккаунта подписываемся заново)
  var stopWatching = null;

  // Что уже есть: отзывы из кэша браузера или из базы. Пока их нет совсем, блок пишет «Загружаем…»,
  // а не «Отзывов пока нет»: человек не должен подумать, что их нет, и уйти.
  var ready = false;
  var failed = false;
  var slowShown = false;
  var slowTimer = null;

  function loadingNow() { return !ready && !failed && Y.firebaseConfigured(); }

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

  // ---------- разметка блока ----------
  function build(container) {
    var e = {};
    e.status = h('p', { class: 'status', role: 'status', 'aria-live': 'polite' });
    e.avgNum = h('div', { class: 'rv-avg__num', text: '–' });
    e.avgStars = h('div', {});
    e.avgCount = h('p', { class: 'rv-avg__count' });
    e.presets = h('div', { class: 'row rv-presets', role: 'group', 'data-i18n-attr': 'aria-label:reviews.filter.title' });
    e.bars = h('div', { class: 'rv-bars', role: 'group', 'data-i18n-attr': 'aria-label:reviews.stars.hint' });

    e.formTitle = h('h4', { class: 'gr__form-title', 'data-i18n': 'reviews.form.new' });
    e.picker = h('div', { class: 'star-picker__row' });
    e.text = h('textarea', {
      class: 'textarea', id: 'gr-text', maxlength: '1000', rows: '3',
      'data-i18n-attr': 'placeholder:reviews.comment.placeholder'
    });
    e.send = h('button', { class: 'btn btn--primary', type: 'submit', 'data-i18n': 'reviews.send' });
    e.delMine = h('button', { class: 'btn', type: 'button', hidden: true, 'data-i18n': 'reviews.delete.mine' });
    e.formStatus = h('p', { class: 'status', role: 'status', 'aria-live': 'polite' });
    e.form = h('form', { class: 'gr__form', novalidate: true },
      e.formTitle,
      h('fieldset', { class: 'star-picker' },
        h('legend', { 'data-i18n': 'reviews.rating' }),
        e.picker),
      h('div', { class: 'field' },
        h('label', { for: 'gr-text', 'data-i18n': 'reviews.comment' }),
        e.text),
      h('p', { class: 'muted small', 'data-i18n': 'gr.comment.hint' }),
      h('div', { class: 'row' }, e.send, e.delMine),
      e.formStatus);

    e.sort = h('select', { class: 'input rv-sort', id: 'gr-sort' },
      h('option', { value: 'new', 'data-i18n': 'reviews.sort.new' }),
      h('option', { value: 'old', 'data-i18n': 'reviews.sort.old' }),
      h('option', { value: 'high', 'data-i18n': 'reviews.sort.high' }),
      h('option', { value: 'low', 'data-i18n': 'reviews.sort.low' }));
    e.shown = h('p', { class: 'muted small', 'aria-live': 'polite' });
    e.list = h('div', { class: 'reviews' });
    e.empty = h('p', { class: 'empty is-loading', text: I.t('gr.loading') });

    container.textContent = '';
    container.append(h('section', { class: 'gr', 'aria-labelledby': 'gr-title' },
      h('h3', { class: 'gr__title', id: 'gr-title', 'data-i18n': 'gr.title' }),
      e.status,
      h('div', { class: 'rv-summary' },
        h('div', { class: 'rv-avg' }, e.avgNum, e.avgStars, e.avgCount),
        h('div', {}, e.presets, e.bars)),
      e.form,
      h('div', { class: 'section__bar' },
        h('h4', { class: 'gr__list-title', 'data-i18n': 'reviews.title' }),
        h('div', { class: 'row' },
          h('label', { for: 'gr-sort', class: 'muted small', 'data-i18n': 'reviews.sort' }),
          e.sort)),
      e.shown, e.list, e.empty));
    I.apply(container);
    els = e;

    buildPicker();
    e.text.addEventListener('input', function () { formTouched = true; });
    e.sort.addEventListener('change', renderList);
    e.form.addEventListener('submit', submit);
    e.delMine.addEventListener('click', deleteMine);
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

    els.avgNum.textContent = total ? number1(avg) : '–';
    els.avgStars.textContent = '';
    if (total) els.avgStars.append(stars(Math.round(avg), I.t('reviews.avg.aria', { n: number1(avg) })));
    els.avgCount.textContent = total ? countText(total)
      : loadingNow() ? I.t('reviews.loading')
      : (ready || !Y.firebaseConfigured()) ? I.t('reviews.avg.none') : '';

    els.bars.textContent = '';
    [5, 4, 3, 2, 1].forEach(function (n) {
      var pct = total ? Math.round(c[n] / total * 100) : 0;
      els.bars.append(h('button', {
        class: 'rv-bar', type: 'button', 'aria-pressed': selected[n] ? 'true' : 'false',
        'aria-label': I.t('reviews.bar.aria', { n: n, count: countText(c[n]) }),
        onclick: function () { toggleStar(n); }
      },
        h('span', { class: 'rv-bar__label', 'aria-hidden': 'true', text: n + ' ★' }),
        h('span', { class: 'rv-bar__track', 'aria-hidden': 'true' }, h('span', { class: 'rv-bar__fill', style: 'width:' + pct + '%' })),
        h('span', { class: 'rv-bar__n', 'aria-hidden': 'true', text: String(c[n]) })
      ));
    });
  }

  function renderPresets() {
    els.presets.textContent = '';
    var current = selectedList();
    PRESETS.forEach(function (p) {
      var active = sameSet(current, p.stars);
      els.presets.append(h('button', {
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
    var forGame = gameId;
    api.deleteGameReview(forGame, r.id).catch(function (err) {
      if (gameId === forGame) fail(els.status, err, 'reviews.error');
    });
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
    shown.sort(compare(els.sort.value));

    els.list.textContent = '';
    shown.forEach(function (r) { els.list.append(reviewEl(r)); });

    els.shown.textContent = reviews.length ? I.t('reviews.shown', { n: shown.length, total: reviews.length }) : '';

    var waiting = !ready && Y.firebaseConfigured();         // отзывов пока нет, потому что они ещё не пришли
    els.empty.classList.toggle('is-loading', loadingNow());
    if (waiting) {
      els.empty.hidden = failed;                            // загрузка не удалась: об этом скажет надпись об ошибке
      els.empty.textContent = I.t('gr.loading');
    } else {
      els.empty.hidden = shown.length > 0;
      els.empty.textContent = I.t(reviews.length ? 'reviews.empty.filtered' : 'gr.empty');
    }
  }

  // ---------- кэш и медленная связь ----------
  function cacheName() { return 'gameReviews.' + gameId; }

  // Отзывы из кэша браузера: показываем сразу, пока база ещё отвечает. Пустой кэш ничего не говорит, его пропускаем.
  function useCache() {
    var cached = Y.cache.get(cacheName());
    if (!cached || !cached.length) return;
    reviews = cached.map(function (r) { return Object.assign({}, r, { mine: false }); });
    ready = true;
  }

  // Если база молчит дольше обычного (плохая связь), говорим об этом, а не крутим «Загружаем…» молча.
  function watchSlow() {
    slowTimer = setTimeout(function () {
      if (ready || failed) return;
      slowShown = true;
      setStatus(els.status, '', I.t('load.slow'));
    }, 10000);
  }

  function gotReviews() {
    if (slowTimer) { clearTimeout(slowTimer); slowTimer = null; }
    if (slowShown) { slowShown = false; setStatus(els.status, '', ''); }
  }

  // ---------- форма ----------
  function paintPicker(upTo) {
    pickerEls.forEach(function (p, i) { p.label.classList.toggle('is-on', i < upTo); });
  }

  function buildPicker() {
    els.picker.textContent = '';
    pickerEls = [];
    [1, 2, 3, 4, 5].forEach(function (n) {
      var input = h('input', { type: 'radio', name: 'gr-rating', id: 'gr-star-' + n, value: String(n) });
      var label = h('label', { class: 'star-picker__star', for: 'gr-star-' + n, text: '★' });
      input.addEventListener('change', function () {
        rating = n; formTouched = true; paintPicker(rating); setStatus(els.formStatus, '', '');
      });
      label.addEventListener('mouseenter', function () { paintPicker(n); });
      label.addEventListener('mouseleave', function () { paintPicker(rating); });
      pickerEls.push({ input: input, label: label });
      els.picker.append(input, label);
    });
  }

  function myReview() {
    return reviews.filter(function (r) { return r.mine; })[0];
  }

  function updateFormTexts() {
    var mine = myReview();
    els.formTitle.textContent = I.t(mine ? 'reviews.form.edit' : 'reviews.form.new');
    els.send.textContent = I.t(mine ? 'reviews.save' : 'reviews.send');
    els.delMine.hidden = !mine;
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
    var mine = myReview();
    rating = mine ? mine.rating : 0;
    els.text.value = mine ? mine.text : '';
    pickerEls.forEach(function (p, i) { p.input.checked = (i + 1) === rating; });
    paintPicker(rating);
  }

  function submit(e) {
    e.preventDefault();
    if (!api) return;
    if (!rating) { setStatus(els.formStatus, 'error', I.t('reviews.rating.pick')); return; }

    var forGame = gameId;
    var formEls = els;
    formEls.send.disabled = true;
    setStatus(formEls.formStatus, '', I.t('support.loading'));
    // Имя берём заново: человек мог сменить никнейм в «Аккаунте» уже на этой странице.
    api.init(Y.currentPrefs())
      .then(function (s) { return api.saveGameReview(forGame, rating, formEls.text.value, Y.displayName(s.profile)); })
      .then(function (result) {
        if (gameId !== forGame) return;
        formTouched = false;
        setStatus(formEls.formStatus, 'ok', I.t(result === 'created' ? 'reviews.created' : 'reviews.updated'));
        syncForm();
      })
      .catch(function (err) { if (gameId === forGame) fail(formEls.formStatus, err, 'reviews.error'); })
      .then(function () { formEls.send.disabled = false; });
  }

  function deleteMine() {
    if (!api || !window.confirm(I.t('reviews.delete.mine.confirm'))) return;
    var forGame = gameId;
    var formEls = els;
    formEls.delMine.disabled = true;
    api.deleteMyGameReview(forGame)
      .then(function () {
        if (gameId !== forGame) return;
        formTouched = false; rating = 0; formEls.text.value = '';
        setStatus(formEls.formStatus, 'ok', I.t('reviews.deleted'));
        syncForm();
      })
      .catch(function (err) { if (gameId === forGame) fail(formEls.formStatus, err, 'reviews.error'); })
      .then(function () { formEls.delMine.disabled = false; });
  }

  // ---------- запуск ----------
  function renderAll() {
    renderSummary();
    renderPresets();
    renderList();
    updateFormTexts();
  }

  function loadFail(err) {
    console.error(err);
    failed = true;
    slowShown = false;
    setStatus(els.status, 'error', Y.explain(err, 'gr.loadError'));
    if (api) els.send.disabled = false;     // чтение не вышло, но запись может сработать
    renderAll();
  }

  function stopWatch() {
    if (stopWatching) stopWatching();
    stopWatching = null;
    watchedFor = null;
  }

  // Подписка на отзывы открытой игры. После смены аккаунта («Войти по ID») подписываемся заново: «мой» отзыв зависит от аккаунта.
  function watch() {
    if (!api || !state || gameId === null) return;
    if (stopWatching && watchedFor === state.playerId) return;
    stopWatch();
    watchedFor = state.playerId;
    var forGame = gameId;
    stopWatching = api.watchGameReviews(forGame, function (list) {
      if (gameId !== forGame) return;       // окно уже закрыли или открыли другую игру
      reviews = list; ready = true; failed = false;
      // В кэш уходят отзывы без пометки «мой»: она принадлежит человеку, а не отзыву.
      Y.cache.set('gameReviews.' + forGame, list.map(function (r) { return Object.assign({}, r, { mine: false }); }));
      gotReviews();
      els.send.disabled = false;            // теперь известно, есть ли у человека свой отзыв
      renderAll(); syncForm();
    }, function (err) { if (gameId === forGame) loadFail(err); });
  }

  function applyState(s) {
    state = s;
    isAdmin = !!s.support;
  }

  // Подключаемся к базе один раз на страницу (и только когда первый раз открыли окно игры).
  function connect() {
    if (!connecting) {
      connecting = Y.backend().then(function (b) {
        return b.init(Y.currentPrefs()).then(function (s) {
          api = b;
          applyState(s);
          document.dispatchEvent(new CustomEvent('yablonya:state', { detail: s }));
          return s;
        });
      });
      connecting.catch(function () { connecting = null; });    // не вышло: в следующий раз попробуем заново
    }
    return connecting;
  }

  function open(id, container) {
    close();
    gameId = id;
    reviews = []; selected = {}; rating = 0; formTouched = false;
    ready = false; failed = false; slowShown = false;

    build(container);
    useCache();
    renderAll();
    if (!Y.firebaseConfigured()) {
      els.send.disabled = true;
      setStatus(els.status, 'error', I.t('gr.loadError'));
      return;
    }

    els.send.disabled = true;               // отправка включится, когда придут отзывы из базы (см. watch)
    watchSlow();
    var forGame = id;
    connect()
      .then(function () { if (gameId === forGame) watch(); })
      .catch(function (err) { if (gameId === forGame) loadFail(err); });
  }

  function close() {
    stopWatch();
    if (slowTimer) { clearTimeout(slowTimer); slowTimer = null; }
    gameId = null;
  }

  // Состояние игрока изменилось (вход по ID, смена никнейма, права): обновляем отзывы и подпись «мой».
  document.addEventListener('yablonya:state', function (e) {
    var s = e.detail;
    if (!s) return;
    applyState(s);
    if (gameId === null || !api) return;
    if (s.playerId !== watchedFor) { formTouched = false; watch(); }
    else renderList();
  });

  document.addEventListener('yablonya:lang', function () {
    if (gameId === null) return;
    renderAll(); syncForm();
    if (slowShown) setStatus(els.status, '', I.t('load.slow'));     // язык мог смениться
  });

  Y.GameReviews = { open: open, close: close };
})();
