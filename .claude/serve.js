// Маленький сервер для просмотра сайта на своём компьютере: node .claude/serve.js [порт]
// Нужен, потому что аккаунты и поддержка (Firebase) не работают, если открыть index.html двойным щелчком.
// Папка .claude не публикуется на GitHub Pages (точка в начале имени), так что файл сайту не мешает.
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || process.argv[2] || 8080);
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon'
};

http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(root, path.normalize(rel));
  // отдаём только файлы сайта: ничего за пределами папки и ничего из служебных папок
  if (!file.startsWith(root) || /[\\/]\.(git|claude)([\\/]|$)/.test(file)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(port, '127.0.0.1', () => console.log('Сайт: http://localhost:' + port));
