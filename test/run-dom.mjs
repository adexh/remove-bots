/*
 * Loads a fake-Meet harness page in headless Chrome and reports what it
 * asserted. Uses the DevTools protocol over Node's built-in WebSocket, so there
 * is nothing extra to install.
 *
 *   node test/run-dom.mjs                            main scenario
 *   node test/run-dom.mjs --page=fake-meet-bare.html placement with no anchors
 *   node test/run-dom.mjs --show                     visible browser
 *   node test/run-dom.mjs --screenshot=look.png      save what it looks like
 *
 * The page is served by Vite rather than opened as a file. Two reasons: ES module
 * imports are blocked on file:// URLs, and the harness imports the real UI, which
 * is JSX. Vite transforms it on the fly, so the tests run against the same source
 * the extension is built from, with no separate build step to fall out of date.
 */
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const pageArg = process.argv.find((arg) => arg.startsWith('--page='));
const PAGE_FILE = pageArg ? pageArg.slice('--page='.length) : 'fake-meet.html';
const SHOW = process.argv.includes('--show');
const shotArg = process.argv.find((arg) => arg.startsWith('--screenshot='));
const SHOT = shotArg ? shotArg.slice('--screenshot='.length) : null;

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

async function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  for (const path of CHROME_CANDIDATES) {
    try {
      await readFile(path);
      return path;
    } catch {
      /* not this one */
    }
  }
  throw new Error('Could not find Chrome. Set CHROME=/path/to/chrome and retry.');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Vite dev server rooted at the repo, so /test, /lib and JSX all resolve. */
async function serve() {
  const server = await createServer({
    root: ROOT,
    configFile: false,
    logLevel: 'error',
    /* Bind explicitly: Vite's default host is `localhost`, which can resolve
     * to ::1 only, and then Chrome's 127.0.0.1 request is refused. */
    server: { host: '127.0.0.1', port: 0, strictPort: false },
    /* Vite defaults .jsx to the automatic runtime; being explicit costs nothing
     * and keeps this working if that default ever changes. */
    esbuild: { jsx: 'automatic' },
  });
  await server.listen();
  return server;
}

async function main() {
  const chromePath = await findChrome();
  const server = await serve();
  const port = server.config.server.port || server.httpServer.address().port;
  const url = `http://127.0.0.1:${port}/test/${PAGE_FILE}`;
  const profile = await mkdtemp(join(tmpdir(), 'rb-harness-'));

  const debugPort = 9200 + Math.floor(process.pid % 300);
  const args = [
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    /* A realistic window: the default headless viewport is short enough that
     * the panel makes different layout choices than it would on a real screen. */
    '--window-size=1280,900',
    url,
  ];
  if (!SHOW) args.unshift('--headless=new', '--disable-gpu');

  const chrome = spawn(chromePath, args, { stdio: 'ignore' });
  let socket;

  const cleanup = async () => {
    try {
      socket?.close();
    } catch {
      /* already closed */
    }
    await server.close();
    chrome.kill('SIGKILL');
    /* Chrome keeps writing to its profile briefly after SIGKILL, so treat
     * cleanup as best effort: it must never decide the exit code. */
    try {
      await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {
      /* leftover temp dir, harmless */
    }
  };

  try {
    let target = null;
    for (let i = 0; i < 60 && !target; i++) {
      await sleep(250);
      try {
        const list = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
        target = list.find((t) => t.type === 'page' && t.url.startsWith('http://127.0.0.1'));
      } catch {
        /* not listening yet */
      }
    }
    if (!target) throw new Error('Chrome never exposed the page target');

    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((ok, fail) => {
      socket.addEventListener('open', ok, { once: true });
      socket.addEventListener('error', () => fail(new Error('CDP socket failed')), { once: true });
    });

    let nextId = 1;
    const pending = new Map();
    const pageErrors = [];

    socket.addEventListener('message', (event) => {
      const frame = JSON.parse(event.data);
      if (frame.id && pending.has(frame.id)) {
        pending.get(frame.id)(frame);
        pending.delete(frame.id);
        return;
      }
      if (frame.method === 'Runtime.exceptionThrown') {
        const detail = frame.params.exceptionDetails;
        pageErrors.push(detail.exception?.description || detail.text);
      }
      if (frame.method === 'Runtime.consoleAPICalled' && frame.params.type === 'error') {
        pageErrors.push(frame.params.args.map((a) => a.value ?? a.description).join(' '));
      }
    });

    const send = (method, params = {}) =>
      new Promise((ok) => {
        const id = nextId++;
        pending.set(id, ok);
        socket.send(JSON.stringify({ id, method, params }));
      });

    await send('Runtime.enable');

    /* The harness stamps data-harness on <body> when every assertion is in. */
    const evaluate = send('Runtime.evaluate', {
      expression: `
        new Promise((done) => {
          const started = Date.now();
          (function poll() {
            try {
              const out = document.getElementById('out');
              const flag = document.body.getAttribute('data-harness');
              if (flag && out) return done({ flag, out: out.textContent });
              if (Date.now() - started > 90000) {
                return done({
                  flag: 'timeout',
                  out: out ? out.textContent : 'no #out element; page is ' + location.href,
                });
              }
            } catch (err) {
              return done({ flag: 'error', out: 'poll threw: ' + err.message });
            }
            setTimeout(poll, 200);
          })();
        })
      `,
      awaitPromise: true,
      returnByValue: true,
    });

    /* Belt and braces: if the page never runs script at all, awaitPromise never
     * settles, so race it rather than hanging the test run. */
    const frame = await Promise.race([
      evaluate,
      sleep(120000).then(() => ({
        result: { result: { value: { flag: 'stalled', out: 'page never reported' } } },
      })),
    ]);

    const report = frame.result?.result?.value;
    if (!report) throw new Error('harness never reported: ' + JSON.stringify(frame.result));

    /* Capture the finished page, so a layout change can be looked at rather
     * than inferred from assertions about box geometry. */
    if (SHOT) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: 1280,
        height: 800,
        deviceScaleFactor: 2,
        mobile: false,
      });
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      const data = shot.result?.data;
      if (data) {
        await writeFile(SHOT, Buffer.from(data, 'base64'));
        console.log('screenshot: ' + SHOT);
      }
    }

    console.log(report.out.trim());
    if (pageErrors.length) {
      console.log('\npage errors:');
      pageErrors.forEach((line) => console.log('  ' + line));
    }

    await cleanup();
    process.exit(report.flag === 'pass' && !pageErrors.length ? 0 : 1);
  } catch (err) {
    console.error('harness runner failed:', err.message);
    await cleanup();
    process.exit(1);
  }
}

main();
