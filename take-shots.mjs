// Vaultbreak screenshot run: drives the game in headless Chrome, waits for
// window.__shotReady, then captures a JPEG screenshot per shot in shots.json.
// Usage: node take-shots.mjs [port]  (serve.ts must already be running on it)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const WebSocket = require('/home/hatch/workspace/makefun/node_modules/ws');

const CHROME = '/home/hatch/.cache/puppeteer/chrome/linux-148.0.7778.97/chrome-linux64/chrome';
const PORT = 9226;
const SERVE_PORT = Number(process.argv[2] || 8322);
const OUT = '/home/hatch/workspace/makefun/entries/best-heist-game-20261122-0559/screenshots';
const shots = JSON.parse(readFileSync('/home/hatch/workspace/makefun/entries/best-heist-game-20261122-0559/shots.json', 'utf8'));
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const proc = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox',
  `--remote-debugging-port=${PORT}`, '--window-size=1280,720',
  '--hide-scrollbars', 'about:blank',
], { stdio: 'ignore' });

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);
}

try {
  let targets;
  for (let i = 0; i < 40; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); break; }
    catch { await sleep(250); }
  }
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((res) => ws.on('open', res));
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    else if (msg.method === 'Runtime.exceptionThrown') errors.push(JSON.stringify(msg.params.exceptionDetails).slice(0, 500));
    else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(JSON.stringify(msg.params.args).slice(0, 500));
  });
  const send = (method, params = {}) => new Promise((res) => {
    const mid = ++id; pending.set(mid, res);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  await send('Runtime.enable');
  await send('Page.enable');
  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    if (r.result?.exceptionDetails) return { error: JSON.stringify(r.result.exceptionDetails).slice(0, 800) };
    return r.result?.result?.value;
  };

  for (const shot of shots) {
    errors.length = 0;
    const url = `http://127.0.0.1:${SERVE_PORT}/index.html${shot.query}`;
    await send('Page.navigate', { url });
    let ready = false;
    for (let i = 0; i < 60; i++) {
      await sleep(250);
      const v = await evalJs('window.__shotReady === true');
      if (v === true) { ready = true; break; }
      const err = await evalJs('window.__shotError || null');
      if (err) break;
    }
    check(`shot ${shot.name} ready`, ready, ready ? '' : `errors: ${errors.join(' | ').slice(0, 400)}`);
    if (!ready) continue;
    await sleep(300);
    const shot2 = await send('Page.captureScreenshot', { format: 'jpeg', quality: 82 });
    const b64 = shot2.result?.data;
    if (!b64) { check(`shot ${shot.name} capture`, false, JSON.stringify(shot2).slice(0, 300)); continue; }
    const buf = Buffer.from(b64, 'base64');
    writeFileSync(`${OUT}/${shot.name}`, buf);
    check(`shot ${shot.name} saved`, true, `${buf.length} bytes`);
    if (errors.length) console.log(`  console errors: ${errors.join(' | ').slice(0, 400)}`);
  }
  ws.close();
} finally {
  proc.kill();
}
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `${failed} FAILURES` : 'ALL SHOTS OK');
process.exit(failed ? 1 : 0);
