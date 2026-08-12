# Calcy

**[▶ Open the app](https://mhebbel2.github.io/calcy/)**

A touch-first pocket calculator PWA for phones. Standard and scientific modes, installable, works offline — no keyboard needed.

## Features

- **Standard mode** — digits, `+ − × ÷`, `%`, `±`, `AC`, `⌫`, `=`
- **Scientific mode** — `sin/cos/tan`, `ln/log`, `√`, `x²`, `xʸ`, `π`, `e`, parentheses, `1/x`, `n!`, DEG/RAD toggle
- Live result preview while you type
- Installable (add to home screen) and fully offline via service worker
- Expression parser written from scratch (shunting-yard) — no `eval()`

## Run locally

Any static file server works:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## License

[MIT](LICENSE)
