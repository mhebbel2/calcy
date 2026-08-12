/*
 * calcy — expression parser & evaluator.
 * Tokenizer + shunting-yard. No eval(). Works with the pretty
 * glyphs used in the UI (× ÷ − √ π).
 */
(function (root) {
  'use strict';

  var FUNCTIONS = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'ln', 'log', '√'];

  function normalize(expr) {
    return String(expr)
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-')   // U+2212 minus
      .replace(/–/g, '-')   // en dash, just in case
      .replace(/\s+/g, '');
  }

  function tokenize(input) {
    var s = normalize(input);
    var tokens = [];
    var i = 0;

    function prevSignificant() {
      return tokens.length ? tokens[tokens.length - 1] : null;
    }

    while (i < s.length) {
      var ch = s[i];

      // numbers
      if (/[0-9.]/.test(ch)) {
        var num = '';
        var dots = 0;
        while (i < s.length && /[0-9.]/.test(s[i])) {
          if (s[i] === '.') {
            dots++;
            if (dots > 1) throw new Error('Bad number');
          }
          num += s[i];
          i++;
        }
        if (num === '.') throw new Error('Bad number');
        tokens.push({ t: 'num', v: parseFloat(num) });
        continue;
      }

      // constants
      if (ch === 'π') { tokens.push({ t: 'num', v: Math.PI }); i++; continue; }
      if (ch === 'e') { tokens.push({ t: 'num', v: Math.E }); i++; continue; }

      // named functions
      var matchedFn = null;
      for (var f = 0; f < FUNCTIONS.length; f++) {
        var name = FUNCTIONS[f];
        if (name !== '√' && s.substr(i, name.length) === name) { matchedFn = name; break; }
      }
      if (matchedFn) { tokens.push({ t: 'fn', v: matchedFn }); i += matchedFn.length; continue; }

      if (ch === '√') { tokens.push({ t: 'fn', v: '√' }); i++; continue; }

      // operators — detect unary minus
      if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^') {
        var prev = prevSignificant();
        var unary = (ch === '-' || ch === '+') &&
          (!prev || prev.t === 'op' || prev.t === 'lparen' || prev.t === 'fn');
        if (unary) {
          if (ch === '-') tokens.push({ t: 'uop', v: 'neg' });
          // unary '+' is a no-op, skip it
        } else {
          tokens.push({ t: 'op', v: ch });
        }
        i++;
        continue;
      }

      if (ch === '(') { tokens.push({ t: 'lparen' }); i++; continue; }
      if (ch === ')') { tokens.push({ t: 'rparen' }); i++; continue; }

      // postfix operators
      if (ch === '%') { tokens.push({ t: 'post', v: '%' }); i++; continue; }
      if (ch === '!') { tokens.push({ t: 'post', v: '!' }); i++; continue; }

      throw new Error('Unexpected character: ' + ch);
    }

    return insertImplicitMultiplication(tokens);
  }

  // 2π, 3(4), )(  →  insert *
  function insertImplicitMultiplication(tokens) {
    var out = [];
    for (var i = 0; i < tokens.length; i++) {
      var cur = tokens[i];
      var prev = out.length ? out[out.length - 1] : null;
      if (prev) {
        var prevIsValue = prev.t === 'num' || prev.t === 'rparen' || prev.t === 'post';
        var curStartsValue = cur.t === 'num' || cur.t === 'lparen' || cur.t === 'fn';
        if (prevIsValue && curStartsValue) out.push({ t: 'op', v: '*' });
      }
      out.push(cur);
    }
    return out;
  }

  var PRECEDENCE = { '+': 2, '-': 2, '*': 3, '/': 3, '^': 4, 'neg': 5, '%': 6, '!': 6 };

  function toRPN(tokens) {
    var output = [];
    var stack = [];

    for (var i = 0; i < tokens.length; i++) {
      var tok = tokens[i];

      if (tok.t === 'num') { output.push(tok); continue; }

      if (tok.t === 'fn') { stack.push(tok); continue; }

      if (tok.t === 'post') {
        // postfix: operand already emitted
        output.push(tok);
        continue;
      }

      if (tok.t === 'op' || tok.t === 'uop') {
        var p1 = PRECEDENCE[tok.v];
        var rightAssoc = (tok.t === 'uop' || tok.v === '^');
        while (stack.length) {
          var top = stack[stack.length - 1];
          if (top.t !== 'op' && top.t !== 'uop') break;
          var p2 = PRECEDENCE[top.v];
          if (p2 > p1 || (!rightAssoc && p2 === p1)) {
            output.push(stack.pop());
          } else break;
        }
        stack.push(tok);
        continue;
      }

      if (tok.t === 'lparen') { stack.push(tok); continue; }

      if (tok.t === 'rparen') {
        var found = false;
        while (stack.length) {
          var t2 = stack.pop();
          if (t2.t === 'lparen') { found = true; break; }
          output.push(t2);
        }
        if (!found) throw new Error('Mismatched parentheses');
        if (stack.length && stack[stack.length - 1].t === 'fn') {
          output.push(stack.pop());
        }
        continue;
      }
    }

    while (stack.length) {
      var t3 = stack.pop();
      if (t3.t === 'lparen' || t3.t === 'rparen') throw new Error('Mismatched parentheses');
      output.push(t3);
    }

    return output;
  }

  function factorial(n) {
    if (n < 0 || Math.floor(n) !== n) throw new Error('Factorial needs a whole number ≥ 0');
    if (n > 170) throw new Error('Overflow');
    var r = 1;
    for (var i = 2; i <= n; i++) r *= i;
    return r;
  }

  function applyFunction(name, x, deg) {
    var toRad = deg ? Math.PI / 180 : 1;
    switch (name) {
      case 'sin': return Math.sin(x * toRad);
      case 'cos': return Math.cos(x * toRad);
      case 'tan': {
        var v = Math.tan(x * toRad);
        if (Math.abs(v) > 1e15) throw new Error('Undefined');
        return v;
      }
      case 'asin': {
        if (x < -1 || x > 1) throw new Error('Out of range');
        var r = Math.asin(x);
        return deg ? r * 180 / Math.PI : r;
      }
      case 'acos': {
        if (x < -1 || x > 1) throw new Error('Out of range');
        var r2 = Math.acos(x);
        return deg ? r2 * 180 / Math.PI : r2;
      }
      case 'atan': {
        var r3 = Math.atan(x);
        return deg ? r3 * 180 / Math.PI : r3;
      }
      case 'ln':
        if (x <= 0) throw new Error('Out of range');
        return Math.log(x);
      case 'log':
        if (x <= 0) throw new Error('Out of range');
        return Math.log10(x);
      case '√':
        if (x < 0) throw new Error('Out of range');
        return Math.sqrt(x);
      default: throw new Error('Unknown function');
    }
  }

  function evalRPN(rpn, deg) {
    var stack = [];
    for (var i = 0; i < rpn.length; i++) {
      var tok = rpn[i];

      if (tok.t === 'num') { stack.push(tok.v); continue; }

      if (tok.t === 'uop') {
        if (!stack.length) throw new Error('Bad expression');
        stack.push(-stack.pop());
        continue;
      }

      if (tok.t === 'post') {
        if (!stack.length) throw new Error('Bad expression');
        var a = stack.pop();
        stack.push(tok.v === '%' ? a / 100 : factorial(a));
        continue;
      }

      if (tok.t === 'fn') {
        if (!stack.length) throw new Error('Bad expression');
        stack.push(applyFunction(tok.v, stack.pop(), deg));
        continue;
      }

      if (tok.t === 'op') {
        if (stack.length < 2) throw new Error('Bad expression');
        var b = stack.pop();
        var c = stack.pop();
        var r;
        switch (tok.v) {
          case '+': r = c + b; break;
          case '-': r = c - b; break;
          case '*': r = c * b; break;
          case '/':
            if (b === 0) throw new Error('Division by zero');
            r = c / b; break;
          case '^': r = Math.pow(c, b); break;
          default: throw new Error('Unknown operator');
        }
        stack.push(r);
        continue;
      }
    }
    if (stack.length !== 1) throw new Error('Bad expression');
    var result = stack[0];
    if (typeof result !== 'number' || Number.isNaN(result) || !Number.isFinite(result)) {
      throw new Error('Overflow');
    }
    return result;
  }

  // Tidy floating point noise: 0.1+0.2 → 0.3
  function tidy(x) {
    if (x === 0) return 0;
    var rounded = parseFloat(x.toPrecision(12));
    return rounded;
  }

  function evaluate(expr, deg) {
    var value = evalRPN(toRPN(tokenize(expr)), !!deg);
    return tidy(value);
  }

  // Human-friendly number for the readout
  function formatNumber(x) {
    if (Number.isNaN(x) || !Number.isFinite(x)) return 'Error';
    var v = tidy(x);
    var abs = Math.abs(v);
    if (v !== 0 && (abs >= 1e12 || abs < 1e-9)) {
      var s = v.toExponential(6);
      s = s.replace(/\.?0+e/, 'e');
      return s;
    }
    var str = String(v);
    // group integer part with thin spaces for readability
    var parts = str.split('.');
    var intPart = parts[0];
    var neg = intPart[0] === '-';
    var digits = neg ? intPart.slice(1) : intPart;
    var grouped = '';
    for (var i = 0; i < digits.length; i++) {
      grouped += digits[i];
      var remaining = digits.length - i - 1;
      if (remaining > 0 && remaining % 3 === 0) grouped += ' ';
    }
    return (neg ? '-' : '') + grouped + (parts.length > 1 ? '.' + parts[1] : '');
  }

  var api = { evaluate: evaluate, formatNumber: formatNumber };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Calcy = api;
})(typeof window !== 'undefined' ? window : globalThis);
