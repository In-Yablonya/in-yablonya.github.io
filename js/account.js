/*
 * Окно «Аккаунт» (главное меню и страница новостей) — никнейм, ID, вход по ID с другого устройства.
 * Всё общение с Firebase идёт через js/backend.js (грузится при первом открытии окна).
 * Чат с поддержкой и диалог администратора — в js/chat.js.
 */
(function () {
  'use strict';

  var Y = window.Yablonya;
  var I = window.I18N;
  var $ = Y.$;

  function setStatus(el, kind, text) {
    el.textContent = text || '';
    el.className = 'status' + (kind ? ' status--' + kind : '');
  }

  // Окно «Аккаунт» общее для страниц: если в разметке страницы его нет, добавляем его сами.
  var ACCOUNT_DIALOG_HTML = `
<dialog class="modal" id="account-dialog" aria-labelledby="account-title">
  <div class="modal__inner">
    <div class="modal__head">
      <h2 id="account-title" data-i18n="account.title">Аккаунт</h2>
      <button class="btn btn--icon btn--sm" type="button" data-close data-i18n-attr="aria-label:btn.close" aria-label="Закрыть">✕</button>
    </div>

    <p class="status" id="account-status" role="status" aria-live="polite"></p>

    <div id="account-body" hidden>
      <form id="nick-form">
        <h3 data-i18n="account.nick.title">Никнейм</h3>
        <div class="row">
          <label class="visually-hidden" for="nick-input" data-i18n="account.nick.label">Никнейм</label>
          <input class="input" id="nick-input" type="text" maxlength="24" autocomplete="nickname" spellcheck="false">
          <button class="btn btn--primary" type="submit" id="nick-save" data-i18n="btn.save">Сохранить</button>
        </div>
        <p class="muted small" data-i18n="account.nick.hint">При первом заходе вам выдаётся имя «Пользователь N». Его можно сменить на своё (до 24 символов). Пустое поле вернёт имя по умолчанию.</p>
        <p class="status" id="nick-status" role="status" aria-live="polite"></p>
      </form>

      <div class="panel-block">
      <h3 data-i18n="account.id">Ваш ID</h3>
      <div class="id-box">
        <code id="account-id">••••••••••••••••</code>
        <button class="btn btn--sm" type="button" id="account-id-toggle">Показать</button>
        <button class="btn btn--sm" type="button" id="account-id-copy">Копировать</button>
      </div>
      <p class="muted small" data-i18n="account.id.warn">ID выдан вам автоматически при первом заходе и хранится в cookie этого браузера. Он работает как пароль: по нему видны ваш никнейм и переписка с поддержкой. Никому его не показывайте.</p>
      </div>

      <div class="panel-block" id="staff-block" hidden>
        <h3 data-i18n="account.staff.title">Администратор поддержки</h3>
        <p id="staff-name" data-i18n="account.staff.as"></p>
      </div>

      <form class="panel-block" id="restore-form">
        <h3 data-i18n="account.restore.title">Войти по ID</h3>
        <p class="muted small" data-i18n="account.restore.hint">Есть аккаунт на другом устройстве или вы очистили cookie? Введите его ID, и этот браузер станет тем же аккаунтом: с тем же никнеймом и перепиской.</p>
        <div class="row">
          <label class="visually-hidden" for="restore-input" data-i18n="account.restore.label">ID</label>
          <input class="input" id="restore-input" type="password" autocomplete="off" spellcheck="false" maxlength="128" required>
          <button class="btn" type="submit" id="restore-send" data-i18n="btn.restore">Войти</button>
        </div>
        <p class="status" id="restore-status" role="status" aria-live="polite"></p>
      </form>
    </div>
  </div>
</dialog>
`;

  if (!$('#account-dialog')) {
    document.body.insertAdjacentHTML('beforeend', ACCOUNT_DIALOG_HTML);
    I.apply($('#account-dialog'));
    Y.wireDialog($('#account-dialog'));
  }

  var accountDialog = $('#account-dialog');
  var accountStatus = $('#account-status');
  var accountBody = $('#account-body');
  var idEl = $('#account-id');
  var idToggle = $('#account-id-toggle');
  var idCopy = $('#account-id-copy');
  var staffBlock = $('#staff-block');
  var restoreForm = $('#restore-form');
  var restoreInput = $('#restore-input');
  var restoreSend = $('#restore-send');
  var restoreStatus = $('#restore-status');
  var nickForm = $('#nick-form');
  var nickInput = $('#nick-input');
  var nickSave = $('#nick-save');
  var nickStatus = $('#nick-status');

  var currentId = '';
  var currentProfile = { number: null, nickname: null };
  var currentSupport = false;
  var idShown = false;

  function renderId() {
    idEl.textContent = idShown ? currentId : '••••••••••••••••••••••••';
    idToggle.textContent = I.t(idShown ? 'btn.hide' : 'btn.show');
    idCopy.textContent = I.t('btn.copy');
  }

  // В поле стоит свой никнейм; если его нет — поле пустое, а подсказкой служит имя по умолчанию.
  function renderNick() {
    nickInput.value = currentProfile.nickname || '';
    renderNickPlaceholder();
  }

  function renderNickPlaceholder() {
    nickInput.placeholder = Y.displayName({ number: currentProfile.number });
  }

  function renderStaff() {
    staffBlock.hidden = !currentSupport;
  }

  function loadAccount() {
    accountBody.hidden = true;

    if (!Y.firebaseConfigured()) {
      setStatus(accountStatus, 'error', I.t('account.unavailable'));
      return;
    }
    setStatus(accountStatus, '', I.t('support.loading'));

    Y.backend()
      .then(function (b) {
        return b.init(Y.currentPrefs()).then(function (state) {
          currentId = state.playerId;
          currentProfile = state.profile;
          currentSupport = !!state.support;
          idShown = false;
          setStatus(nickStatus, '', '');
          renderNick();
          renderId();
          renderStaff();
          setStatus(accountStatus, '', '');
          accountBody.hidden = false;
          document.dispatchEvent(new CustomEvent('yablonya:state', { detail: state }));
        });
      })
      .catch(function (err) {
        console.error(err);
        setStatus(accountStatus, 'error', Y.explain(err, 'account.error', 'account.unavailable'));
      });
  }

  $('#account-btn').addEventListener('click', function () {
    setStatus(restoreStatus, '', '');
    restoreInput.value = '';
    accountDialog.showModal();
    loadAccount();
  });

  nickForm.addEventListener('submit', function (e) {
    e.preventDefault();
    nickSave.disabled = true;
    setStatus(nickStatus, '', I.t('support.loading'));

    Y.backend()
      .then(function (b) { return b.setNickname(nickInput.value); })
      .then(function (nickname) {
        currentProfile.nickname = nickname;
        renderNick();
        setStatus(nickStatus, 'ok', I.t(nickname ? 'nick.saved' : 'nick.reset'));
      })
      .catch(function (err) {
        console.error(err);
        setStatus(nickStatus, 'error', Y.explain(err, 'nick.error'));
      })
      .then(function () { nickSave.disabled = false; });
  });

  idToggle.addEventListener('click', function () {
    idShown = !idShown;
    renderId();
  });

  idCopy.addEventListener('click', function () {
    if (!currentId || !navigator.clipboard) return;
    navigator.clipboard.writeText(currentId).then(function () {
      idCopy.textContent = I.t('btn.copied');
      setTimeout(renderId, 1500);
    }).catch(function () { /* буфер недоступен — игрок может показать и скопировать вручную */ });
  });

  restoreForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var value = restoreInput.value.trim();
    if (!value) return;

    restoreSend.disabled = true;
    setStatus(restoreStatus, '', I.t('support.loading'));

    Y.backend()
      .then(function (b) { return b.useId(value); })
      .then(function (result) {
        var ok = result === 'player';
        setStatus(restoreStatus, ok ? 'ok' : 'error', I.t('restore.' + result));
        if (ok) { restoreInput.value = ''; loadAccount(); }
      })
      .catch(function (err) {
        console.error(err);
        setStatus(restoreStatus, 'error', Y.explain(err, 'restore.error'));
      })
      .then(function () { restoreSend.disabled = false; });
  });

  document.addEventListener('yablonya:lang', function () {
    renderNickPlaceholder();
    renderId();
  });
})();
