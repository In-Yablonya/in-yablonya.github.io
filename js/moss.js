/*
 * «Империя Мха»: посты о ходе проекта.
 * Читают все посетители. Писать, править и удалять посты могут администраторы
 * (в базе у аккаунта стоит players/<ID>/admin = true); это проверяют правила базы.
 * Общение с Firebase — через js/backend.js.
 */
(function () {
  'use strict';

  var Y = window.Yablonya;
  var I = window.I18N;
  var h = Y.h;
  var $ = Y.$;

  var postsEl = $('#posts');
  var emptyEl = $('#posts-empty');
  var statusEl = $('#posts-status');
  var newBtn = $('#post-new');
  var dialog = $('#post-dialog');
  var dialogTitle = $('#post-dialog-title');
  var form = $('#post-form');
  var titleInput = $('#post-title');
  var textInput = $('#post-text');
  var saveBtn = $('#post-save');
  var dialogStatus = $('#post-status');

  var api = null;
  var isAdmin = false;
  var adminName = '';
  var posts = [];
  var editing = null;          // редактируемый пост или null для нового

  // Что уже есть: посты из кэша браузера или из базы. Пока их нет совсем, страница пишет «Загружаем…»,
  // а не «Первые записи появятся здесь»: человек не должен подумать, что записей нет, и уйти.
  var ready = false;
  var failed = false;          // база не отвечает: «Загружаем…» больше не пишем
  var slowShown = false;
  var slowTimer = null;
  var renderedKey = null;      // что нарисовано сейчас: одинаковые данные заново не рисуем (иначе записи мигают)

  function setStatus(el, kind, text) {
    el.textContent = text || '';
    el.className = 'status' + (kind ? ' status--' + kind : '');
  }

  function loadFail(err) {
    console.error(err);
    failed = true;
    slowShown = false;
    setStatus(statusEl, 'error', Y.explain(err, 'post.loadError'));
    renderPosts();
  }

  // Посты из кэша: показываем сразу, пока база ещё отвечает. Пустой кэш ничего не говорит, его пропускаем.
  function useCache() {
    var cached = Y.cache.get('mossPosts');
    if (!cached || !cached.length) return;
    posts = cached;
    ready = true;
  }

  // Если база молчит дольше обычного (плохая связь), говорим об этом, а не крутим «Загружаем…» молча.
  function watchSlow() {
    slowTimer = setTimeout(function () {
      if (ready || failed) return;
      slowShown = true;
      setStatus(statusEl, '', I.t('load.slow'));
    }, 10000);
  }

  function gotPosts() {
    if (slowTimer) { clearTimeout(slowTimer); slowTimer = null; }
    if (slowShown) { slowShown = false; setStatus(statusEl, '', ''); }
  }

  function dateOnly(ts) {
    if (!ts) return '';
    try {
      return new Date(ts).toLocaleDateString(I.lang === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) { return ''; }
  }

  // ---------- список постов ----------
  function renderPosts() {
    // Подпись под списком: «Загружаем…», «записи появятся здесь» или ничего (записи есть, либо загрузка не удалась).
    var configured = Y.firebaseConfigured();
    var loading = configured && !ready && !failed;
    var none = !posts.length && (ready || !configured);
    emptyEl.hidden = !(loading || none);
    emptyEl.classList.toggle('is-loading', loading);
    var key = loading ? 'moss.loading' : 'moss.progress.empty';
    emptyEl.setAttribute('data-i18n', key);
    emptyEl.textContent = I.t(key);

    var drawn = JSON.stringify([posts, isAdmin, I.lang]);
    if (drawn === renderedKey) return;
    renderedKey = drawn;
    postsEl.textContent = '';

    posts.forEach(function (p) {
      var meta = dateOnly(p.createdAt);
      if (p.author) meta += ' · ' + I.t('post.by', { name: p.author });
      if (p.updatedAt) meta += ' · ' + I.t('post.edited');

      var body = h('div', { class: 'post__body' });
      p.text.split(/\n\s*\n/).forEach(function (par) {
        if (par.trim()) body.append(h('p', { text: par.trim() }));
      });

      var article = h('article', { class: 'post' },
        h('h3', { class: 'post__title', text: p.title }),
        h('p', { class: 'post__meta', text: meta }),
        body
      );

      if (isAdmin) {
        article.append(h('div', { class: 'row post__actions' },
          h('button', { class: 'btn btn--sm', type: 'button', text: I.t('post.edit'), onclick: function () { openEditor(p); } }),
          h('button', { class: 'btn btn--sm', type: 'button', text: I.t('post.delete'), onclick: function () { remove(p); } })
        ));
      }
      postsEl.append(article);
    });
  }

  function remove(post) {
    if (!window.confirm(I.t('post.delete.confirm'))) return;
    setStatus(statusEl, '', '');
    api.deletePost(post.id).catch(function (err) {
      console.error(err);
      setStatus(statusEl, 'error', Y.explain(err, 'post.error'));
    });
  }

  // ---------- редактор ----------
  function renderEditorTexts() {
    dialogTitle.textContent = I.t(editing ? 'post.dialog.edit' : 'post.dialog.new');
    var key = editing ? 'btn.save' : 'post.publish';
    saveBtn.setAttribute('data-i18n', key);
    saveBtn.textContent = I.t(key);
  }

  function openEditor(post) {
    editing = post || null;
    renderEditorTexts();
    titleInput.value = post ? post.title : '';
    textInput.value = post ? post.text : '';
    setStatus(dialogStatus, '', '');
    dialog.showModal();
    titleInput.focus();
  }

  newBtn.addEventListener('click', function () { openEditor(null); });
  dialog.addEventListener('close', function () { editing = null; });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!api || !isAdmin) return;

    saveBtn.disabled = true;
    setStatus(dialogStatus, '', I.t('support.loading'));

    var job = editing
      ? api.editPost(editing.id, titleInput.value, textInput.value)
      : api.createPost(titleInput.value, textInput.value, adminName);

    job
      .then(function () { dialog.close(); })
      .catch(function (err) {
        console.error(err);
        setStatus(dialogStatus, 'error', Y.explain(err, 'post.error'));
      })
      .then(function () { saveBtn.disabled = false; });
  });

  // ---------- подключение ----------
  function start() {
    useCache();
    renderPosts();
    if (!Y.firebaseConfigured()) return;      // без Firebase остаётся надпись «записи появятся здесь»

    watchSlow();
    Y.backend()
      .then(function (b) {
        return b.init(Y.currentPrefs()).then(function (state) {
          api = b;
          isAdmin = !!state.support;
          adminName = Y.displayName(state.profile);
          newBtn.hidden = !isAdmin;
          document.dispatchEvent(new CustomEvent('yablonya:state', { detail: state }));
          b.watchPosts(function (list) {
            posts = list; ready = true; failed = false;
            Y.cache.set('mossPosts', list);
            gotPosts();
            renderPosts();
          }, loadFail);
        });
      })
      .catch(loadFail);
  }

  document.addEventListener('yablonya:lang', function () {
    renderPosts();
    if (dialog.open) renderEditorTexts();
  });

  start();
})();
