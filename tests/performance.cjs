// Compare archived 0.1.6 and current source on a local fixture, never user Chrome.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');

(async () => {
  const root = path.resolve(__dirname, '..');
  const currentVersion = JSON.parse(await fs.readFile(path.join(root, 'extension/manifest.json'), 'utf8')).version;
  const archived = JSON.parse(execFileSync('python', ['-c', 'import zipfile,json,sys; z=zipfile.ZipFile(sys.argv[1]); print(json.dumps({n:z.read(n).decode("utf-8") for n in z.namelist() if n.endswith(".js")}))', path.join(root, 'release/Chen-quang-cao-YouTube-v0.1.6.zip')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
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
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_TEST_PATH ? { executablePath: process.env.CHROME_TEST_PATH } : {}) });
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  const metrics = [];
  const variants = process.env.PERF_VARIANT ? [process.env.PERF_VARIANT] : ['baseline', 'current'];
  try {
    for (const rows of [20, 200]) for (const variant of variants) {
      await page.goto(`http://127.0.0.1:${server.address().port}/video/test123/monetization${variant === 'baseline' ? '?baseline' : ''}`);
      await page.waitForFunction(() => !MidrollPanelHost.shadowRoot.getElementById('read').disabled);
      const result = await page.evaluate(async (rows) => {
        fixture.readerResponse = { videoId: 'test123', seconds: 3600 };
        fixture.rerender = true;
        fixture.timelineSeconds = 20;
        for (let i = 3; i < rows; i++) addRow(MidrollPlanner.formatStudioTime(1500 + i * 2, '0:00:00'), true);
        const player = document.createElement('ytcp-video-player');
        player.getVideoData = () => ({ video_id: 'test123' });
        player.getDuration = () => 3600;
        player.getCurrentTime = () => fixture.timelineSeconds;
        player.pauseVideo = () => {};
        player.seekTo = (seconds) => { fixture.timelineSeconds = seconds; };
        document.getElementById('editor').append(player);
        const adapter = await MidrollStudio.createAdapter();
        const initial = adapter.snapshot();
        const samples = [];
        for (let i = 0; i < 10; i++) { const t = performance.now(); adapter.snapshot(); samples.push(performance.now() - t); }
        samples.sort((a, b) => a - b);
        const stages = [];
        const wait = MidrollWait.waitFor;
        MidrollWait.waitFor = async (check, options) => {
          const t = performance.now(); const value = await wait(check, options);
          if (options?.stableFor) stages.push({ stableFor: options.stableFor, elapsedMs: +(performance.now() - t).toFixed(1) });
          return value;
        };
        const t = performance.now();
        const additions = [60, 300, 420, 540, 660];
        const result = await MidrollRunner.runPlan(adapter, { fingerprint: initial.fingerprint, additions });
        const elapsed = performance.now() - t;
        const final = adapter.snapshot();
        return { snapshotMedianMs: +samples[5].toFixed(1), insertionMs: +elapsed.toFixed(1), msPerPoint: +(elapsed / additions.length).toFixed(1), stages, inserted: result.inserted, preserved: MidrollPlanner.preserves(initial.keys, final.keys), finalCount: final.keys.length, clicks: fixture.clicks, oldEdits: fixture.oldEdits || 0, saves: fixture.saves, deletes: fixture.deletes, automatic: document.getElementById('automatic').checked };
      }, rows);
      assert.equal(result.inserted, 5); assert.equal(result.preserved, true); assert.equal(result.finalCount, rows + 5);
      assert.equal(result.clicks, 5); assert.equal(result.oldEdits, 0); assert.equal(result.saves, 0); assert.equal(result.deletes, 0); assert.equal(result.automatic, true);
      metrics.push({ variant, rows, ...result });
      console.log(`${variant} ${rows} rows: snapshot ${result.snapshotMedianMs} ms; 5 points ${result.insertionMs} ms (${result.msPerPoint} ms/point)`);
    }
    assert.deepEqual(errors, []);
    const report = { environment: 'Local headless Chrome, mocked Studio/player/extension messaging, archived 0.1.6 versus current source. No real Studio speed claim.', metrics };
    await fs.writeFile(path.join(root, 'artifacts', process.env.PERF_VARIANT ? `performance-${process.env.PERF_VARIANT}.json` : `performance-v${currentVersion}-vs-0.1.6.json`), JSON.stringify(report, null, 2) + '\n');
  } finally { await browser.close(); await new Promise((resolve) => server.close(resolve)); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
