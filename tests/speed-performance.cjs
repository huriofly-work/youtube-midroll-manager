// Compare production source to archived 0.1.10 on isolated local fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
(async () => {
  const root = path.resolve(__dirname, '..');
  const currentVersion = JSON.parse(await fs.readFile(path.join(root, 'extension/manifest.json'), 'utf8')).version;
  const archived = JSON.parse(execFileSync('python', ['-c', 'import zipfile,json,sys; z=zipfile.ZipFile(sys.argv[1]); print(json.dumps({n:z.read(n).decode("utf-8") for n in z.namelist() if n.endswith(".js")}))', path.join(root, 'release/Chen-quang-cao-YouTube-v0.1.10.zip')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  const html = await fs.readFile(path.join(__dirname, 'studio-fixture.html'), 'utf8');
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname.startsWith('/video/')) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(url.searchParams.has('baseline') ? html.replaceAll('/extension/', '/baseline/') : html);
      } else if (/^\/(extension|baseline)\/[a-z-]+\.js$/.test(url.pathname)) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.end(url.pathname.startsWith('/baseline/') ? archived[path.basename(url.pathname)] : await fs.readFile(path.join(root, url.pathname.slice(1))));
      } else res.writeHead(404).end();
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_TEST_PATH ? { executablePath: process.env.CHROME_TEST_PATH } : {}) });
  const page = await browser.newPage(); const errors = [], metrics = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    for (const rows of [20, 200]) for (const operation of ['insert', 'cleanup']) for (const variant of ['baseline', 'current']) {
      await page.goto(`http://127.0.0.1:${server.address().port}/video/test123/monetization${variant === 'baseline' ? '?baseline' : ''}`);
      await page.waitForFunction(() => !MidrollPanelHost.shadowRoot.getElementById('read').disabled);
      const result = await page.evaluate(async ({ rows, operation }) => {
        fixture.readerResponse = { videoId: 'test123', seconds: 3600 };
        document.getElementById('list').replaceChildren();
        for (let i = 0; i < rows; i++) addRow(MidrollPlanner.formatStudioTime(2000 + i * 5, '0:00:00'), true);
        const samples = [];
        if (operation === 'insert') {
          fixture.rerender = true; fixture.timelineSeconds = 20;
          const player = document.createElement('ytcp-video-player');
          player.getVideoData = () => ({ video_id: 'test123' }); player.getDuration = () => 3600;
          player.getCurrentTime = () => fixture.timelineSeconds; player.pauseVideo = () => {};
          player.seekTo = (seconds) => { fixture.timelineSeconds = seconds; }; document.getElementById('editor').append(player);
          const adapter = await MidrollStudio.createAdapter(), before = adapter.snapshot();
          const t = performance.now();
          const result = await MidrollRunner.runPlan(adapter, { fingerprint: before.fingerprint, additions: [60, 300, 420, 540, 660] });
          const elapsed = performance.now() - t, after = adapter.snapshot();
          return { elapsedMs: +elapsed.toFixed(1), msPerPoint: +(elapsed / result.inserted).toFixed(1), changed: result.inserted,
            preserved: MidrollPlanner.preserves(before.keys, after.keys), finalCount: after.rows.length, clicks: fixture.clicks, deletes: fixture.deletes,
            saves: fixture.saves, oldEdits: fixture.oldEdits || 0, automatic: document.getElementById('automatic').checked };
        }
        let entries = [...document.querySelectorAll('.ad-row input')].map((n, i) => ({ raw: n.value, kind: i % 4 === 0 ? 'automatic' : 'manual', warning: false }));
        entries.push(...Array.from({ length: 20 }, (_, i) => ({ raw: MidrollPlanner.formatStudioTime(60 + i * 30, '0:00:00'), kind: 'manual', warning: true })));
        function render() {
          document.getElementById('list').replaceChildren();
          entries.forEach((entry) => {
            const row = addRow(entry.raw, true); row.setAttribute('data-ad-type', entry.kind);
            if (entry.warning) { const icon = document.createElement('span'); icon.setAttribute('icon', 'yt-icons:warning'); icon.style.color = 'rgb(220,30,30)'; icon.textContent = '⚠'; row.append(icon); }
            const old = row.querySelector('button'), button = old.cloneNode(true); old.replaceWith(button);
            button.addEventListener('click', () => { fixture.deletes++; entries = entries.filter((item) => item !== entry); render(); });
          });
        }
        render();
        const adapter = await MidrollStudio.createAdapter(), before = adapter.cleanupSnapshot();
        for (let i = 0; i < 10; i++) { const t = performance.now(); adapter.cleanupSnapshot(); samples.push(performance.now() - t); }
        samples.sort((a, b) => a - b);
        const plan = MidrollCleanup.makePlan(before, 1), protectedSignature = MidrollCleanup.signature(before.rows.filter((r) => !r.warning));
        const t = performance.now(), result = await MidrollCleanup.runPlan(adapter, plan), elapsed = performance.now() - t;
        const after = adapter.cleanupSnapshot();
        return { elapsedMs: +elapsed.toFixed(1), msPerPoint: +(elapsed / result.removed).toFixed(1), snapshotMedianMs: +samples[5].toFixed(1), changed: result.removed,
          preserved: MidrollCleanup.signature(after.rows) === protectedSignature, finalCount: after.rows.length, clicks: fixture.clicks, deletes: fixture.deletes,
          saves: fixture.saves, oldEdits: fixture.oldEdits || 0, automatic: document.getElementById('automatic').checked };
      }, { rows, operation });
      assert.equal(result.changed, operation === 'insert' ? 5 : 20); assert.equal(result.preserved, true);
      assert.equal(result.finalCount, operation === 'insert' ? rows + 5 : rows);
      assert.equal(result.clicks, operation === 'insert' ? 5 : 0); assert.equal(result.deletes, operation === 'insert' ? 0 : 20);
      assert.equal(result.saves, 0); assert.equal(result.oldEdits, 0); assert.equal(result.automatic, true);
      metrics.push({ variant, rows, operation, ...result });
      console.log(`${variant} ${operation} ${rows} old rows: ${result.elapsedMs} ms; ${result.msPerPoint} ms/point`);
    }
    assert.deepEqual(errors, []);
    const comparisons = metrics.filter((m) => m.variant === 'current').map((m) => {
      const old = metrics.find((other) => other.variant === 'baseline' && other.operation === m.operation && other.rows === m.rows);
      return { operation: m.operation, rows: m.rows, reductionPercent: +((1 - m.elapsedMs / old.elapsedMs) * 100).toFixed(1) };
    });
    await fs.writeFile(path.join(root, `artifacts/performance-v${currentVersion}-vs-0.1.10.json`), JSON.stringify({ environment: 'Local headless Chrome, mocked Studio/player/messaging; full list rerenders. Archived 0.1.10 vs current. No real Studio speed claim.', metrics, comparisons }, null, 2) + '\n');
    console.log(JSON.stringify(comparisons));
  } finally { await browser.close(); await new Promise((r) => server.close(r)); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
