/* calcy — UI controller. Touch-first; no device keyboard required. */
(function () {
  'use strict';

  var display = document.getElementById('display');
  var preview = document.getElementById('preview');
  var sciPanel = document.getElementById('sciPanel');
  var angleBadge = document.getElementById('angleBadge');
  var angleToggle = document.getElementById('angleToggle');
  var modeSwitch = document.querySelector('.mode-switch');
  var modeStd = document.getElementById('modeStd');
  var modeSci = document.getElementById('modeSci');

  var expr = '';            // expression as typed, with pretty glyphs
  var justEvaluated = false;
  var hasError = false;
  var sciMode = false;
  var useDegrees = true;    // default like most pocket calculators

  var BINARY_OPS = ['+', '−', '×', '÷', '^'];

  function lastChar() { return expr.slice(-1); }
  function endsWithNumber() { return /[0-9.)πe%!]$/.test(expr); }
  function endsWithBinaryOp() { return BINARY_OPS.indexOf(lastChar()) !== -1; }

  function buzz() {
    if (navigator.vibrate) navigator.vibrate(8);
  }

  /* ---------- rendering ---------- */

  function fitText(el, basePx, minPx) {
    el.style.fontSize = basePx + 'px';
    var size = basePx;
    while (el.scrollWidth > el.clientWidth && size > minPx) {
      size -= 4;
      el.style.fontSize = size + 'px';
    }
  }

  function fitDisplay(minPx) {
    fitText(display, sciMode ? 40 : 56, minPx);
  }

  function render() {
    display.classList.toggle('is-error', hasError);
    if (hasError) {
      display.textContent = 'Error';
      fitDisplay(24);
      return;
    }
    display.textContent = expr === '' ? '0' : expr;
    fitDisplay(20);

    // live preview
    var text = '';
    if (expr !== '' && !justEvaluated) {
      try {
        var value = Calcy.evaluate(expr, useDegrees);
        var formatted = Calcy.formatNumber(value);
        if (formatted !== expr) text = '= ' + formatted;
      } catch (e) { /* incomplete expression: no preview */ }
    }
    preview.textContent = text;
  }

  /* ---------- editing ---------- */

  function clearAll() {
    expr = '';
    hasError = false;
    justEvaluated = false;
  }

  function hardResetIfNeeded(isValueInput) {
    if (hasError) clearAll();
    else if (justEvaluated && isValueInput) { expr = ''; justEvaluated = false; }
    else justEvaluated = false;
  }

  function insert(token) {
    var isValue = /^[0-9.πe(]$/.test(token) || token === '√(' ||
      /^(sin|cos|tan|asin|acos|atan|ln|log)\($/.test(token);
    hardResetIfNeeded(isValue);

    if (token === '.') {
      // one dot per number
      var m = expr.match(/[0-9.]*$/);
      if (m && m[0].indexOf('.') !== -1) return;
      if (!/[0-9]$/.test(expr)) expr += '0';
    } else if (BINARY_OPS.indexOf(token) !== -1) {
      if (expr === '') {
        if (token === '−') expr = '−';   // allow leading negative
        return render();
      }
      if (endsWithBinaryOp()) {
        // replace trailing operator; allow "op −" for negatives
        if (token === '−' && lastChar() !== '−') {
          expr += token;
          return render();
        }
        expr = expr.replace(/[+\−×÷^][−]?$/, '');
        expr += token;
        return render();
      }
      if (lastChar() === '(' || lastChar() === '.') return;
    } else if (token === ')') {
      var open = (expr.match(/\(/g) || []).length;
      var close = (expr.match(/\)/g) || []).length;
      if (close >= open || !endsWithNumber()) return;
    } else if (token === '%' || token === '!') {
      if (!/[0-9)πe]$/.test(expr)) return;
    }

    expr += token;
    render();
  }

  function backspace() {
    if (hasError) { clearAll(); render(); return; }
    justEvaluated = false;
    // remove whole "fn(" in one tap
    var fnMatch = expr.match(/(sin|cos|tan|asin|acos|atan|ln|log|√)\($/);
    if (fnMatch) expr = expr.slice(0, -fnMatch[0].length);
    else expr = expr.slice(0, -1);
    render();
  }

  function negate() {
    hardResetIfNeeded(false);
    if (expr === '' || endsWithBinaryOp() || lastChar() === '(') {
      expr += '−';
      return render();
    }
    var m = expr.match(/(\d*\.?\d+)$/);
    if (!m) return;
    var num = m[1];
    var before = expr.slice(0, expr.length - num.length);
    // if preceded by a unary minus, remove it
    if (before.slice(-1) === '−' &&
        (before.length === 1 || BINARY_OPS.indexOf(before.slice(-2, -1)) !== -1 || before.slice(-2, -1) === '(')) {
      expr = before.slice(0, -1) + num;
    } else {
      expr = before + '(−' + num + ')';
    }
    render();
  }

  function square() {
    hardResetIfNeeded(false);
    if (!endsWithNumber()) return;
    expr += '^2';
    render();
  }

  function recip() {
    hardResetIfNeeded(false);
    if (expr !== '' && endsWithNumber()) expr = '1÷(' + expr + ')';
    else expr += '1÷(';
    render();
  }

  function equals() {
    if (expr === '' || hasError) return;
    try {
      var value = Calcy.evaluate(expr, useDegrees);
      preview.textContent = expr + ' =';
      expr = String(Calcy.evaluate(expr, useDegrees)); // raw, unformatted for continued calc
      justEvaluated = true;
      display.textContent = Calcy.formatNumber(value);
      fitDisplay(20);
      display.classList.remove('is-error');
      return;
    } catch (e) {
      hasError = true;
      justEvaluated = false;
      render();
    }
  }

  function toggleAngle() {
    useDegrees = !useDegrees;
    angleBadge.hidden = !sciMode;
    angleBadge.textContent = useDegrees ? 'DEG' : 'RAD';
    angleToggle.textContent = useDegrees ? 'DEG' : 'RAD';
    angleToggle.classList.toggle('is-rad', !useDegrees);
    if (justEvaluated) { // recompute preview context cleanly
      justEvaluated = false;
    }
    render();
  }

  /* ---------- mode switch ---------- */

  function setMode(sci) {
    sciMode = sci;
    sciPanel.hidden = !sci;
    document.querySelector('.app').classList.toggle('sci', sci);
    modeSwitch.dataset.mode = sci ? 'sci' : 'std';
    modeStd.classList.toggle('is-active', !sci);
    modeSci.classList.toggle('is-active', sci);
    modeStd.setAttribute('aria-selected', String(!sci));
    modeSci.setAttribute('aria-selected', String(sci));
    angleBadge.hidden = !sci;
    angleBadge.textContent = useDegrees ? 'DEG' : 'RAD';
    angleToggle.textContent = useDegrees ? 'DEG' : 'RAD';
    angleToggle.classList.toggle('is-rad', !useDegrees);
    try { localStorage.setItem('calcy-mode', sci ? 'sci' : 'std'); } catch (e) {}
    render(); // re-fit the readout at its new (smaller) size
  }

  modeStd.addEventListener('click', function () { buzz(); setMode(false); });
  modeSci.addEventListener('click', function () { buzz(); setMode(true); });

  /* ---------- key wiring ---------- */

  function handleAction(action) {
    switch (action) {
      case 'clear': clearAll(); render(); break;
      case 'backspace': backspace(); break;
      case 'negate': negate(); break;
      case 'equals': equals(); break;
      case 'square': square(); break;
      case 'recip': recip(); break;
      case 'angle': toggleAngle(); break;
    }
  }

  document.querySelectorAll('.key').forEach(function (key) {
    key.addEventListener('click', function () {
      buzz();
      var action = key.getAttribute('data-action');
      if (action) handleAction(action);
      else insert(key.getAttribute('data-insert'));
    });
  });

  /* ---------- physical keyboard (bonus; not required) ---------- */

  var keyMap = {
    '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
    '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
    '.': '.', '+': '+', '-': '−', '*': '×', '/': '÷',
    '^': '^', '(': '(', ')': ')', '%': '%', '!': '!'
  };

  window.addEventListener('keydown', function (ev) {
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (keyMap[ev.key]) { insert(keyMap[ev.key]); ev.preventDefault(); }
    else if (ev.key === 'Enter' || ev.key === '=') { equals(); ev.preventDefault(); }
    else if (ev.key === 'Backspace') { backspace(); ev.preventDefault(); }
    else if (ev.key === 'Escape') { clearAll(); render(); ev.preventDefault(); }
  });

  /* ---------- init ---------- */

  try {
    if (localStorage.getItem('calcy-mode') === 'sci') setMode(true);
    else setMode(false);
  } catch (e) { setMode(false); }
  render();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    });
  }
})();
