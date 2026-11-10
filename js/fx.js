/*
 * Анимации при нажатии на кнопки и карточки.
 * На каждый клик выбирается случайный эффект из списка EFFECTS ниже. Эффекты берутся «колодой»:
 * пока не показаны все, ни один не повторяется, поэтому разнообразие гарантировано.
 *
 * ЧТО МОЖНО МЕНЯТЬ
 *  - Убрать эффект: удалите его строку из EFFECTS.
 *  - Добавить свой: напишите функцию (ниже есть примеры) и добавьте её в EFFECTS.
 *  - Отключить эффекты у конкретной кнопки: добавьте ей атрибут data-fx="none".
 *  - Всегда один и тот же эффект у кнопки: data-fx="confetti" (или другое имя из списка).
 *  - Если у человека в системе включено «уменьшить движение», эффекты не запускаются вообще.
 */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var COLORS = ['#ff7f26', '#00aeff', '#ffffff', '#ffd23f', '#7ee08a'];   // цвета логотипа и немного праздника
  var SELECTOR = 'button, .btn, .tile, .game-card, .member, .chat-item, [data-fx]';

  function rand(min, max) { return min + Math.random() * (max - min); }
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  // Частица: маленький элемент в слое поверх страницы, который анимируется и исчезает.
  function particle(ctx, css, keyframes, options) {
    var el = document.createElement('span');
    el.className = 'fx-p';
    el.style.left = ctx.x + 'px';
    el.style.top = ctx.y + 'px';
    Object.keys(css).forEach(function (k) { el.style[k] = css[k]; });
    ctx.layer.append(el);
    el.animate(keyframes, Object.assign({ fill: 'forwards' }, options));
    ctx.lifetime = Math.max(ctx.lifetime, (options.duration || 0) + (options.delay || 0));
    return el;
  }

  // ---------- эффекты ----------

  // Конфетти: цветные кусочки разлетаются и падают.
  function confetti(ctx) {
    for (var i = 0; i < 20; i++) {
      var angle = rand(-Math.PI, 0);                       // веером вверх
      var power = rand(50, 130);
      var dx = Math.cos(angle) * power, dy = Math.sin(angle) * power;
      particle(ctx, { width: rand(5, 8) + 'px', height: rand(8, 12) + 'px', background: pick(COLORS), borderRadius: '2px', marginLeft: '-3px' },
        [{ transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
         { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(' + rand(120, 420) + 'deg)', opacity: 1, offset: 0.55 },
         { transform: 'translate(' + (dx * 1.15) + 'px,' + (dy + 110) + 'px) rotate(' + rand(300, 720) + 'deg)', opacity: 0 }],
        { duration: rand(750, 1100), easing: 'cubic-bezier(.2,.7,.4,1)' });
    }
  }

  // Искры: звёздочки разлетаются во все стороны.
  function sparkles(ctx) {
    var n = 9;
    for (var i = 0; i < n; i++) {
      var angle = (Math.PI * 2 * i) / n + rand(-0.2, 0.2);
      var dist = rand(36, 70);
      var el = particle(ctx, { fontSize: rand(12, 22) + 'px', color: pick(COLORS), marginLeft: '-8px', marginTop: '-10px', lineHeight: '1' },
        [{ transform: 'translate(0,0) scale(.2) rotate(0deg)', opacity: 1 },
         { transform: 'translate(' + Math.cos(angle) * dist * 0.7 + 'px,' + Math.sin(angle) * dist * 0.7 + 'px) scale(1.2) rotate(90deg)', opacity: 1, offset: 0.5 },
         { transform: 'translate(' + Math.cos(angle) * dist + 'px,' + Math.sin(angle) * dist + 'px) scale(.2) rotate(200deg)', opacity: 0 }],
        { duration: rand(550, 800), easing: 'ease-out' });
      el.textContent = '✦';
    }
  }

  // Круги: расходятся волнами от места нажатия.
  function rings(ctx) {
    for (var i = 0; i < 3; i++) {
      particle(ctx, { width: '40px', height: '40px', marginLeft: '-20px', marginTop: '-20px', borderRadius: '50%', border: '3px solid ' + COLORS[i % 2] },
        [{ transform: 'scale(.15)', opacity: 0.9 }, { transform: 'scale(3.4)', opacity: 0 }],
        { duration: 750, delay: i * 130, easing: 'cubic-bezier(.2,.6,.3,1)' });
    }
  }

  // Яблоки: фирменный эффект студии «Яблоня», яблочки взлетают и тают.
  function apples(ctx) {
    var fruit = ['🍎', '🍏', '🍎', '🍎'];
    for (var i = 0; i < 6; i++) {
      var dx = rand(-70, 70), dy = rand(-150, -80);
      var el = particle(ctx, { fontSize: rand(18, 28) + 'px', marginLeft: '-12px', marginTop: '-14px', lineHeight: '1' },
        [{ transform: 'translate(0,0) scale(.4) rotate(0deg)', opacity: 0 },
         { transform: 'translate(' + dx * 0.3 + 'px,' + dy * 0.4 + 'px) scale(1) rotate(' + rand(-30, 30) + 'deg)', opacity: 1, offset: 0.25 },
         { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.8) rotate(' + rand(-80, 80) + 'deg)', opacity: 0 }],
        { duration: rand(800, 1150), delay: i * 40, easing: 'cubic-bezier(.2,.7,.3,1)' });
      el.textContent = pick(fruit);
    }
  }

  // Лучи: короткие штрихи разлетаются, как салют.
  function streaks(ctx) {
    var n = 14;
    for (var i = 0; i < n; i++) {
      var angle = (360 / n) * i;
      particle(ctx, { width: '14px', height: '3px', marginLeft: '-7px', marginTop: '-1px', borderRadius: '2px', background: pick(COLORS), transformOrigin: '50% 50%' },
        [{ transform: 'rotate(' + angle + 'deg) translateX(8px) scaleX(.3)', opacity: 1 },
         { transform: 'rotate(' + angle + 'deg) translateX(46px) scaleX(1.4)', opacity: 1, offset: 0.5 },
         { transform: 'rotate(' + angle + 'deg) translateX(74px) scaleX(.2)', opacity: 0 }],
        { duration: 620, easing: 'ease-out' });
    }
  }

  // Пузыри: прозрачные шарики всплывают вверх, чуть покачиваясь.
  function bubbles(ctx) {
    for (var i = 0; i < 9; i++) {
      var size = rand(8, 20), sway = rand(-18, 18);
      particle(ctx, { width: size + 'px', height: size + 'px', marginLeft: rand(-24, 24) - size / 2 + 'px', borderRadius: '50%', border: '2px solid ' + pick(['#00aeff', '#ffffff', '#7fd6ff']), background: 'rgba(255,255,255,.12)' },
        [{ transform: 'translate(0,0) scale(.5)', opacity: 0 },
         { transform: 'translate(' + sway + 'px,-40px) scale(1)', opacity: 1, offset: 0.25 },
         { transform: 'translate(' + (-sway) + 'px,' + rand(-120, -80) + 'px) scale(1.15)', opacity: 0 }],
        { duration: rand(800, 1250), delay: i * 50, easing: 'ease-out' });
    }
  }

  // Волна: цветное пятно растекается от места нажатия.
  function ripple(ctx) {
    particle(ctx, { width: '90px', height: '90px', marginLeft: '-45px', marginTop: '-45px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,127,38,.55), rgba(0,174,255,.25) 60%, rgba(0,174,255,0) 72%)' },
      [{ transform: 'scale(.1)', opacity: 1 }, { transform: 'scale(2.8)', opacity: 0 }],
      { duration: 700, easing: 'cubic-bezier(.2,.6,.3,1)' });
  }

  // Эффекты, которые двигают саму кнопку.
  function jelly(ctx) {
    ctx.el.animate([
      { transform: 'scale(1,1)' }, { transform: 'scale(1.18,.82)' }, { transform: 'scale(.9,1.14)' },
      { transform: 'scale(1.07,.95)' }, { transform: 'scale(1,1)' }
    ], { duration: 560, easing: 'ease-out' });
  }

  function wobble(ctx) {
    ctx.el.animate([
      { transform: 'rotate(0deg)' }, { transform: 'rotate(-7deg)' }, { transform: 'rotate(6deg)' },
      { transform: 'rotate(-4deg)' }, { transform: 'rotate(2deg)' }, { transform: 'rotate(0deg)' }
    ], { duration: 520, easing: 'ease-in-out' });
  }

  function glow(ctx) {
    var color = pick(['rgba(255,127,38,.8)', 'rgba(0,174,255,.8)']);
    ctx.el.animate([
      { boxShadow: '0 0 0 0 ' + color }, { boxShadow: '0 0 0 16px rgba(255,255,255,0)' }
    ], { duration: 650, easing: 'ease-out' });
  }

  // Список эффектов. Название можно писать в data-fx="..." у кнопки.
  var EFFECTS = [
    { name: 'confetti', run: confetti },
    { name: 'sparkles', run: sparkles },
    { name: 'rings', run: rings },
    { name: 'apples', run: apples },
    { name: 'streaks', run: streaks },
    { name: 'bubbles', run: bubbles },
    { name: 'ripple', run: ripple },
    { name: 'jelly', run: jelly },
    { name: 'wobble', run: wobble },
    { name: 'glow', run: glow }
  ];

  // «Колода»: перемешиваем, достаём по одному; закончилась — перемешиваем заново (без повтора подряд).
  var deck = [];
  var last = null;
  function next() {
    if (!deck.length) {
      deck = EFFECTS.slice();
      for (var i = deck.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = deck[i]; deck[i] = deck[j]; deck[j] = t;
      }
      if (deck.length > 1 && deck[deck.length - 1] === last) deck.unshift(deck.pop());
    }
    last = deck.pop();
    return last;
  }

  function play(effect, el, x, y) {
    // Внутри открытого окна частицы кладём в само окно, иначе оно закроет их собой.
    var host = (el && el.closest && el.closest('dialog[open]')) || document.body;
    var layer = document.createElement('div');
    layer.className = 'fx-layer';
    layer.setAttribute('aria-hidden', 'true');
    host.append(layer);
    if (window.Yablonya && window.Yablonya.fx) window.Yablonya.fx.last = effect.name;
    var ctx = { el: el, x: x, y: y, layer: layer, lifetime: 600 };
    try { effect.run(ctx); } catch (e) { console.warn('Эффект не сработал:', effect.name, e); }
    setTimeout(function () { layer.remove(); }, ctx.lifetime + 150);
  }

  document.addEventListener('click', function (e) {
    if (reduceMotion && reduceMotion.matches) return;
    var el = e.target.closest ? e.target.closest(SELECTOR) : null;
    if (!el) return;
    if (el.matches('[data-fx="none"], :disabled, [aria-disabled="true"]')) return;

    var x = e.clientX, y = e.clientY;
    if (!x && !y) {                                   // нажатие с клавиатуры: берём центр кнопки
      var r = el.getBoundingClientRect();
      x = r.left + r.width / 2;
      y = r.top + r.height / 2;
    }

    var forced = el.getAttribute('data-fx');
    var effect = EFFECTS.filter(function (f) { return f.name === forced; })[0] || next();
    play(effect, el, x, y);
  }, true);   // перехватываем в начале: кнопка может перерисоваться или уйти со страницы после нажатия

  // Для проверки и ручного запуска из консоли: Yablonya.fx.play('confetti')
  window.Yablonya = window.Yablonya || {};
  window.Yablonya.fx = {
    names: EFFECTS.map(function (f) { return f.name; }),
    play: function (name, el) {
      var effect = EFFECTS.filter(function (f) { return f.name === name; })[0];
      if (!effect) return false;
      el = el || document.body;
      var r = el.getBoundingClientRect();
      play(effect, el, r.left + r.width / 2, r.top + r.height / 2);
      return true;
    }
  };
})();
