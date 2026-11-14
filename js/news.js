/*
 * «Новости Яблони»: посты администраторов, лайки/дизлайки, комментарии и ответы на них.
 * Читают все. Оценивать и комментировать может любой посетитель (у него автоматически есть аккаунт).
 * У администратора тот же интерфейс, плюс кнопка «Удалить» у комментариев (модерация).
 * Писать и править новости — на отдельной странице news-editor.html.
 */
(function () {
  'use strict';

  var Y = window.Yablonya;
  var I = window.I18N;
  var h = Y.h;
  var $ = Y.$;

  var listEl = $('#news');
  var emptyEl = $('#news-empty');
  var statusEl = $('#news-status');

  var newsAdd = $('#news-add');            // кнопка «+»: написать новость (только администраторам)

  function showPlus(admin) { if (newsAdd) newsAdd.hidden = !admin; }
  showPlus(Y.adminHint());
  document.addEventListener('yablonya:state', function (e) { showPlus(!!(e.detail && e.detail.support)); });

  var api = null;
  var isAdmin = false;
  var myName = '';
  var posts = [];
  var comments = {};            // id новости -> комментарии
  var reactions = {};           // id новости -> { likes, dislikes, mine }
  var nodes = {};               // id новости -> элементы карточки (чтобы не терять набранный текст)

  // Что уже есть: данные из кэша браузера или из базы. Пока новостей нет совсем, страница пишет «Загружаем…»,
  // а не «Новостей пока нет»: человек не должен подумать, что их нет, и уйти.
  var ready = { news: false, comments: false, reactions: false };
  var live = { reactions: false };   // свои оценки известны только из базы: в кэше их нет
  var failed = false;                // база не отвечает: «Загружаем…» больше не пишем
  var slowShown = false;
  var slowTimer = null;

  function setStatus(kind, text) {
    statusEl.textContent = text || '';
    statusEl.className = 'status' + (kind ? ' status--' + kind : '');
  }

  function fail(err) {
    console.error(err);
    setStatus('error', Y.explain(err, 'news.error'));
  }

  function loadFail(err) {
    console.error(err);
    failed = true;
    slowShown = false;
    setStatus('error', Y.explain(err, 'news.loadError'));
    syncAll();
  }

  // Подпись под списком: «Загружаем…», «Новостей пока нет» или ничего (список есть, либо загрузка не удалась).
  function renderEmpty() {
    var loading = Y.firebaseConfigured() && !ready.news && !failed;
    var none = !posts.length && (ready.news || !Y.firebaseConfigured());
    emptyEl.hidden = !(loading || none);
    emptyEl.classList.toggle('is-loading', loading);
    var key = loading ? 'news.loading' : 'news.empty';
    emptyEl.setAttribute('data-i18n', key);
    emptyEl.textContent = I.t(key);
  }

  // Новости из кэша: показываем сразу, пока база ещё отвечает. Пустой кэш ничего не говорит, его пропускаем.
  function useCache() {
    var cachedPosts = Y.cache.get('news');
    if (!cachedPosts || !cachedPosts.length) return;
    posts = cachedPosts;
    ready.news = true;
    var cachedComments = Y.cache.get('newsComments');
    if (cachedComments) { comments = cachedComments; ready.comments = true; }
    var cachedReactions = Y.cache.get('newsReactions');
    if (cachedReactions) { reactions = cachedReactions; ready.reactions = true; }
  }

  // В кэш уходят только счётчики: «моя оценка» принадлежит человеку, а не новости.
  function withoutMine(byPost) {
    var result = {};
    Object.keys(byPost).forEach(function (id) {
      result[id] = { likes: byPost[id].likes, dislikes: byPost[id].dislikes, mine: null };
    });
    return result;
  }

  // Если база молчит дольше обычного (плохая связь), говорим об этом, а не крутим «Загружаем…» молча.
  function watchSlow() {
    slowTimer = setTimeout(function () {
      if (ready.news || failed) return;
      slowShown = true;
      setStatus('', I.t('load.slow'));
    }, 10000);
  }

  function gotNews() {
    if (slowTimer) { clearTimeout(slowTimer); slowTimer = null; }
    if (slowShown) { slowShown = false; setStatus('', ''); }
  }

  function dateOnly(ts) {
    if (!ts) return '';
    try {
      return new Date(ts).toLocaleDateString(I.lang === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) { return ''; }
  }

  function fillParagraphs(container, text) {
    container.textContent = '';
    String(text).split(/\n\s*\n/).forEach(function (par) {
      if (par.trim()) container.append(h('p', { text: par.trim() }));
    });
  }

  // ---------- карточка новости ----------
  function makeNode(post) {
    var n = { id: post.id, reply: null };

    n.title = h('h2', { class: 'news-post__title' });
    n.meta = h('p', { class: 'news-post__meta' });
    n.body = h('div', { class: 'news-post__body' });

    n.likeCount = h('span', { text: '0' });
    n.dislikeCount = h('span', { text: '0' });
    n.like = h('button', { class: 'btn btn--sm react', type: 'button', 'aria-pressed': 'false', onclick: function () { react(n, 'like'); } }, '👍 ', n.likeCount);
    n.dislike = h('button', { class: 'btn btn--sm react', type: 'button', 'aria-pressed': 'false', onclick: function () { react(n, 'dislike'); } }, '👎 ', n.dislikeCount);
    n.toggle = h('button', { class: 'btn btn--sm', type: 'button', 'aria-expanded': 'false', onclick: function () { togglePanel(n); } });

    n.list = h('div', { class: 'comments' });
    n.replyText = h('span', { class: 'reply-bar__text' });
    n.replyBar = h('div', { class: 'reply-bar', hidden: true },
      n.replyText,
      h('button', { class: 'btn btn--sm', type: 'button', onclick: function () { cancelReply(n); } })
    );
    n.cancel = n.replyBar.querySelector('button');
    n.input = h('textarea', { class: 'textarea', rows: 2, maxlength: 1000, required: true });
    n.send = h('button', { class: 'btn btn--primary', type: 'submit' });
    n.form = h('form', { class: 'chat-form' }, n.input, n.send);
    n.panel = h('div', { class: 'news-post__comments', hidden: true }, n.list, n.replyBar, n.form);

    n.form.addEventListener('submit', function (e) { e.preventDefault(); sendComment(n); });
    n.input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        if (n.input.value.trim()) n.form.requestSubmit();
      }
    });

    n.el = h('article', { class: 'news-post' },
      n.title, n.meta, n.body,
      h('div', { class: 'row news-post__actions' }, n.like, n.dislike, n.toggle),
      n.panel
    );
    return n;
  }

  function updatePost(n, post) {
    n.title.textContent = post.title;
    var meta = dateOnly(post.createdAt);
    if (post.author) meta += ' · ' + I.t('post.by', { name: post.author });
    if (post.updatedAt) meta += ' · ' + I.t('post.edited');
    n.meta.textContent = meta;
    fillParagraphs(n.body, post.text);
  }

  function updateTexts(n) {
    n.like.setAttribute('aria-label', I.t('news.like'));
    n.like.setAttribute('title', I.t('news.like'));
    n.dislike.setAttribute('aria-label', I.t('news.dislike'));
    n.dislike.setAttribute('title', I.t('news.dislike'));
    n.send.textContent = I.t('btn.send');
    n.input.setAttribute('placeholder', I.t('news.comment.placeholder'));
    n.input.setAttribute('aria-label', I.t('news.comment.placeholder'));
    n.cancel.textContent = I.t('news.reply.cancel');
    if (n.reply) n.replyText.textContent = I.t('news.reply.to', { name: n.reply.name });
  }

  function updateReactions(n) {
    var r = reactions[n.id] || { likes: 0, dislikes: 0, mine: null };
    n.likeCount.textContent = ready.reactions ? r.likes : '…';
    n.dislikeCount.textContent = ready.reactions ? r.dislikes : '…';
    n.like.setAttribute('aria-pressed', r.mine === 'like' ? 'true' : 'false');
    n.dislike.setAttribute('aria-pressed', r.mine === 'dislike' ? 'true' : 'false');
    n.like.classList.toggle('is-active', r.mine === 'like');
    n.dislike.classList.toggle('is-active', r.mine === 'dislike');
  }

  function react(n, value) {
    if (!api || !live.reactions) return;
    var current = (reactions[n.id] || {}).mine || null;
    api.setReaction(n.id, value, current).catch(fail);
  }

  // ---------- комментарии ----------
  function togglePanel(n) {
    n.panel.hidden = !n.panel.hidden;
    n.toggle.setAttribute('aria-expanded', n.panel.hidden ? 'false' : 'true');
  }

  function startReply(n, comment) {
    n.reply = { parentId: comment.parent || comment.id, name: comment.name };
    n.replyBar.hidden = false;
    n.replyText.textContent = I.t('news.reply.to', { name: n.reply.name });
    n.input.focus();
  }

  function cancelReply(n) {
    n.reply = null;
    n.replyBar.hidden = true;
  }

  function sendComment(n) {
    var text = n.input.value.trim();
    if (!text || !api) return;
    n.send.disabled = true;
    api.addComment(n.id, text, myName, n.reply && n.reply.parentId, n.reply && n.reply.name)
      .then(function () { n.input.value = ''; cancelReply(n); setStatus('', ''); })
      .catch(fail)
      .then(function () { n.send.disabled = false; n.input.focus(); });
  }

  function removeComment(n, comment, replies) {
    if (!window.confirm(I.t('news.delete.comment.confirm'))) return;
    var ids = [comment.id].concat(replies.map(function (r) { return r.id; }));
    api.deleteComment(n.id, ids).catch(fail);
  }

  function commentEl(n, c, isReply, replies) {
    var meta = h('div', { class: 'comment__meta' }, h('strong', { text: c.name }));
    if (c.role === 'admin') meta.append(' ', h('span', { class: 'badge', text: I.t('news.admin.badge') }));
    meta.append(' · ' + Y.formatDate(c.createdAt));
    if (isReply && c.replyTo) meta.append(' · ' + I.t('news.reply.in', { name: c.replyTo }));

    var actions = h('div', { class: 'row comment__actions' },
      h('button', { class: 'btn btn--sm', type: 'button', text: I.t('news.reply'), onclick: function () { startReply(n, c); } })
    );
    if (isAdmin) {
      actions.append(h('button', { class: 'btn btn--sm', type: 'button', text: I.t('post.delete'), onclick: function () { removeComment(n, c, replies || []); } }));
    }
    return h('div', { class: 'comment' + (isReply ? ' comment--reply' : '') },
      meta,
      h('p', { class: 'comment__text', text: c.text }),
      actions
    );
  }

  function updateComments(n) {
    if (!ready.comments) {          // комментарии ещё идут: не пишем «пока нет» и не называем число
      n.toggle.textContent = I.t('news.comments.label');
      n.list.textContent = '';
      n.list.append(h('p', { class: 'muted small', text: I.t('news.comments.loading') }));
      return;
    }
    var list = comments[n.id] || [];
    n.toggle.textContent = I.t('news.comments', { n: list.length });
    n.list.textContent = '';
    if (!list.length) {
      n.list.append(h('p', { class: 'muted small', text: I.t('news.comments.none') }));
      return;
    }
    var byId = {};
    list.forEach(function (c) { byId[c.id] = c; });
    var kids = {};
    list.forEach(function (c) {
      if (c.parent && byId[c.parent]) (kids[c.parent] = kids[c.parent] || []).push(c);
    });
    list.filter(function (c) { return !c.parent || !byId[c.parent]; }).forEach(function (c) {
      var replies = kids[c.id] || [];
      n.list.append(commentEl(n, c, false, replies));
      replies.forEach(function (r) { n.list.append(commentEl(n, r, true)); });
    });
  }

  // ---------- общий список ----------
  function syncAll() {
    renderEmpty();
    if (slowShown) setStatus('', I.t('load.slow'));     // язык мог смениться
    var ids = posts.map(function (p) { return p.id; });
    Object.keys(nodes).forEach(function (id) {
      if (ids.indexOf(id) < 0) { nodes[id].el.remove(); delete nodes[id]; }
    });
    posts.forEach(function (post, i) {
      var n = nodes[post.id] || (nodes[post.id] = makeNode(post));
      updatePost(n, post);
      updateTexts(n);
      updateReactions(n);
      updateComments(n);
      if (listEl.children[i] !== n.el) listEl.insertBefore(n.el, listEl.children[i] || null);
    });
  }

  function start() {
    useCache();
    syncAll();
    if (!Y.firebaseConfigured()) return;      // без Firebase остаётся «Новостей пока нет»

    watchSlow();
    Y.backend()
      .then(function (b) {
        return b.init(Y.currentPrefs()).then(function (state) {
          api = b;
          isAdmin = !!state.support;
          myName = Y.displayName(state.profile);
          document.dispatchEvent(new CustomEvent('yablonya:state', { detail: state }));
          b.watchNews(function (list) {
            posts = list; ready.news = true; failed = false;
            Y.cache.set('news', list);
            gotNews();
            syncAll();
          }, loadFail);
          b.watchNewsComments(function (byPost) {
            comments = byPost; ready.comments = true;
            Y.cache.set('newsComments', byPost);
            syncAll();
          }, loadFail);
          b.watchNewsReactions(function (byPost) {
            reactions = byPost; ready.reactions = true; live.reactions = true;
            Y.cache.set('newsReactions', withoutMine(byPost));
            syncAll();
          }, loadFail);
        });
      })
      .catch(loadFail);
  }

  document.addEventListener('yablonya:lang', syncAll);
  start();
})();
