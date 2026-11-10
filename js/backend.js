/*
 * Связь с Firebase: анонимный вход, ID игрока, никнейм, чат с поддержкой, права администратора.
 * Это ES-модуль: он загружается только когда игрок открывает «Аккаунт» или «Обратиться в поддержку».
 *
 * Как устроен ID:
 *  - Firebase при первом заходе выдаёт анонимному игроку длинный случайный uid. Он и есть ID игрока.
 *  - ID хранится в cookie (резервно — в localStorage). Правила базы проверяют не cookie,
 *    а вход в Firebase, поэтому «подделать» чужие обращения в коде страницы нельзя.
 *  - Если cookie очищены, Firebase выдаст новый uid. Игрок вводит старый ID в настройках аккаунта,
 *    и текущий вход привязывается к нему записью links/<ID>/<uid> (см. database.rules.json).
 *  - Администраторы (сотрудники поддержки и владелец сайта) отмечаются вручную в базе:
 *    players/<ID>/admin = true. Игрок сам изменить это поле не может, права проверяют правила базы.
 *
 * Структура базы и правила доступа: database.rules.json.
 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  getDatabase, ref, get, set, update, remove, push, onValue, runTransaction, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js';

const COOKIE_NAME = 'yablonya_id';
const STORAGE_KEY = 'yablonya.id';
const ID_PATTERN = /^[A-Za-z0-9_-]{20,128}$/;

let db = null;
let uid = null;
let playerId = null;
let profile = { number: null, nickname: null, admin: false };   // номер, никнейм (если задан) и флаг администратора
let support = null;     // { admin: true }, если игрок отмечен администратором
let initPromise = null;

export const NICKNAME_MAX = 24;

// ---------- хранение ID ----------
function readCookie() {
  const m = document.cookie.match(new RegExp('(?:^|; )' + COOKIE_NAME + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}

function readStorage() {
  try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
}

function rememberId(id) {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = COOKIE_NAME + '=' + encodeURIComponent(id) +
    '; max-age=' + 60 * 60 * 24 * 365 * 5 + '; path=/; SameSite=Lax' + secure;
  try { localStorage.setItem(STORAGE_KEY, id); } catch (e) { /* без резервной копии */ }
}

function storedId() {
  const found = [readCookie(), readStorage()].find((v) => v && ID_PATTERN.test(v));
  return found || null;
}

// ---------- запуск ----------
async function start(prefs) {
  const app = initializeApp(window.firebaseConfig);
  const auth = getAuth(app);
  db = getDatabase(app);

  await auth.authStateReady();
  if (!auth.currentUser) await signInAnonymously(auth);
  uid = auth.currentUser.uid;
  playerId = storedId() || uid;

  // Привязываем текущий вход в Firebase к ID игрока (нужно, если ID взят из cookie, а uid новый).
  const linkRef = ref(db, `links/${playerId}/${uid}`);
  if (!(await get(linkRef)).exists()) await set(linkRef, true);

  const playerRef = ref(db, `players/${playerId}`);
  const snap = await get(playerRef);
  if (snap.exists()) {
    profile = profileFrom(snap.val());
    const saved = snap.val() || {};
    if (saved.lang !== prefs.lang || saved.theme !== prefs.theme) {
      await update(playerRef, { lang: prefs.lang, theme: prefs.theme });
    }
    if (profile.number == null) {                 // профиль без номера: выдаём его сейчас
      profile.number = await nextNumber();
      await update(playerRef, { number: profile.number });
    }
  } else {
    // Новый игрок: порядковый номер для имени «Пользователь N».
    const number = await nextNumber();
    // admin: false создаётся сразу, чтобы поле было видно в консоли Firebase: включить его (true) может только владелец.
    await update(playerRef, { createdAt: serverTimestamp(), lang: prefs.lang, theme: prefs.theme, number, admin: false });
    profile = { number, nickname: null, admin: false };
  }

  rememberId(playerId);
  await syncSupport();
}

function profileFrom(value) {
  const v = value || {};
  return {
    number: typeof v.number === 'number' ? v.number : null,
    nickname: typeof v.nickname === 'string' && v.nickname ? v.nickname : null,
    admin: v.admin === true
  };
}

// Следующий порядковый номер: счётчик meta/userCounter растёт на 1 в транзакции.
async function nextNumber() {
  const result = await runTransaction(ref(db, 'meta/userCounter'), (current) => (current || 0) + 1);
  return result.snapshot.val();
}

// Права администратора берутся из профиля (players/<ID>/admin). Если флаг стоит, записываем «сессию»
// supportSessions/<uid> = <ID>: по ней правила базы пускают в чужие обращения. Сняли флаг — сессию убираем.
async function syncSupport() {
  support = null;
  const sessionRef = ref(db, `supportSessions/${uid}`);
  const session = await get(sessionRef);
  if (profile.admin) {
    try {
      if (session.val() !== playerId) await set(sessionRef, playerId);
      support = { admin: true };
    } catch (err) {
      console.warn('Права администратора не подтверждены:', err && err.code);
    }
  } else if (session.exists()) {
    await remove(sessionRef);
  }
}

function snapshotState() {
  return {
    playerId,
    profile: { number: profile.number, nickname: profile.nickname, admin: profile.admin },
    support: support ? { admin: true } : null
  };
}

function requireStarted() {
  if (!initPromise) throw new Error('not-initialized');
  return initPromise;
}

// ---------- публичный интерфейс ----------

// Подключается к Firebase (один раз), при первом заходе выдаёт ID и номер,
// и возвращает { playerId, profile: { number, nickname }, support }.
export function init(prefs) {
  if (!initPromise) {
    const safePrefs = { lang: 'ru', theme: 'system', ...(prefs || {}) };
    initPromise = start(safePrefs).catch((err) => { initPromise = null; throw err; });
  }
  return initPromise.then(snapshotState);
}

// Сохраняет язык и тему в players/<id> (если уже подключены).
export async function savePrefs(prefs) {
  if (!initPromise) return;
  await initPromise;
  await update(ref(db, `players/${playerId}`), { lang: prefs.lang, theme: prefs.theme });
}

// Принимает введённый ID игрока: возвращает 'player' | 'same' | 'invalid' | 'notfound'.
export async function useId(input) {
  await requireStarted();
  const id = String(input || '').trim();
  if (!ID_PATTERN.test(id)) return 'invalid';
  if (id === playerId) return 'same';

  // Привязываем вход к ID и смотрим, есть ли такой игрок.
  await set(ref(db, `links/${id}/${uid}`), true);
  const found = await get(ref(db, `players/${id}`));
  if (found.exists()) {
    playerId = id;
    profile = profileFrom(found.val());
    rememberId(id);
    await syncSupport();                         // у этого аккаунта могут быть права администратора
    return 'player';
  }
  await remove(ref(db, `links/${id}/${uid}`));
  return 'notfound';
}

// Меняет никнейм. Пустая строка возвращает имя по умолчанию («Пользователь N»).
// Возвращает сохранённый никнейм или null.
export async function setNickname(name) {
  await requireStarted();
  const nickname = String(name || '').trim();
  if (nickname.length > NICKNAME_MAX) throw new Error('nickname-too-long');
  const playerRef = ref(db, `players/${playerId}`);
  if (nickname) {
    await update(playerRef, { nickname });
    profile.nickname = nickname;
  } else {
    await remove(ref(db, `players/${playerId}/nickname`));
    profile.nickname = null;
  }
  return profile.nickname;
}

// ---------- чат с поддержкой ----------
// У каждого игрока один сплошной чат: chats/<ID игрока>/<сообщение>. В него пишет сам игрок
// (role: 'user') и любой администратор (role: 'admin'). Чужие чаты игрок не видит.
// chatList/<ID> — краткая сводка чата (ник, последнее сообщение) для списка у администраторов.

function messagesFrom(value) {
  return Object.entries(value || {})
    .map(([id, m]) => ({
      id,
      role: m.role === 'admin' ? 'admin' : 'user',
      name: m.name || '',
      text: m.text || '',
      createdAt: m.createdAt || 0
    }))
    .sort((a, b) => a.createdAt - b.createdAt);
}

// Добавляет сообщение и обновляет сводку одним запросом (правила проверяют каждый путь отдельно).
async function postMessage(pid, role, name, text, nick) {
  const clean = String(text || '').trim();
  if (!clean) throw new Error('empty-message');
  const key = push(ref(db, `chats/${pid}`)).key;
  await update(ref(db), {
    [`chats/${pid}/${key}`]: {
      role,
      name: String(name || '').trim().slice(0, 40) || (role === 'admin' ? 'Support' : 'User'),
      text: clean.slice(0, 2000),
      createdAt: serverTimestamp()
    },
    [`chatList/${pid}`]: {
      nick: String(nick || name || '').trim().slice(0, 40) || 'User',
      lastText: clean.replace(/\s+/g, ' ').slice(0, 120),
      lastAt: serverTimestamp(),
      lastRole: role
    }
  });
}

// Игрок пишет в свой чат. name — его имя (никнейм или «Пользователь N»).
export async function sendMessage(text, name) {
  await requireStarted();
  await postMessage(playerId, 'user', name, text, name);
}

// Сообщения чата текущего игрока (обновляются сами). Возвращает функцию «отписаться».
export function watchMyChat(onChange, onError) {
  return onValue(
    ref(db, `chats/${playerId}`),
    (snap) => onChange(messagesFrom(snap.val())),
    (err) => { if (onError) onError(err); }
  );
}

// Только для администраторов: список чатов, самые свежие сверху.
export function watchChatList(onChange, onError) {
  return onValue(
    ref(db, 'chatList'),
    (snap) => {
      const all = snap.val() || {};
      const list = Object.keys(all).map((pid) => ({
        pid,
        nick: all[pid].nick || '',
        lastText: all[pid].lastText || '',
        lastAt: all[pid].lastAt || 0,
        lastRole: all[pid].lastRole === 'admin' ? 'admin' : 'user'
      }));
      onChange(list.sort((a, b) => b.lastAt - a.lastAt));
    },
    (err) => { if (onError) onError(err); }
  );
}

// Только для администраторов: сообщения выбранного игрока.
export function watchChat(pid, onChange, onError) {
  return onValue(
    ref(db, `chats/${pid}`),
    (snap) => onChange(messagesFrom(snap.val())),
    (err) => { if (onError) onError(err); }
  );
}

// Администратор отвечает игроку pid. name — имя администратора, nick — ник игрока (остаётся в списке).
export async function sendAdminMessage(pid, text, name, nick) {
  await requireStarted();
  if (!support) throw new Error('not-admin');
  await postMessage(pid, 'admin', name, text, nick);
}

// ---------- посты про «Империю Мха» ----------
// mossPosts/<id>: title, text, author, createdAt, updatedAt. Читают все, пишут только администраторы.

// Все посты (обновляются сами), самые свежие сверху. Возвращает функцию «отписаться».
export function watchPosts(onChange, onError) {
  return onValue(
    ref(db, 'mossPosts'),
    (snap) => {
      const all = snap.val() || {};
      const list = Object.keys(all).map((id) => ({
        id,
        title: all[id].title || '',
        text: all[id].text || '',
        author: all[id].author || '',
        createdAt: all[id].createdAt || 0,
        updatedAt: all[id].updatedAt || 0
      }));
      onChange(list.sort((a, b) => b.createdAt - a.createdAt));
    },
    (err) => { if (onError) onError(err); }
  );
}

function cleanPost(title, text) {
  const t = String(title || '').trim();
  const body = String(text || '').trim();
  if (!t || !body) throw new Error('empty-post');
  if (t.length > 120 || body.length > 8000) throw new Error('post-too-long');
  return { title: t, text: body };
}

// Новый пост. author — имя администратора (его никнейм).
export async function createPost(title, text, author) {
  await requireStarted();
  if (!support) throw new Error('not-admin');
  const fields = cleanPost(title, text);
  const key = push(ref(db, 'mossPosts')).key;
  await set(ref(db, `mossPosts/${key}`), {
    ...fields,
    author: String(author || '').trim().slice(0, 40) || 'Admin',
    createdAt: serverTimestamp()
  });
  return key;
}

// Правка поста: автор и дата создания остаются прежними, добавляется отметка об изменении.
export async function editPost(id, title, text) {
  await requireStarted();
  if (!support) throw new Error('not-admin');
  await update(ref(db, `mossPosts/${id}`), { ...cleanPost(title, text), updatedAt: serverTimestamp() });
}

export async function deletePost(id) {
  await requireStarted();
  if (!support) throw new Error('not-admin');
  await remove(ref(db, `mossPosts/${id}`));
}

// ---------- «Новости Яблони» ----------
// news/<id>              — посты (читают все, пишут администраторы);
// newsComments/<post>/<id> — комментарии и ответы (parent — id главного комментария, на который отвечают);
// newsReactions/<post>/<ключ игрока> — 'like' или 'dislike'. Ключ — хэш ID игрока, а не сам ID:
//   сам ID работает как пароль и в открытых данных светиться не должен.

async function voterKey() {
  const bytes = new TextEncoder().encode(`yablonya-news:${playerId}`);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

// Новости, свежие сверху. Возвращает функцию «отписаться».
export function watchNews(onChange, onError) {
  return onValue(
    ref(db, 'news'),
    (snap) => {
      const all = snap.val() || {};
      const list = Object.keys(all).map((id) => ({
        id,
        title: all[id].title || '',
        text: all[id].text || '',
        author: all[id].author || '',
        createdAt: all[id].createdAt || 0,
        updatedAt: all[id].updatedAt || 0
      }));
      onChange(list.sort((a, b) => b.createdAt - a.createdAt));
    },
    (err) => { if (onError) onError(err); }
  );
}

// Комментарии всех новостей: { <id новости>: [комментарии по времени] }.
export function watchNewsComments(onChange, onError) {
  return onValue(
    ref(db, 'newsComments'),
    (snap) => {
      const all = snap.val() || {};
      const byPost = {};
      Object.keys(all).forEach((post) => {
        byPost[post] = Object.keys(all[post]).map((id) => ({
          id,
          text: all[post][id].text || '',
          name: all[post][id].name || '',
          role: all[post][id].role === 'admin' ? 'admin' : 'user',
          parent: all[post][id].parent || null,
          replyTo: all[post][id].replyTo || '',
          createdAt: all[post][id].createdAt || 0
        })).sort((a, b) => a.createdAt - b.createdAt);
      });
      onChange(byPost);
    },
    (err) => { if (onError) onError(err); }
  );
}

// Лайки и дизлайки: { <id новости>: { likes, dislikes, mine: 'like' | 'dislike' | null } }.
export function watchNewsReactions(onChange, onError) {
  let unsubscribe = null;
  let stopped = false;
  voterKey().then((mine) => {
    if (stopped) return;
    unsubscribe = onValue(
      ref(db, 'newsReactions'),
      (snap) => {
        const all = snap.val() || {};
        const result = {};
        Object.keys(all).forEach((post) => {
          const votes = all[post];
          result[post] = {
            likes: Object.values(votes).filter((v) => v === 'like').length,
            dislikes: Object.values(votes).filter((v) => v === 'dislike').length,
            mine: votes[mine] || null
          };
        });
        onChange(result);
      },
      (err) => { if (onError) onError(err); }
    );
  }).catch((err) => { if (onError) onError(err); });
  return () => { stopped = true; if (unsubscribe) unsubscribe(); };
}

// Поставить реакцию. Повторное нажатие на ту же снимает её; value: 'like' | 'dislike'.
export async function setReaction(postId, value, current) {
  await requireStarted();
  const key = await voterKey();
  const target = ref(db, `newsReactions/${postId}/${key}`);
  if (current === value) await remove(target);
  else await set(target, value);
}

// Комментарий (или ответ, если указан parent — id главного комментария).
export async function addComment(postId, text, name, parentId, replyTo) {
  await requireStarted();
  const clean = String(text || '').trim();
  if (!clean) throw new Error('empty-comment');
  const key = push(ref(db, `newsComments/${postId}`)).key;
  const comment = {
    text: clean.slice(0, 1000),
    name: String(name || '').trim().slice(0, 40) || 'User',
    role: support ? 'admin' : 'user',
    createdAt: serverTimestamp()
  };
  if (parentId) {
    comment.parent = parentId;
    if (replyTo) comment.replyTo = String(replyTo).trim().slice(0, 40);
  }
  await set(ref(db, `newsComments/${postId}/${key}`), comment);
}

// Только администраторы: убрать комментарий (и ответы на него, если переданы их id).
export async function deleteComment(postId, commentIds) {
  await requireStarted();
  if (!support) throw new Error('not-admin');
  const updates = {};
  [].concat(commentIds).forEach((id) => { updates[`newsComments/${postId}/${id}`] = null; });
  await update(ref(db), updates);
}

function cleanNews(title, text) {
  const t = String(title || '').trim();
  const body = String(text || '').trim();
  if (!t || !body) throw new Error('empty-post');
  if (t.length > 120 || body.length > 10000) throw new Error('post-too-long');
  return { title: t, text: body };
}

export async function createNews(title, text, author) {
  await requireStarted();
  if (!support) throw new Error('not-admin');
  const key = push(ref(db, 'news')).key;
  await set(ref(db, `news/${key}`), {
    ...cleanNews(title, text),
    author: String(author || '').trim().slice(0, 40) || 'Admin',
    createdAt: serverTimestamp()
  });
  return key;
}

export async function editNews(id, title, text) {
  await requireStarted();
  if (!support) throw new Error('not-admin');
  await update(ref(db, `news/${id}`), { ...cleanNews(title, text), updatedAt: serverTimestamp() });
}

// Удаляет новость вместе с её комментариями и реакциями.
export async function deleteNews(id) {
  await requireStarted();
  if (!support) throw new Error('not-admin');
  await update(ref(db), {
    [`news/${id}`]: null,
    [`newsComments/${id}`]: null,
    [`newsReactions/${id}`]: null
  });
}
