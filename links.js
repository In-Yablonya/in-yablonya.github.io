/*
 * ССЫЛКИ НА ИГРЫ — единственный файл, который нужно править, когда выходит новая версия.
 * Сайт сам берёт отсюда адреса для кнопок «Скачать…» и «Играть в браузере» в разделе «Проекты».
 *
 * ┌───────────────────────── КАК ОБНОВИТЬ ЗА 5 МИНУТ ─────────────────────────┐
 *  1. Выложите новый релиз в репозитории игры на GitHub (раздел Releases).
 *  2. На странице релиза нажмите правой кнопкой на нужный файл → «Копировать адрес ссылки».
 *     Ссылка выглядит так:
 *     https://github.com/<аккаунт>/<репозиторий>/releases/download/<тег релиза>/<имя файла>
 *  3. Найдите ниже нужную игру и систему и замените адрес между кавычками.
 *     Кавычки и запятые в конце строк не трогайте.
 *  4. Сохраните файл и обновите страницу «Проекты» (Ctrl+F5). Нажмите кнопку и проверьте,
 *     что файл скачивается. Все ссылки сразу можно проверить командой в папке сайта:
 *         node .claude/check-links.js
 *  5. Отправьте изменения на сайт. GitHub Pages обновится сам через минуту-две.
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * ПРАВИЛА
 *  - windows, linux, macos, android — файлы для скачивания; web — игра в браузере (Netlify и т. п.);
 *  - нет сборки под систему — удалите строку целиком, и кнопки не будет;
 *  - пустая строка '' — неактивная кнопка «скоро» (ссылку ещё не вписали);
 *  - после каждой строки, кроме последней в группе, нужна запятая;
 *  - если у релиза поменялся тег или имя файла, старая ссылка перестаёт работать:
 *    всегда копируйте ссылку заново;
 *  - слово перед двоеточием у игры ('shootin', 'be-bees'…) — её id из js/projects.js, его не меняйте.
 *    Новая игра: название, описание и картинки добавляются в js/projects.js, а её ссылки — сюда с тем же id.
 *
 * Если после правки страница «Проекты» стала пустой, почти всегда потерялась запятая или кавычка.
 * Проверить файл можно командой: node --check js/links.js
 */
var GAME_LINKS = {

  // Neon Catch: Ultra — только в браузере
  'neon-catch': {
    web: 'https://creative-kulfi-541790.netlify.app/'
  },

  // ShootIn
  'shootin': {
    windows: 'https://github.com/svetlyi072-debug/shootin/releases/download/v1.2.0/ShootIn-1.2.0-android.apk',
    linux:   'https://github.com/svetlyi072-debug/shootin/releases/download/v1.2.0/ShootIn-1.2.0-linux-x86_64.tar.gz',
    macos:   'https://github.com/svetlyi072-debug/shootin/releases/download/v1.2.0/ShootIn-1.2.0-macos.zip',
    android: 'https://github.com/svetlyi072-debug/shootin/releases/download/v1.2.0/ShootIn-1.2.0-android.apk',
    web:     'https://lovely-malabi-8071c9.netlify.app/',
  },

  // be_bees
  'be-bees': {
    windows: 'https://github.com/svetlyi072-debug/Be-Bees/releases/download/v1.0.0/Be_Bees.exe',
    linux:   'https://github.com/svetlyi072-debug/Be-Bees/releases/download/v1.0.0/Be_Bees-Linux.tar.gz',
    macos:   'https://github.com/svetlyi072-debug/Be-Bees/releases/download/v1.0.0/Be_Bees-macOS.zip',
    android: 'https://github.com/svetlyi072-debug/Be-Bees/releases/download/v1.0.0/Be_Bees-Android.apk',
    web:     'https://gleaming-meringue-594ed4.netlify.app/'
  },

  // AFR — без Android и браузерной версии
  'afr': {
    windows: 'https://github.com/svetlyi072-debug/platformer-2-0-sp/releases/download/v1.0.0/platformer.exe',
    linux:   'https://github.com/svetlyi072-debug/platformer-2-0-sp/releases/download/v1.0.0/platformer-linux-x86_64.tar.gz',
    macos:   'https://github.com/svetlyi072-debug/platformer-2-0-sp/releases/download/v1.0.0/platformer-macos-universal.zip'
  },

  // AGraft18 — только в браузере
  'agraft18': {
    web: 'https://soft-twilight-3d3b54.netlify.app/'
  }

};
