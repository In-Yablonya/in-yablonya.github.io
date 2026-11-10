/*
 * Раздел «О команде».
 *
 * У каждого участника:
 *  - name   — имя (и фамилия, если человек хочет); название карточки;
 *  - short  — предописание: несколько слов под названием карточки;
 *  - about  — подробное описание, показывается по нажатию на карточку (абзацы разделяйте пустой строкой);
 *  - photo  — путь к фото в img/team/ (портрет 3:4);
 *  - links  — ссылки на соцсети: только у тех, кто согласился, иначе оставьте [].
 *
 * Тем, кто не согласился показывать фото, ставим TEAM_PLACEHOLDER.
 */
var STUDIO_EMAIL = 'svetlananikolskaagame@gmail.com'; // почта студии для сотрудничества

var TEAM_PLACEHOLDER = 'img/team/placeholder.jpg';

var TEAM = [
  {
    name: { ru: 'Инь-Ян Кон-Дао', en: 'Yin-Yang Kon-Dao' },
    short: { ru: 'Создатель студии «Яблоня»', en: 'Founder of the “Yablonya” studio' },
    about: {
      ru: 'Это Я, создатель этой конторы. Мне 13 лет, Я вам разрабатываю эти игры, а подлецы, не играете.\n\n' +
          'Любимое блюдо — шаурма, любимый месяц — июль, любимое число — 13. День рождения — 13 июля. Кадоист. Пацифист.\n\n' +
          'Псевдоним — Мама Ос. Альт-личности: Яростьмир, Яромир инопланетянин, проклятый Яромир, Сталинмир, Батьмир, Бибип17, Яимра, Мама Ос.\n\n' +
          'Увлечения: программирование, 3D-моделирование.',
      en: 'It is me, the creator of this outfit. I am 13 years old, I develop these games for you, and you scoundrels do not even play them.\n\n' +
          'Favorite dish: shawarma. Favorite month: July. Favorite number: 13. Birthday: July 13. A Kadoist. A pacifist.\n\n' +
          'Alias: Mama Os. Alter egos: Yarostmir, Yaromir the Alien, Cursed Yaromir, Stalinmir, Batmir, Bibip17, Yaimra, Mama Os.\n\n' +
          'Hobbies: programming, 3D modeling.'
    },
    photo: 'img/team/inyan-kondao.jpg',
    links: [
      { label: 'YouTube', url: 'https://www.youtube.com/@Mother_wasps' },
      { label: 'VK', url: 'https://vk.ru/id833809539' },
      { label: 'Telegram', url: 'https://t.me/mama_os_dachnick' }
    ]
  },
  {
    name: { ru: 'Антон Абдулаев', en: 'Anton Abdulaev' },
    short: { ru: 'Помощник главы студии «Яблоня»', en: 'Assistant to the head of the “Yablonya” studio' },
    about: {
      ru: 'Я — помощник главы студии «Яблоня», то есть человек, который находится рядом с главой и помогает ему в работе над студией и её играми.\n\n' +
          'По своей основной специальности я геймдизайнер. Геймдизайнер — это тот, кто думает над тем, как должна быть устроена игра: какие в ней правила, что нужно делать игроку и как сделать так, чтобы играть было интересно от начала и до конца.\n\n' +
          'Кроме того, я тестировщик-ручник. Это значит, что игры я проверяю вручную: сам запускаю их, сам нажимаю на кнопки, сам прохожу уровни и внимательно смотрю, всё ли работает так, как задумано. Такая проверка нужна, чтобы ошибки находились ещё до того, как с ними столкнутся настоящие игроки.\n\n' +
          'Если говорить о более личном, то моё любимое блюдо — спагетти. А моё любимое число — 33, и это тоже не секрет.\n\n' +
          'Написать мне можно в личные сообщения в Telegram — ссылка находится чуть ниже.',
      en: 'I am the assistant to the head of the “Yablonya” studio, which means I work alongside the head and help with the studio and its games.\n\n' +
          'My main specialty is game design. A game designer is the person who thinks about how a game should be put together: what the rules are, what the player has to do, and how to make the game fun from the very beginning to the very end.\n\n' +
          'I am also a manual tester. That means I check games by hand: I launch them myself, press the buttons myself, play through the levels myself and carefully look at whether everything works the way it was meant to. This kind of checking is needed so that mistakes are found before real players run into them.\n\n' +
          'On a more personal note, my favorite dish is spaghetti. My favorite number is 33, and that is no secret either.\n\n' +
          'You can message me privately on Telegram — the link is just below.'
    },
    photo: 'img/team/toha.jpg',   // «Тоха» — это он (Антон)
    links: [
      { label: 'Telegram', url: 'https://t.me/Antony_33_XXXIII' }
      // TODO: ссылка на YouTube — { label: 'YouTube', url: 'https://…' }
    ]
  },
  {
    name: { ru: 'Мыкыта', en: 'Mykyta' },
    short: { ru: 'Участник команды', en: 'Team member' },   // TODO: пара слов о человеке
    about: { ru: '', en: '' },                              // TODO: подробное описание
    photo: TEAM_PLACEHOLDER,                                // человек не согласился показывать своё фото
    links: []
  }
];

(function () {
  'use strict';

  var I = window.I18N;
  var h = window.Yablonya.h;

  var list = document.getElementById('team');
  var emptyNote = document.getElementById('team-empty');
  var contact = document.getElementById('team-contact');
  var dialog = document.getElementById('member-dialog');
  var dName = document.getElementById('member-name');
  var dShort = document.getElementById('member-short');
  var dPhoto = document.getElementById('member-photo');
  var dAbout = document.getElementById('member-about');
  var dLinks = document.getElementById('member-links');

  var openMember = null;

  function isSafeUrl(url) {
    return /^https?:\/\//i.test(url);
  }

  // Если фото не нашлось — показываем заглушку (один раз, чтобы не зациклиться).
  function photo(el, src) {
    el.addEventListener('error', function () {
      if (el.getAttribute('data-fallback')) return;
      el.setAttribute('data-fallback', '1');
      el.src = TEAM_PLACEHOLDER;
    });
    el.src = src || TEAM_PLACEHOLDER;
    return el;
  }

  // ---------- карточки ----------
  function renderCard(m) {
    var card = h('button', { class: 'member', type: 'button', 'aria-haspopup': 'dialog' },
      photo(h('img', { class: 'member__photo', alt: '', width: 720, height: 960, loading: 'lazy', decoding: 'async' }), m.photo),
      h('h2', { class: 'member__name', text: I.loc(m.name) }),
      h('p', { class: 'member__short', text: I.loc(m.short) }),
      h('span', { class: 'member__more', text: I.t('team.more') + ' →' })
    );
    card.addEventListener('click', function () { show(m); });
    return card;
  }

  // ---------- окно участника ----------
  function renderDialog(m) {
    dName.textContent = I.loc(m.name);
    dShort.textContent = I.loc(m.short);

    dPhoto.removeAttribute('data-fallback');
    photo(dPhoto, m.photo);
    dPhoto.alt = I.loc(m.name);

    dAbout.textContent = '';
    var text = String(I.loc(m.about) || '').trim();
    if (text) {
      text.split(/\n\s*\n/).forEach(function (par) { dAbout.append(h('p', { text: par.trim() })); });
    } else {
      dAbout.append(h('p', { class: 'muted', text: I.t('team.about.soon') }));
    }

    dLinks.textContent = '';
    var links = (m.links || []).filter(function (l) { return l && isSafeUrl(l.url); });
    dLinks.hidden = links.length === 0;
    links.forEach(function (l) {
      dLinks.append(h('li', {}, h('a', { href: l.url, target: '_blank', rel: 'noopener noreferrer', text: l.label })));
    });
  }

  function show(m) {
    openMember = m;
    renderDialog(m);
    dialog.showModal();
    dialog.scrollTop = 0;
  }

  dialog.addEventListener('close', function () { openMember = null; });

  function render() {
    list.textContent = '';
    emptyNote.hidden = TEAM.length > 0;
    TEAM.forEach(function (m) { list.append(renderCard(m)); });

    contact.textContent = '';
    if (STUDIO_EMAIL) {
      contact.append(I.t('team.contact.text') + ' ', h('a', { href: 'mailto:' + STUDIO_EMAIL, text: STUDIO_EMAIL }));
    } else {
      contact.textContent = I.t('team.contact.soon');
    }
    if (openMember) renderDialog(openMember);
  }

  document.addEventListener('yablonya:lang', render);
  render();
})();
