/*
 * Тексты интерфейса на русском и английском.
 * В HTML: data-i18n="ключ" — подставляет текст в элемент,
 *         data-i18n-attr="aria-label:ключ;title:ключ" — подставляет в атрибуты.
 * В JS:   I18N.t('ключ', { n: 1 }),  I18N.loc({ ru: '…', en: '…' }).
 */
(function () {
  'use strict';

  var DICT = {
    ru: {
      'studio.name': 'Яблоня',
      'studio.tagline': 'Игровая студия',

      'title.menu': 'Яблоня — игровая студия',
      'title.projects': 'Проекты — Яблоня',
      'title.team': 'О команде — Яблоня',
      'title.moss': 'Империя Мха — Яблоня',

      'menu.nav': 'Разделы сайта',
      'menu.projects': 'Проекты',
      'menu.projects.sub': 'Игры студии и скачивание',
      'menu.team': 'О команде',
      'menu.team.sub': 'Кто делает наши игры',
      'menu.moss': 'Империя Мха',
      'menu.moss.sub': 'Реал-лайф проект по выращиванию мха',

      'btn.account': 'Аккаунт',
      'btn.support': 'Обратиться в поддержку',
      'btn.back': 'В главное меню',
      'btn.close': 'Закрыть',
      'btn.send': 'Отправить',
      'btn.copy': 'Копировать',
      'btn.copied': 'Скопировано',
      'btn.show': 'Показать',
      'btn.hide': 'Скрыть',
      'btn.restore': 'Войти',
      'btn.answer': 'Ответить на вопросы',
      'chat.lead': 'Это общий чат с администраторами: вам может ответить любой из них. Другие игроки ваших сообщений не видят.',
      'chat.placeholder': 'Ваше сообщение',
      'chat.hint': 'Enter — отправить, Shift+Enter — новая строка.',
      'chat.empty': 'Напишите нам, и мы ответим здесь.',
      'chat.admin': 'поддержка',
      'chat.error': 'Не получилось отправить. Попробуйте ещё раз.',
      'answer.title': 'Вопросы игроков',
      'answer.list': 'Чаты',
      'answer.filter': 'Только без ответа',
      'answer.empty': 'Пока никто не писал.',
      'answer.pick': 'Выберите чат из списка.',
      'answer.back': '← К списку',
      'answer.placeholder': 'Ответ игроку',
      'answer.waiting': 'Ждёт ответа',
      'answer.denied': 'Нужны права администратора. Их выдаёт владелец сайта в базе данных (поле admin у вашего аккаунта).',
      'answer.player': 'Игрок {nick} · ID {id}',
      'answer.error': 'Не получилось выполнить действие. Попробуйте ещё раз.',
      'btn.save': 'Сохранить',
      'user.default': 'Пользователь {n}',
      'account.nick.title': 'Никнейм',
      'account.nick.label': 'Никнейм',
      'account.nick.hint': 'При первом заходе вам выдаётся имя «Пользователь N». Его можно сменить на своё (до 24 символов). Пустое поле вернёт имя по умолчанию.',
      'nick.saved': 'Никнейм сохранён.',
      'nick.reset': 'Вернули имя по умолчанию.',
      'nick.error': 'Не получилось сохранить никнейм. Попробуйте ещё раз.',
      'aria.theme': 'Сменить тему оформления',
      'aria.lang': 'Сменить язык',

      'projects.title': 'Проекты',
      'projects.lead': 'Игры студии. Нажмите на игру, чтобы посмотреть скриншоты и скачать её.',
      'projects.empty': 'Игры скоро появятся.',
      'game.shots': 'Скриншоты',
      'game.shot': 'Скриншот {n}',
      'game.noShots': 'Скриншотов пока нет.',
      'game.downloads': 'Скачать',
      'dl.windows': 'Скачать для Windows',
      'dl.linux': 'Скачать для Linux',
      'dl.macos': 'Скачать для macOS',
      'dl.android': 'Скачать для Android',
      'dl.web': 'Играть в браузере',
      'dl.soon': 'скоро',
      'hint.windows.title': 'Windows показывает предупреждение?',
      'hint.windows.text': 'Файл не подписан цифровой подписью, поэтому SmartScreen или антивирус может его остановить. Нажмите «Подробнее» → «Выполнить в любом случае».',
      'hint.android.title': 'Как установить .apk на Android?',
      'hint.android.text': 'Скачайте файл и откройте его. Когда телефон попросит, разрешите установку из неизвестных источников для браузера или файлового менеджера (обычно: Настройки → Безопасность или Приложения → Особый доступ → Установка неизвестных приложений).',

      'team.title': 'О команде',
      'team.lead': 'Люди, которые делают игры студии «Яблоня».',
      'team.empty': 'Список участников скоро появится.',
      'team.contact.title': 'Сотрудничество',
      'team.contact.text': 'Для сотрудничества пишите на почту студии:',
      'team.contact.soon': 'Адрес почты студии скоро появится.',
      'team.links': 'Ссылки',
      'team.more': 'Подробнее',
      'team.about.soon': 'Подробное описание скоро появится.',

      'moss.title': 'Империя Мха',
      'moss.lead': 'Реал-лайф проект по выращиванию мха. Это не игра, поэтому скачивать здесь нечего.',
      'moss.about.title': 'О проекте',
      'moss.about.text': 'Мы выращиваем настоящий мох и ведём этот проект как большую кампанию: с целями, этапами и отчётами. Здесь будут фотографии мха и рассказы о том, как идут дела.',
      'moss.photo.alt': 'Мох крупным планом',
      'moss.progress.title': 'Как продвигается',
      'moss.progress.empty': 'Первые записи о ходе проекта появятся здесь.',
      'post.write': 'Написать пост',
      'post.edit': 'Изменить',
      'post.delete': 'Удалить',
      'post.delete.confirm': 'Удалить этот пост? Это нельзя отменить.',
      'post.dialog.new': 'Новый пост',
      'post.dialog.edit': 'Редактирование поста',
      'post.title': 'Заголовок',
      'post.text': 'Текст',
      'post.text.hint': 'Абзацы разделяйте пустой строкой. Пост увидят все посетители сайта.',
      'post.publish': 'Опубликовать',
      'post.by': 'Автор: {name}',
      'post.edited': 'изменено',
      'post.error': 'Не получилось сохранить пост. Попробуйте ещё раз.',
      'post.loadError': 'Не получилось загрузить посты.',
      'menu.news': 'Новости Яблони',
      'menu.news.sub': 'Что нового в студии',
      'title.news': 'Новости — Яблоня',
      'title.editor': 'Написать новость — Яблоня',
      'btn.news.add': 'Написать новость',
      'news.title': 'Новости Яблони',
      'news.lead': 'Что нового в студии. Новости можно оценивать и обсуждать в комментариях.',
      'news.empty': 'Новостей пока нет.',
      'news.like': 'Нравится',
      'news.dislike': 'Не нравится',
      'news.comments': 'Комментарии ({n})',
      'news.comments.none': 'Комментариев пока нет. Будьте первым!',
      'news.comment.placeholder': 'Ваш комментарий',
      'news.reply': 'Ответить',
      'news.reply.to': 'Ответ для {name}',
      'news.reply.cancel': 'Отмена',
      'news.reply.in': 'в ответ {name}',
      'news.admin.badge': 'админ',
      'news.delete.comment.confirm': 'Удалить этот комментарий?',
      'news.error': 'Не получилось выполнить действие. Попробуйте ещё раз.',
      'news.loadError': 'Не получилось загрузить новости.',
      'posts.note': 'Посты на этой странице написаны по-русски.',
      'editor.title': 'Написать новость',
      'editor.lead': 'Эту страницу видят только администраторы. Опубликованное появится на странице «Новости Яблони».',
      'editor.list': 'Опубликованные новости',
      'editor.cancel': 'Отменить правку',
      'editor.view': 'Открыть новости',
      'editor.none': 'Опубликованных новостей пока нет.',
      'editor.saved': 'Готово: новость сохранена.',

      'support.title': 'Поддержка',
      'support.unavailable': 'Поддержка пока не подключена. Загляните позже.',
      'support.loading': 'Подключаемся…',

      'account.title': 'Аккаунт',
      'account.id': 'Ваш ID',
      'account.id.warn': 'ID выдан вам автоматически при первом заходе и хранится в cookie этого браузера. Он работает как пароль: по нему видны ваш никнейм и переписка с поддержкой. Никому его не показывайте.',
      'account.restore.title': 'Войти по ID',
      'account.restore.hint': 'Есть аккаунт на другом устройстве или вы очистили cookie? Введите его ID, и этот браузер станет тем же аккаунтом: с тем же никнеймом и перепиской.',
      'account.restore.label': 'ID',
      'restore.player': 'Готово: вы вошли в свой аккаунт, никнейм и переписка на месте.',
      'restore.same': 'Этот ID уже используется.',
      'restore.invalid': 'ID выглядит неверно: проверьте, что скопировали его целиком.',
      'restore.notfound': 'Такой ID не найден.',
      'restore.error': 'Не получилось проверить ID. Попробуйте позже.',
      'account.staff.title': 'Администратор поддержки',
      'account.staff.as': 'Ваш аккаунт отмечен как администратор: вместо кнопки «Обратиться в поддержку» у вас кнопка «Ответить на вопросы» с чатами игроков.',
      'account.unavailable': 'Аккаунт появится, когда подключится поддержка.',
      'account.error': 'Не получилось подключиться. Попробуйте позже.',
      'error.file': 'Сайт открыт как обычный файл, а подключение к аккаунтам и поддержке работает только по адресу http:// или https://. Откройте сайт через локальный сервер (см. README) или по опубликованному адресу.',
    },

    en: {
      'studio.name': 'Yablonya',
      'studio.tagline': 'Game studio',

      'title.menu': 'Yablonya — game studio',
      'title.projects': 'Projects — Yablonya',
      'title.team': 'Team — Yablonya',
      'title.moss': 'Moss Empire — Yablonya',

      'menu.nav': 'Site sections',
      'menu.projects': 'Projects',
      'menu.projects.sub': 'Our games and downloads',
      'menu.team': 'Team',
      'menu.team.sub': 'The people behind our games',
      'menu.moss': 'Moss Empire',
      'menu.moss.sub': 'A real-life moss growing project',

      'btn.account': 'Account',
      'btn.support': 'Contact support',
      'btn.back': 'Back to main menu',
      'btn.close': 'Close',
      'btn.send': 'Send',
      'btn.copy': 'Copy',
      'btn.copied': 'Copied',
      'btn.show': 'Show',
      'btn.hide': 'Hide',
      'btn.restore': 'Sign in',
      'btn.answer': 'Answer questions',
      'chat.lead': 'This is a shared chat with the administrators: any of them can reply to you. Other players cannot see your messages.',
      'chat.placeholder': 'Your message',
      'chat.hint': 'Enter to send, Shift+Enter for a new line.',
      'chat.empty': 'Write to us and we will reply here.',
      'chat.admin': 'support',
      'chat.error': 'Could not send. Please try again.',
      'answer.title': 'Player questions',
      'answer.list': 'Chats',
      'answer.filter': 'Unanswered only',
      'answer.empty': 'Nobody has written yet.',
      'answer.pick': 'Pick a chat from the list.',
      'answer.back': '← To the list',
      'answer.placeholder': 'Reply to the player',
      'answer.waiting': 'Waiting for a reply',
      'answer.denied': 'Administrator rights are required. The site owner grants them in the database (the admin field of your account).',
      'answer.player': 'Player {nick} · ID {id}',
      'answer.error': 'Something went wrong. Please try again.',
      'btn.save': 'Save',
      'user.default': 'User {n}',
      'account.nick.title': 'Nickname',
      'account.nick.label': 'Nickname',
      'account.nick.hint': 'On your first visit you get the name “User N”. You can change it to your own (up to 24 characters). An empty field brings back the default name.',
      'nick.saved': 'Nickname saved.',
      'nick.reset': 'The default name is back.',
      'nick.error': 'Could not save the nickname. Please try again.',
      'aria.theme': 'Switch color theme',
      'aria.lang': 'Change language',

      'projects.title': 'Projects',
      'projects.lead': 'Our games. Click a game to see screenshots and download it.',
      'projects.empty': 'Games are coming soon.',
      'game.shots': 'Screenshots',
      'game.shot': 'Screenshot {n}',
      'game.noShots': 'No screenshots yet.',
      'game.downloads': 'Download',
      'dl.windows': 'Download for Windows',
      'dl.linux': 'Download for Linux',
      'dl.macos': 'Download for macOS',
      'dl.android': 'Download for Android',
      'dl.web': 'Play in browser',
      'dl.soon': 'soon',
      'hint.windows.title': 'Does Windows show a warning?',
      'hint.windows.text': 'The file is not code-signed, so SmartScreen or your antivirus may stop it. Click “More info” → “Run anyway”.',
      'hint.android.title': 'How do I install an .apk on Android?',
      'hint.android.text': 'Download the file and open it. When your phone asks, allow installing from unknown sources for your browser or file manager (usually Settings → Security, or Apps → Special access → Install unknown apps).',

      'team.title': 'Team',
      'team.lead': 'The people who make Yablonya games.',
      'team.empty': 'The team list is coming soon.',
      'team.contact.title': 'Collaboration',
      'team.contact.text': 'To work with us, write to the studio email:',
      'team.contact.soon': 'The studio email will appear soon.',
      'team.links': 'Links',
      'team.more': 'Read more',
      'team.about.soon': 'A detailed description is coming soon.',

      'moss.title': 'Moss Empire',
      'moss.lead': 'A real-life moss growing project. It is not a game, so there is nothing to download here.',
      'moss.about.title': 'About the project',
      'moss.about.text': 'We grow real moss and run the project like a big campaign, with goals, stages and reports. Photos of the moss and stories about how it is going will appear here.',
      'moss.photo.alt': 'Close-up of moss',
      'moss.progress.title': 'Progress',
      'moss.progress.empty': 'The first progress updates will appear here.',
      'post.write': 'Write a post',
      'post.edit': 'Edit',
      'post.delete': 'Delete',
      'post.delete.confirm': 'Delete this post? This cannot be undone.',
      'post.dialog.new': 'New post',
      'post.dialog.edit': 'Edit post',
      'post.title': 'Title',
      'post.text': 'Text',
      'post.text.hint': 'Separate paragraphs with an empty line. Every visitor of the site will see the post.',
      'post.publish': 'Publish',
      'post.by': 'By {name}',
      'post.edited': 'edited',
      'post.error': 'Could not save the post. Please try again.',
      'post.loadError': 'Could not load the posts.',
      'menu.news': 'Yablonya News',
      'menu.news.sub': 'What is new at the studio',
      'title.news': 'News — Yablonya',
      'title.editor': 'Write news — Yablonya',
      'btn.news.add': 'Write news',
      'news.title': 'Yablonya News',
      'news.lead': 'What is new at the studio. You can rate the news and discuss it in the comments.',
      'news.empty': 'No news yet.',
      'news.like': 'Like',
      'news.dislike': 'Dislike',
      'news.comments': 'Comments ({n})',
      'news.comments.none': 'No comments yet. Be the first!',
      'news.comment.placeholder': 'Your comment',
      'news.reply': 'Reply',
      'news.reply.to': 'Replying to {name}',
      'news.reply.cancel': 'Cancel',
      'news.reply.in': 'replying to {name}',
      'news.admin.badge': 'admin',
      'news.delete.comment.confirm': 'Delete this comment?',
      'news.error': 'Something went wrong. Please try again.',
      'news.loadError': 'Could not load the news.',
      'posts.note': 'Heads-up: the posts on this page are written in Russian.',
      'editor.title': 'Write news',
      'editor.lead': 'Only administrators can see this page. What you publish appears on the “Yablonya News” page.',
      'editor.list': 'Published news',
      'editor.cancel': 'Cancel editing',
      'editor.view': 'Open the news',
      'editor.none': 'No published news yet.',
      'editor.saved': 'Done: the news is saved.',

      'support.title': 'Support',
      'support.unavailable': 'Support is not connected yet. Please check back later.',
      'support.loading': 'Connecting…',

      'account.title': 'Account',
      'account.id': 'Your ID',
      'account.id.warn': 'The ID was issued to you automatically on your first visit and is stored in this browser’s cookies. It works like a password: it gives access to your nickname and your chat with support. Do not show it to anyone.',
      'account.restore.title': 'Sign in with an ID',
      'account.restore.hint': 'Have an account on another device, or cleared your cookies? Enter its ID and this browser becomes the same account, with the same nickname and chat.',
      'account.restore.label': 'ID',
      'restore.player': 'Done: you are signed in to your account, your nickname and chat are back.',
      'restore.same': 'This ID is already in use.',
      'restore.invalid': 'The ID looks wrong. Check that you copied all of it.',
      'restore.notfound': 'This ID was not found.',
      'restore.error': 'Could not check the ID. Please try later.',
      'account.staff.title': 'Support administrator',
      'account.staff.as': 'Your account is marked as an administrator: instead of “Contact support” you have an “Answer questions” button with the players’ chats.',
      'account.unavailable': 'Your account will be available once support is connected.',
      'account.error': 'Could not connect. Please try later.',
      'error.file': 'The site is opened as a plain file, but accounts and support only work from an http:// or https:// address. Open the site through a local server (see the README) or at its published address.',
    }
  };

  var lang = window.YablonyaLang === 'en' ? 'en' : 'ru';

  function t(key, vars) {
    var s = (DICT[lang] && DICT[lang][key]) || DICT.ru[key] || key;
    if (vars) {
      s = s.replace(/\{(\w+)\}/g, function (m, name) { return vars[name] != null ? vars[name] : m; });
    }
    return s;
  }

  // Берёт текст нужного языка из объекта { ru: '…', en: '…' }.
  function loc(value) {
    if (value && typeof value === 'object') return value[lang] || value.ru || value.en || '';
    return value || '';
  }

  function apply(scope) {
    scope = scope || document;
    var nodes = scope.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = t(nodes[i].getAttribute('data-i18n'));

    var withAttr = scope.querySelectorAll('[data-i18n-attr]');
    for (var j = 0; j < withAttr.length; j++) {
      var pairs = withAttr[j].getAttribute('data-i18n-attr').split(';');
      for (var k = 0; k < pairs.length; k++) {
        var p = pairs[k].split(':');
        if (p.length === 2) withAttr[j].setAttribute(p[0].trim(), t(p[1].trim()));
      }
    }
  }

  function setLang(next) {
    if (next !== 'ru' && next !== 'en') return;
    lang = next;
    try { localStorage.setItem('yablonya.lang', next); } catch (e) { /* без сохранения */ }
    document.documentElement.setAttribute('lang', next);
    apply(document);
    document.dispatchEvent(new CustomEvent('yablonya:lang', { detail: { lang: next } }));
  }

  window.I18N = {
    t: t,
    loc: loc,
    apply: apply,
    setLang: setLang,
    get lang() { return lang; }
  };

  apply(document);
})();
