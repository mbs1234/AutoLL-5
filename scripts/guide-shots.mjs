// Retake the user guide's screenshots from the preview harness.
//
//   npm run harness                      # in another terminal
//   node scripts/guide-shots.mjs         # all of them
//   node scripts/guide-shots.mjs plans   # or only some
//
// Starts its own headless Chrome (CHROME to point elsewhere), drives the
// harness on :5174 over the DevTools protocol, one scenario per shot, and saves
// the phone frame alone to docs/user-guide/: a 390x844 frame scaled to 460 px
// wide, which is the size the guide's pictures have always been.
//
// Dev-only. Nothing here is served or bundled.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../docs/user-guide');
const ONLY = new Set(process.argv.slice(2));
const HARNESS = 'http://localhost:5174/';
const PORT = 9333;
const CHROME =
  process.env.CHROME ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
// A park morning, the same one for every shot: 10:15 AM Eastern on the day
// the guide's first pictures were taken, which is no trip's. The page's clock
// starts here on each load and runs on from it.
const FAKE_NOW = Date.parse('2026-09-17T10:15:00-04:00');
const WIDTH = 460;

try {
  await fetch(HARNESS);
} catch {
  console.error(`No harness at ${HARNESS}. Start it with: npm run harness`);
  process.exit(2);
}

mkdirSync(OUT, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), 'guide-shots-'));
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    'about:blank',
  ],
  { stdio: 'ignore' }
);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

let target;
for (let i = 0; i < 50 && !target; ++i) {
  try {
    target = await (
      await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, {
        method: 'PUT',
      })
    ).json();
  } catch {
    await sleep(200);
  }
}
if (!target) throw new Error('Chrome did not start');

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve =>
  ws.addEventListener('open', resolve, { once: true })
);

let nextId = 0;
const pending = new Map();
const listeners = new Set();
ws.addEventListener('message', event => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  } else if (msg.method) {
    for (const listener of listeners) listener(msg);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

async function evaluate(expression) {
  const r = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.exceptionDetails) {
    throw new Error(
      `${r.exceptionDetails.text} ${r.exceptionDetails.exception?.description ?? ''}`
    );
  }
  return r.result.value;
}

async function navigate(url) {
  const loaded = new Promise(resolve => {
    const listener = msg => {
      if (msg.method === 'Page.loadEventFired') {
        listeners.delete(listener);
        resolve();
      }
    };
    listeners.add(listener);
  });
  await send('Page.navigate', { url });
  await loaded;
}

// The harness draws the phone as the one div sized to the frame.
const FRAME = `[...document.querySelectorAll('#harness div')].find(d => d.style.width === '390px')`;
// Visible only: a pushed screen keeps the one beneath it mounted, hidden.
const VISIBLE = `e => e.getClientRects().length > 0`;
const frameText = () =>
  evaluate(`((${FRAME})?.innerText ?? '').replace(/\\s+/g, ' ')`);

async function waitForText(text, ms = 20000) {
  const started = Date.now();
  while (Date.now() - started < ms) {
    // Case aside: the new look draws some labels in capitals.
    if ((await frameText()).toLowerCase().includes(text.toLowerCase())) return;
    await sleep(250);
  }
  throw new Error(`timed out waiting for "${text}"`);
}

/** Click the last visible button-like element whose text is, or has, `text`. */
async function click(text, { exact = true } = {}) {
  const ok = await evaluate(`(() => {
    const want = ${JSON.stringify(text)};
    const els = [...(${FRAME}).querySelectorAll('button, [role="button"], a, summary')]
      .filter(${VISIBLE})
      .filter(e => {
        const t = (e.innerText || e.textContent || '').replace(/\\s+/g, ' ').trim();
        return ${exact} ? t === want : t.includes(want);
      });
    const el = els[els.length - 1];
    if (!el) return false;
    el.click();
    return true;
  })()`);
  if (!ok) throw new Error(`nothing to click: "${text}"`);
}

async function clickSelector(selector) {
  const ok = await evaluate(`(() => {
    const el = (${FRAME}).querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    el.click();
    return true;
  })()`);
  if (!ok) throw new Error(`nothing to click: ${selector}`);
}

/** Click the return time in the tip board row naming `ride`. */
async function clickTimeFor(ride) {
  const ok = await evaluate(`(() => {
    const rows = [...(${FRAME}).querySelectorAll('li')]
      .filter(${VISIBLE})
      .filter(li => li.innerText.includes(${JSON.stringify(ride)}));
    for (const row of rows) {
      const b = [...row.querySelectorAll('button')].find(b => /\\d{1,2}:\\d{2}/.test(b.innerText));
      if (b) { b.click(); return true; }
    }
    return false;
  })()`);
  if (!ok) throw new Error(`no return time for ${ride}`);
}

/** A real, trusted tap, for what only a gesture may start: the alert sound. */
async function tap(text) {
  const at = await evaluate(`(() => {
    const el = [...(${FRAME}).querySelectorAll('button')]
      .filter(${VISIBLE})
      .find(b => b.innerText.replace(/\\s+/g, ' ').trim() === ${JSON.stringify(text)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  if (!at) throw new Error(`nothing to tap: "${text}"`);
  for (const type of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', {
      type,
      ...at,
      button: 'left',
      clickCount: 1,
    });
  }
}

/**
 * What turning Autopilot on does on a phone, which a static scenario cannot:
 * the alert sound armed by a tap and, while it runs, the screen held. The
 * wake lock module is the app's own, found by the URL the page loaded it from.
 */
async function likeAPhone({ holdScreen }) {
  await tap('Test sound');
  if (holdScreen) {
    await evaluate(`(() => {
      const url = performance.getEntriesByType('resource')
        .map(e => e.name).find(n => /\\/src\\/autopilot\\/wakelock\\.ts$/.test(n));
      return import(url).then(m => Promise.race([
        m.holdScreenAwake('guide-screenshot'),
        new Promise(resolve => setTimeout(resolve, 3000)),
      ])).then(() => true);
    })()`);
  }
  await waitForText(
    holdScreen ? 'Screen is being kept awake' : 'Alert sound is armed'
  );
}

/** Scroll the frame's scroll pane so `text` sits near its top. */
async function scrollPaneTo(text) {
  const ok = await evaluate(`(() => {
    const frame = ${FRAME};
    const el = [...frame.querySelectorAll('summary, button, p, h2, h3')]
      .filter(${VISIBLE})
      .find(e => (e.innerText || '').includes(${JSON.stringify(text)}));
    if (!el) return false;
    let pane = el.parentElement;
    while (pane && pane !== frame) {
      const style = getComputedStyle(pane);
      if (/(auto|scroll)/.test(style.overflowY) && pane.scrollHeight > pane.clientHeight) break;
      pane = pane.parentElement;
    }
    if (!pane || pane === frame) return false;
    pane.scrollTop += el.getBoundingClientRect().top - pane.getBoundingClientRect().top - 16;
    return true;
  })()`);
  if (!ok) throw new Error(`nothing to scroll to: "${text}"`);
}

async function shoot(name) {
  await evaluate('document.fonts.ready.then(() => true)');
  // Let anything that fades or slides in settle, and the scroll pane rest.
  await sleep(700);
  const box = await evaluate(`(() => {
    const b = (${FRAME}).getBoundingClientRect();
    return { x: b.left, y: b.top, width: b.width, height: b.height };
  })()`);
  const { data } = await send('Page.captureScreenshot', {
    format: 'png',
    clip: { ...box, scale: WIDTH / box.width },
  });
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
  console.log(`saved ${name}.png`);
}

const open = scenario =>
  navigate(`${HARNESS}?scenario=${scenario}&frame=390x844`).then(() =>
    sleep(1500)
  );

const SHOTS = {
  'today-off': async () => {
    await open('off');
    await waitForText('Turn on autopilot');
  },
  'today-running': async () => {
    await open('running');
    await waitForText('Checking rapidly');
    await likeAPhone({ holdScreen: true });
  },
  stopped: async () => {
    await open('stopped');
    await waitForText('Stopped');
    // A stop gives the screen back, so only the sound is as a phone has it.
    await likeAPhone({ holdScreen: false });
  },
  refused: async () => {
    await open('refused');
    await waitForText('refusing');
    await likeAPhone({ holdScreen: true });
  },
  'dry-run': async () => {
    await open('dry-run');
    await waitForText('Dry run');
  },
  'unknown-attraction': async () => {
    await open('unknown-id');
    await waitForText('does not recognise');
    await scrollPaneTo('does not recognise');
  },
  'pretrip-checklist': async () => {
    await open('pretrip');
    await waitForText('Before your trip');
  },
  tipboard: async () => {
    await open('tipboard');
    await waitForText('Tier 1');
  },
  'book-by-hand': async () => {
    await open('tipboard');
    await waitForText('Big Thunder Mountain Railroad');
    await clickTimeFor('Big Thunder Mountain Railroad');
    await waitForText('Book Lightning Lane');
    await sleep(1000);
  },
  plans: async () => {
    await open('off');
    await click('Plans');
    await waitForText('Haunted Mansion');
  },
  times: async () => {
    await open('off');
    await click('Times');
    await waitForText('Adventureland');
  },
  nextll: async () => {
    await open('off');
    await click('NextLL');
    await waitForText('What do you want to do?');
  },
  settings: async () => {
    await open('off');
    await waitForText('Turn on autopilot');
    await clickSelector('button[title="Settings Menu"]');
    await waitForText('Log Out');
  },
  configure: async () => {
    await open('configure');
    await waitForText('Watching');
  },
  'configure-card': async () => {
    await open('configure');
    await waitForText('Space Mountain');
    await click('Space Mountain', { exact: false });
    await waitForText('What should Autopilot do?');
    await scrollPaneTo('Space Mountain');
  },
  'plan-check': async () => {
    await open('plancheck');
    await waitForText('blocker');
  },
  timeline: async () => {
    await open('timeline');
    await waitForText('Held');
  },
  activity: async () => {
    await open('activity');
    await waitForText('Why nothing was booked');
  },
  'time-search': async () => {
    await open('search-earlier');
    await waitForText('Find the earliest');
  },
  'time-search-running': async () => {
    await open('search-earlier');
    await waitForText('Find the earliest');
    await click('Find the earliest');
    // Past the move and checking again, as a search spends most of its time.
    await waitForText('1 moved', 90000);
    await waitForText('Checking', 90000);
  },
  'time-search-unresolved': async () => {
    await open('search-unresolved');
    await waitForText('Find the earliest');
    await click('Find the earliest');
    await waitForText('did not come back', 60000);
  },
};

await send('Page.enable');
// A page that has been tapped and is running asks before it is left, and that
// prompt would hold the next shot's navigation forever. Leaving is the point.
listeners.add(msg => {
  if (msg.method === 'Page.javascriptDialogOpening') {
    send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
  }
});
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 1200,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
await send('Emulation.setTimezoneOverride', { timezoneId: 'America/New_York' });
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `(() => {
    const Real = Date;
    const offset = ${FAKE_NOW} - Real.now();
    class FakeDate extends Real {
      constructor(...args) {
        if (args.length === 0) super(Real.now() + offset);
        else super(...args);
      }
      static now() { return Real.now() + offset; }
    }
    globalThis.Date = FakeDate;
    // Headless Chrome never settles a screen wake lock request; a phone does.
    // Answered as a phone would, so a shot of a running engine shows the
    // screen held, not a warning only the harness causes.
    if ('wakeLock' in navigator) {
      const request = async () => {
        const lock = new EventTarget();
        lock.type = 'screen';
        lock.released = false;
        lock.release = async () => {
          lock.released = true;
          lock.dispatchEvent(new Event('release'));
        };
        return lock;
      };
      try {
        Object.defineProperty(navigator.wakeLock, 'request', { value: request, configurable: true });
      } catch {}
    }
  })();`,
});

let failed = 0;
try {
  for (const [name, setUp] of Object.entries(SHOTS)) {
    if (ONLY.size && !ONLY.has(name)) continue;
    try {
      await setUp();
      await shoot(name);
    } catch (error) {
      failed++;
      console.log(`FAILED ${name}: ${error.message}`);
    }
  }
} finally {
  ws.close();
  // Chrome goes on writing to its profile as it exits, so the profile goes
  // after Chrome does.
  const exited = new Promise(resolve => chrome.once('exit', resolve));
  chrome.kill();
  await Promise.race([exited, sleep(5000)]);
  rmSync(profile, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  });
}
process.exit(failed ? 1 : 0);
