/*
 * Отдельная страница для администраторов: написать новость, поправить или удалить опубликованные.
 * Открывается кнопкой «+» на главной (она видна только администраторам). Настоящая защита — правила базы:
 * писать в news могут только аккаунты с players/<ID>/admin = true.
 */
(function () {
  'use strict';

  var Y = window.Yablonya;
  var I = window.I18N;
  var h = Y.h;
  var $ = Y.$;

  var statusEl = $('#editor-status');
  var bodyEl = $('#editor-body');
  var form = $('#news-form');
  var heading = $('#form-heading');
  var titleInput = $('#news-title');
  var textInput = $('#news-text');
  var saveBtn = $('#news-save');
  var cancelBtn = $('#news-cancel');
  var formStatus = $('#form-status');
  var listEl = $('#editor-list');
  var emptyEl = $('#editor-empty');

  var api = null;
  var authorName = '';
  var posts = [];
  var editing = null;

  function setStatus(el, kind, text) {
    el.textContent = text || '';
    el.className = 'status' + (kind ? ' status--' + kind : '');
  }

  function dateOnly(ts) {
    if (!ts) return '';
    try {
      return new Date(ts).toLocaleDateString(I.lang === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) { return ''; }
  }

  // ---------- форма ----------
  function renderFormTexts() {
    heading.textContent = I.t(editing ? 'post.dialog.edit' : 'post.dialog.new');
    var key = editing ? 'btn.save' : 'post.publish';
    saveBtn.setAttribute('data-i18n', key);
    saveBtn.textContent = I.t(key);
    cancelBtn.hidden = !editing;
  }

  function resetForm() {
    editing = null;
    titleInput.value = '';
    textInput.value = '';
    renderFormTexts();
  }

  function startEdit(post) {
    editing = post;
    titleInput.value = post.title;
    textInput.value = post.text;
    renderFormTexts();
    setStatus(formStatus, '', '');
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    titleInput.focus();
  }

  cancelBtn.addEventListener('click', function () { resetForm(); setStatus(formStatus, '', ''); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!api) return;

    saveBtn.disabled = true;
    setStatus(formStatus, '', I.t('support.loading'));

    var job = editing
      ? api.editNews(editing.id, titleInput.value, textInput.value)
      : api.createNews(titleInput.value, textInput.value, authorName);

    job
      .then(function () { resetForm(); setStatus(formStatus, 'ok', I.t('editor.saved')); })
      .catch(function (err) {
        console.error(err);
        setStatus(formStatus, 'error', Y.explain(err, 'post.error'));
      })
      .then(function () { saveBtn.disabled = false; });
  });

  // ---------- список опубликованного ----------
  function renderList() {
    listEl.textContent = '';
    emptyEl.hidden = posts.length > 0;
    posts.forEach(function (p) {
      var meta = dateOnly(p.createdAt);
      if (p.author) meta += ' · ' + I.t('post.by', { name: p.author });
      if (p.updatedAt) meta += ' · ' + I.t('post.edited');
      var preview = p.text.length > 180 ? p.text.slice(0, 180) + '…' : p.text;

      listEl.append(h('article', { class: 'post' },
        h('h3', { class: 'post__title', text: p.title }),
        h('p', { class: 'post__meta', text: meta }),
        h('div', { class: 'post__body' }, h('p', { text: preview })),
        h('div', { class: 'row post__actions' },
          h('button', { class: 'btn btn--sm', type: 'button', text: I.t('post.edit'), onclick: function () { startEdit(p); } }),
          h('button', { class: 'btn btn--sm', type: 'button', text: I.t('post.delete'), onclick: function () { removePost(p); } })
        )
      ));
    });
  }

  function removePost(post) {
    if (!window.confirm(I.t('post.delete.confirm'))) return;
    api.deleteNews(post.id)
      .then(function () { if (editing && editing.id === post.id) resetForm(); })
      .catch(function (err) {
        console.error(err);
        setStatus(statusEl, 'error', Y.explain(err, 'post.error'));
      });
  }

  // ---------- подключение ----------
  function start() {
    if (!Y.firebaseConfigured()) {
      setStatus(statusEl, 'error', I.t('support.unavailable'));
      return;
    }
    setStatus(statusEl, '', I.t('support.loading'));

    Y.backend()
      .then(function (b) {
        return b.init(Y.currentPrefs()).then(function (state) {
          document.dispatchEvent(new CustomEvent('yablonya:state', { detail: state }));
          if (!state.support) {
            setStatus(statusEl, 'error', I.t('answer.denied'));
            return;
          }
          api = b;
          authorName = Y.displayName(state.profile);
          setStatus(statusEl, '', '');
          bodyEl.hidden = false;
          renderFormTexts();
          b.watchNews(function (list) { posts = list; renderList(); }, function (err) {
            console.error(err);
            setStatus(statusEl, 'error', Y.explain(err, 'news.loadError'));
          });
        });
      })
      .catch(function (err) {
        console.error(err);
        setStatus(statusEl, 'error', Y.explain(err, 'news.loadError'));
      });
  }

  document.addEventListener('yablonya:lang', function () {
    renderFormTexts();
    renderList();
  });

  start();
})();
