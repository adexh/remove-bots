/*
 * Loads a fake-Meet harness page in headless Chrome and reports what it
 * asserted. Uses the DevTools protocol over Node's built-in WebSocket, so there
 * is nothing extra to install.
 *
 *   node test/run-dom.mjs                            main scenario
 *   node test/run-dom.mjs --page=fake-meet-bare.html placement with no anchors
 *   node test/run-dom.mjs --show                     visible browser
 *
 * The page is served over HTTP rather than opened as a file: the harness imports
 * the real lib/ modules, and ES module imports are blocked on file:// URLs.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, dirname, resolve, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const pageArg = process.argv.find((arg) => arg.startsWith('--page='));
const PAGE_FILE = pageArg ? pageArg.slice('--page='.length) : 'fake-meet.html';
const SHOW = process.argv.includes('--show');

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
};

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

/** Static server rooted at the repo, so /test and /lib both resolve. */
function serve() {
  return new Promise((ok) => {
    const server = createServer(async (req, res) => {
      const { pathname } = new URL(req.url, 'http://localhost');
      const rel = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
      try {
        const body = await readFile(join(ROOT, rel));
        res.writeHead(200, { 'Content-Type': MIME[extname(rel)] || 'application/octet-stream' });
        res.end(body);
      } catch {
        res.writeHead(404).end('not found');
      }
    });
    server.listen(0, '127.0.0.1', () => ok(server));
  });
}

async function main() {
  const chromePath = await findChrome();
  const server = await serve();
  const url = `http://127.0.0.1:${server.address().port}/test/${PAGE_FILE}`;
  const profile = await mkdtemp(join(tmpdir(), 'rb-harness-'));

  const port = 9200 + Math.floor(process.pid % 300);
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
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
    server.close();
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
        const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
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
    const frame = await send('Runtime.evaluate', {
      expression: `
        new Promise((done) => {
          const started = Date.now();
          (function poll() {
            const flag = document.body.getAttribute('data-harness');
            if (flag) return done({ flag, out: document.getElementById('out').textContent });
            if (Date.now() - started > 90000) {
              return done({ flag: 'timeout', out: document.getElementById('out').textContent });
            }
            setTimeout(poll, 200);
          })();
        })
      `,
      awaitPromise: true,
      returnByValue: true,
    });

    const report = frame.result?.result?.value;
    if (!report) throw new Error('harness never reported: ' + JSON.stringify(frame.result));

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
