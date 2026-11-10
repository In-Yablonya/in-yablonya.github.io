/*
 * Главное меню: кнопка поддержки.
 *  - Обычный игрок нажимает «Обратиться в поддержку» и попадает в свой чат: один сплошной чат
 *    со всеми администраторами. Чужих сообщений в нём нет.
 *  - Администратор (players/<ID>/admin = true) вместо этого видит кнопку «Ответить на вопросы»:
 *    слева список чатов игроков, справа переписка с выбранным игроком.
 * Общение с Firebase — через js/backend.js.
 */
(function () {
  'use strict';

  var Y = window.Yablonya;
  var I = window.I18N;
  var h = Y.h;
  var $ = Y.$;

  var supportBtn = $('#support-btn');
  var supportDialog = $('#support-dialog');
  var adminDialog = $('#admin-dialog');

  function setStatus(el, kind, text) {
    el.textContent = text || '';
    el.className = 'status' + (kind ? ' status--' + kind : '');
  }

  function shortTime(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    var loc = I.lang === 'ru' ? 'ru-RU' : 'en-GB';
    try {
      if (d.toDateString() === new Date().toDateString()) {
        return d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
      }
      return d.toLocaleString(loc, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  }

  // ---------- кнопка: «Обратиться в поддержку» или «Ответить на вопросы» ----------
  // Что показать до ответа сервера, подсказывает localStorage; после подключения берём настоящее значение.
  var HINT_KEY = 'yablonya.admin';
  var isAdmin = false;
  try { isAdmin = localStorage.getItem(HINT_KEY) === '1'; } catch (e) { /* без подсказки */ }

  function renderButton() {
    var key = isAdmin ? 'btn.answer' : 'btn.support';
    supportBtn.setAttribute('data-i18n', key);
    supportBtn.textContent = I.t(key);
  }

  function setAdmin(value) {
    isAdmin = value;
    try { if (value) localStorage.setItem(HINT_KEY, '1'); else localStorage.removeItem(HINT_KEY); } catch (e) { /* не критично */ }
    renderButton();
  }

  renderButton();

  document.addEventListener('yablonya:state', function (e) { setAdmin(!!(e.detail && e.detail.support)); });

  // Подключаемся заранее, пока страница простаивает: так кнопка быстро получает правильную подпись.
  if (Y.firebaseConfigured() && location.protocol !== 'file:') {
    var warmUp = function () {
      Y.backend()
        .then(function (b) { return b.init(Y.currentPrefs()); })
        .then(function (state) { document.dispatchEvent(new CustomEvent('yablonya:state', { detail: state })); })
        .catch(function (err) { console.warn('Подключение отложено:', err && (err.code || err.message)); });
    };
    if (window.requestIdleCallback) window.requestIdleCallback(warmUp, { timeout: 3000 });
    else setTimeout(warmUp, 1500);
  }

  // ---------- общий вид переписки ----------
  // viewerRole: чьи сообщения показывать справа («свои»): 'user' для игрока, 'admin' для администратора.
  function renderLog(logEl, messages, viewerRole, forceBottom, emptyKey) {
    var nearBottom = logEl.scrollHeight - logEl.scrollTop - logEl.clientHeight < 80;
    // Плавно появляются только новые сообщения (после первой отрисовки), старые не «мигают».
    var shown = forceBottom ? messages.length : Number(logEl.getAttribute('data-count') || messages.length);
    logEl.setAttribute('data-count', String(messages.length));
    logEl.textContent = '';
    if (!messages.length && emptyKey) {
      logEl.append(h('p', { class: 'chat-empty muted', text: I.t(emptyKey) }));
      return;
    }
    messages.forEach(function (m, index) {
      var mine = m.role === viewerRole;
      var who = m.role === 'admin' ? m.name + ' · ' + I.t('chat.admin') : m.name;
      var meta = (mine && viewerRole === 'user' ? '' : who + ' · ') + shortTime(m.createdAt);
      logEl.append(h('div', { class: 'msg ' + (mine ? 'msg--mine' : 'msg--theirs') + (index >= shown ? ' msg--new' : '') },
        h('div', { class: 'msg__meta', text: meta }),
        h('div', { class: 'msg__text', text: m.text })
      ));
    });
    if (forceBottom || nearBottom) logEl.scrollTop = logEl.scrollHeight;
  }

  // Enter отправляет сообщение, Shift+Enter — новая строка.
  function enterToSend(textarea, form) {
    textarea.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        if (textarea.value.trim()) form.requestSubmit();
      }
    });
  }

  // ================= чат игрока =================
  var chatLog = $('#chat-log');
  var chatForm = $('#chat-form');
  var chatInput = $('#chat-input');
  var chatSend = $('#chat-send');
  var chatStatus = $('#chat-status');

  var chatApi = null;
  var chatName = '';
  var chatMessages = [];
  var unsubChat = null;
  var chatFirst = true;

  function stopChat() {
    if (unsubChat) { unsubChat(); unsubChat = null; }
    chatApi = null;
    chatMessages = [];
  }

  function startChat(api, state) {
    chatApi = api;
    chatName = Y.displayName(state.profile);
    chatFirst = true;
    chatSend.disabled = false;
    setStatus(chatStatus, '', '');
    unsubChat = api.watchMyChat(function (messages) {
      chatMessages = messages;
      renderLog(chatLog, messages, 'user', chatFirst, 'chat.empty');
      chatFirst = false;
    }, function (err) {
      console.error(err);
      setStatus(chatStatus, 'error', Y.explain(err, 'chat.error'));
    });
  }

  enterToSend(chatInput, chatForm);

  chatForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = chatInput.value.trim();
    if (!text || !chatApi) return;

    chatSend.disabled = true;
    setStatus(chatStatus, '', '');
    chatApi.sendMessage(text, chatName)
      .then(function () { chatInput.value = ''; })
      .catch(function (err) {
        console.error(err);
        setStatus(chatStatus, 'error', Y.explain(err, 'chat.error'));
      })
      .then(function () { chatSend.disabled = false; chatInput.focus(); });
  });

  supportDialog.addEventListener('close', stopChat);

  // ================= диалог администратора =================
  var adminChat = $('#admin-chat');
  var adminList = $('#admin-list');
  var adminEmpty = $('#admin-empty');
  var adminFilter = $('#admin-filter');
  var adminBack = $('#admin-back');
  var adminTitle = $('#admin-thread-title');
  var adminPick = $('#admin-pick');
  var adminLog = $('#admin-log');
  var adminForm = $('#admin-form');
  var adminInput = $('#admin-input');
  var adminSend = $('#admin-send');
  var adminStatus = $('#admin-status');

  var adminApi = null;
  var adminName = '';
  var chats = [];
  var selected = null;            // { pid, nick }
  var threadMessages = [];
  var unsubList = null;
  var unsubThread = null;
  var threadFirst = true;

  function renderList() {
    var visible = chats.filter(function (c) { return !adminFilter.checked || c.lastRole === 'user'; });
    adminList.textContent = '';
    adminEmpty.hidden = visible.length > 0;
    visible.forEach(function (c) {
      var active = selected && selected.pid === c.pid;
      var btn = h('button', { class: 'chat-item' + (active ? ' is-active' : ''), type: 'button', 'aria-current': active ? 'true' : 'false' },
        h('span', { class: 'chat-item__top' },
          h('strong', { text: c.nick || '—' }),
          c.lastRole === 'user' ? h('span', { class: 'badge', text: I.t('answer.waiting') }) : null
        ),
        h('span', { class: 'chat-item__text', text: (c.lastRole === 'admin' ? '↩ ' : '') + c.lastText }),
        h('span', { class: 'chat-item__time muted small', text: shortTime(c.lastAt) })
      );
      btn.addEventListener('click', function () { openThread(c); });
      adminList.append(h('li', {}, btn));
    });
  }

  function currentNick() {
    var found = chats.filter(function (c) { return selected && c.pid === selected.pid; })[0];
    return (found && found.nick) || (selected && selected.nick) || '';
  }

  function renderThreadTitle() {
    if (!selected) { adminTitle.textContent = ''; return; }
    adminTitle.textContent = I.t('answer.player', { nick: currentNick() || '—', id: selected.pid.slice(0, 6) + '…' });
  }

  function openThread(chat) {
    if (unsubThread) { unsubThread(); unsubThread = null; }
    selected = { pid: chat.pid, nick: chat.nick };
    threadMessages = [];
    threadFirst = true;
    adminChat.setAttribute('data-view', 'thread');
    adminPick.hidden = true;
    adminLog.hidden = false;
    adminForm.hidden = false;
    adminLog.textContent = '';
    renderThreadTitle();
    renderList();
    unsubThread = adminApi.watchChat(chat.pid, function (messages) {
      threadMessages = messages;
      renderLog(adminLog, messages, 'admin', threadFirst);
      threadFirst = false;
    }, function (err) {
      console.error(err);
      setStatus(adminStatus, 'error', Y.explain(err, 'answer.error'));
    });
    adminInput.focus();
  }

  function stopAdmin() {
    if (unsubList) { unsubList(); unsubList = null; }
    if (unsubThread) { unsubThread(); unsubThread = null; }
    adminApi = null;
    chats = [];
    selected = null;
    threadMessages = [];
    adminChat.setAttribute('data-view', 'list');
    adminPick.hidden = false;
    adminLog.hidden = true;
    adminForm.hidden = true;
    adminTitle.textContent = '';
    adminList.textContent = '';
  }

  function startAdmin(api, state) {
    adminApi = api;
    adminName = Y.displayName(state.profile);
    setStatus(adminStatus, '', '');
    unsubList = api.watchChatList(function (list) {
      chats = list;
      renderList();
      renderThreadTitle();
    }, function (err) {
      console.error(err);
      setStatus(adminStatus, 'error', I.t('answer.denied'));
    });
  }

  enterToSend(adminInput, adminForm);
  adminFilter.addEventListener('change', renderList);
  adminBack.addEventListener('click', function () { adminChat.setAttribute('data-view', 'list'); });
  adminDialog.addEventListener('close', stopAdmin);

  adminForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = adminInput.value.trim();
    if (!text || !selected || !adminApi) return;

    adminSend.disabled = true;
    setStatus(adminStatus, '', '');
    adminApi.sendAdminMessage(selected.pid, text, adminName, currentNick())
      .then(function () { adminInput.value = ''; })
      .catch(function (err) {
        console.error(err);
        setStatus(adminStatus, 'error', Y.explain(err, 'answer.error'));
      })
      .then(function () { adminSend.disabled = false; adminInput.focus(); });
  });

  // ================= открытие по кнопке =================
  function dialogFor(kind) { return kind === 'admin' ? adminDialog : supportDialog; }

  function showError(kind, err) {
    console.error(err);
    var el = kind === 'admin' ? adminStatus : chatStatus;
    setStatus(el, 'error', Y.explain(err, kind === 'admin' ? 'answer.error' : 'chat.error', 'support.unavailable'));
    if (kind !== 'admin') chatSend.disabled = true;
  }

  supportBtn.addEventListener('click', function () {
    var kind = isAdmin ? 'admin' : 'user';
    var dialog = dialogFor(kind);
    setStatus(kind === 'admin' ? adminStatus : chatStatus, '', Y.firebaseConfigured() ? I.t('support.loading') : '');
    dialog.showModal();

    if (!Y.firebaseConfigured()) { showError(kind, new Error('not-configured')); return; }

    Y.backend()
      .then(function (api) {
        return api.init(Y.currentPrefs()).then(function (state) {
          document.dispatchEvent(new CustomEvent('yablonya:state', { detail: state }));
          var real = state.support ? 'admin' : 'user';
          if (real !== kind) {                      // подсказка устарела: открываем нужное окно
            dialog.close();
            dialog = dialogFor(real);
            dialog.showModal();
          }
          if (!dialog.open) return;                 // окно уже закрыли, пока шло подключение
          if (real === 'admin') startAdmin(api, state); else startChat(api, state);
        });
      })
      .catch(function (err) { showError(kind, err); });
  });

  document.addEventListener('yablonya:lang', function () {
    renderButton();
    if (chatApi) renderLog(chatLog, chatMessages, 'user', false, 'chat.empty');
    if (adminApi) {
      renderList();
      renderThreadTitle();
      if (selected) renderLog(adminLog, threadMessages, 'admin', false);
    }
  });
})();
