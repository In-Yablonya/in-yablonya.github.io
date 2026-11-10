/*
 * Описание Firebase-проекта студии. Это не секрет: значения видны в коде любого сайта,
 * а данные защищают правила доступа (файл database.rules.json в корне репозитория).
 *
 * Если в значениях стоит "..." — сайт работает, но поддержка и аккаунт отключены.
 * Где взять значения: консоль Firebase → шестерёнка → «Настройки проекта» → «Ваши приложения» →
 * веб-приложение (</>) → «Конфигурация SDK». Или командой:
 *   firebase apps:sdkconfig web <appId> --project rbg228
 */
const firebaseConfig = {
  apiKey: "AIzaSyChwMYnNYr4iXxDKIgIfJT-bZeXtncvnDU",
  authDomain: "rbg228.firebaseapp.com",
  databaseURL: "https://rbg228-default-rtdb.europe-west1.firebasedatabase.app/",
  projectId: "rbg228",
  storageBucket: "rbg228.firebasestorage.app",
  messagingSenderId: "280977934089",
  appId: "1:280977934089:web:8369331c18cacd02e3f5d8"
};

window.firebaseConfig = firebaseConfig;
