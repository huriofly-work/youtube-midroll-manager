// Isolated local fixture only, not the user's signed-in Studio.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const http = require('node:http');
const { chromium } = require('playwright');
(async () => {
  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = pathname.startsWith('/video/') ? path.resolve(__dirname, 'studio-fixture.html')
      : /^\/extension\/[a-z-]+\.js$/.test(pathname) ? path.resolve(__dirname, '..', pathname.slice(1)) : null;
    if (!file) { res.writeHead(404).end(); return; }
    try { res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/javascript; charset=utf-8'); res.end(await fs.readFile(file)); }
    catch { res.writeHead(404).end(); }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_TEST_PATH ? { executablePath: process.env.CHROME_TEST_PATH } : {}) });
  const version = JSON.parse(await fs.readFile(path.resolve(__dirname, '../extension/manifest.json'), 'utf8')).version;
  const page = await browser.newPage({ viewport: { width: 1300, height: 1100 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  const ui = (id) => page.locator('#midroll-helper-host').locator('#' + id);
  const ready = () => page.waitForFunction(() => !MidrollPanelHost.shadowRoot.getElementById('read').disabled);
  const done = () => page.waitForFunction(() => MidrollPanelHost.shadowRoot.getElementById('stop').hidden);
  const values = () => page.locator('.ad-row input').evaluateAll((nodes) => nodes.map((n) => n.value));
  let passed = 0;
  async function scenario(name, run) {
    await page.goto(`http://127.0.0.1:${server.address().port}/video/test123/monetization`);
    await ready(); await run(); passed++; console.log('PASS ' + name);
  }
  async function install(entries) {
    await page.evaluate((entries) => {
      document.getElementById('list').replaceChildren();
      fixture.deletedTimes = [];
      function serialize(n) {
        const warning = n.querySelector('[icon="yt-icons:warning"]');
        const question = [...n.querySelectorAll('[icon]')].find((node) => node.getAttribute('icon') !== 'yt-icons:warning');
        return { raw: n.querySelector('input').value, kind: n.getAttribute('data-ad-type'), warning: Boolean(warning),
          black: warning?.style.color === 'rgb(80, 80, 80)', pending: n.textContent.includes('Đang xem xét'),
          questionIcon: question?.getAttribute('icon'), decorative: question?.getAttribute('aria-hidden') === 'true', hiddenQuestion: question?.hidden };
      }
      function make(entry) {
        const row = addRow(entry.raw, true);
        if (entry.kind) row.setAttribute('data-ad-type', entry.kind);
        if (entry.warning) {
          const icon = document.createElement('span'); icon.setAttribute('icon', 'yt-icons:warning'); icon.style.color = entry.black ? 'rgb(80,80,80)' : 'rgb(220,30,30)'; icon.textContent = '⚠'; row.append(icon);
        }
        if (entry.pending || entry.pendingText) { const span = document.createElement('span'); span.textContent = entry.pendingText || 'Đang xem xét'; row.append(span); }
        if (entry.questionIcon) { const icon = document.createElement('span'); icon.setAttribute('icon', entry.questionIcon); icon.textContent = '?'; if (entry.decorative) icon.setAttribute('aria-hidden', 'true'); if (entry.hiddenQuestion) icon.hidden = true; row.append(icon); }
        if (entry.kind === 'automatic') row.querySelector('input').readOnly = true;
        const old = row.querySelector('button'), button = old.cloneNode(true); old.replaceWith(button);
        button.addEventListener('click', () => {
          fixture.deletes++; fixture.deletedTimes.push(row.querySelector('input').value);
          const rollback = fixture.undoDeleteOnce ? [...document.querySelectorAll('.ad-row')].map(serialize) : null;
          fixture.undoDeleteOnce = false;
          const apply = () => {
            if (fixture.removeMode === 'none') return;
            if (fixture.removeMode === 'wrong') row.nextElementSibling?.remove();
            else if (fixture.removeMode === 'double') { row.nextElementSibling?.remove(); row.remove(); }
            else row.remove();
            if (rollback) setTimeout(() => { document.getElementById('list').replaceChildren(); rollback.forEach(make); }, 80);
            if (fixture.cleanupRerender) {
              const remaining = [...document.querySelectorAll('.ad-row')].map(serialize);
              document.getElementById('list').replaceChildren(); remaining.forEach(make);
            }
          };
          if (fixture.deleteDelay) setTimeout(apply, fixture.deleteDelay); else if (fixture.deleteMicrotask) queueMicrotask(apply); else apply();
        });
      }
      entries.forEach(make);
    }, entries);
  }
  async function preview(spacing = 60) {
    if (await ui('run-alert').isVisible()) await ui('alert-inspect').click();
    await ui('tab-cleanup').click(); await ready();
    await ui('minimum-spacing').fill(String(spacing));
    await ui('cleanup-read').click(); await ready();
  }
  async function run() { await ui('cleanup-start').click(); await done(); }
  const m = (raw, warning = false) => ({ raw, kind: 'manual', warning });
  try {
    await scenario('cleanup margins remove manual endpoints and preserve automatic and unknown duplicate slots across rerenders', async () => {
      await install([m('0:10:00'), { raw: '0:10:00', kind: 'automatic', warning: true, pending: true }, { raw: '0:10:00', warning: true },
        m('1:00:00'), m('5:00:00'), m('9:00:00'), m('9:00:17'), m('9:50:00'), { raw: '9:50:00', kind: 'automatic', warning: true, pending: true }]);
      await page.evaluate(() => { fixture.cleanupRerender = true; });
      await preview(1);
      await ui('cleanup-start-margin').fill('60'); await ui('cleanup-end-margin').fill('60');
      await ui('cleanup-read').click(); await ready();
      assert.equal(await ui('times').locator('li').count(), 3);
      assert.match(await ui('times').innerText(), /Trong đoạn đầu không chèn/);
      assert.match(await ui('times').innerText(), /Trong đoạn cuối không chèn/);
      assert.deepEqual(await page.evaluate(() => [fixture.savedSettings.cleanupStartSeconds, fixture.savedSettings.cleanupEndMarginSeconds]), [60, 60]);
      await fs.mkdir(path.resolve(__dirname, '../artifacts'), { recursive: true });
      await page.screenshot({ path: path.resolve(__dirname, `../artifacts/cleanup-margins-v${version}.png`) });
      await ui('cleanup-start').click();
      assert.equal(await ui('cleanup-start-margin').isDisabled(), true); assert.equal(await ui('cleanup-end-margin').isDisabled(), true);
      await done();
      assert.equal(await ui('status').getAttribute('data-tone'), 'success', await ui('status').innerText());
      assert.deepEqual(await values(), ['0:10:00', '0:10:00', '1:00:00', '5:00:00', '9:00:00', '9:50:00']);
      assert.deepEqual(await page.evaluate(() => [fixture.deletedTimes, fixture.saves, fixture.oldEdits || 0]), [['0:10:00', '9:00:17', '9:50:00'], 0, 0]);
      assert.equal(await page.locator('#automatic').isChecked(), true);
    });
    await scenario('invalid cleanup margins block every click and edits invalidate preview', async () => {
      await install([m('0:30:00'), m('9:30:00')]); await preview(1);
      for (const [start, end] of [['', '0'], ['-1', '0'], ['0', '1.5'], ['300', '300']]) {
        await ui('cleanup-start-margin').fill(start); await ui('cleanup-end-margin').fill(end);
        await ui('cleanup-read').click(); await ready();
        assert.equal(await ui('cleanup-start').isDisabled(), true); assert.equal(await ui('status').getAttribute('data-tone'), 'error');
      }
      assert.equal(await page.evaluate(() => fixture.deletes + fixture.saves), 0);
      await ui('cleanup-start-margin').fill('60'); await ui('cleanup-end-margin').fill('60');
      await ui('cleanup-read').click(); await ready(); assert.equal(await ui('cleanup-start').isDisabled(), false);
      await ui('cleanup-end-margin').fill('0'); assert.equal(await ui('cleanup-start').isDisabled(), true); assert.equal(await ui('preview').isVisible(), false);
    });
    await scenario('cleanup margins are independent and survive switching tabs and reloading duration', async () => {
      await ui('start-margin').fill('90'); await ui('end-margin').fill('150'); await preview(1);
      assert.equal(await ui('cleanup-start-margin').inputValue(), '0'); assert.equal(await ui('cleanup-end-margin').inputValue(), '0');
      await ui('cleanup-start-margin').fill('30'); await ui('cleanup-end-margin').fill('45');
      await ui('cleanup-read').click(); await ready();
      await ui('tab-insert').click(); await ready();
      assert.equal(await ui('start-margin').inputValue(), '90'); assert.equal(await ui('end-margin').inputValue(), '150');
      await ui('tab-cleanup').click(); await ready(); await ui('load').click(); await ready();
      assert.equal(await ui('cleanup-start-margin').inputValue(), '30'); assert.equal(await ui('cleanup-end-margin').inputValue(), '45');
      assert.deepEqual(await page.evaluate(() => [fixture.savedSettings.cleanupStartSeconds, fixture.savedSettings.cleanupEndMarginSeconds]), [30, 45]);
      assert.equal(await page.evaluate(() => fixture.deletes + fixture.saves), 0);
    });
    await scenario('custom margins drive insertion preview and do not change existing points', async () => {
      await ui('start-margin').fill('90'); await ui('end-margin').fill('150'); await ui('read').click(); await ready();
      assert.deepEqual(await ui('times').locator('li').allTextContents(), ['00:01:30', '00:03:30', '00:05:30', '00:07:30']);
      assert.deepEqual(await page.evaluate(() => fixture.savedSettings), { intervalSeconds: 120, startSeconds: 90, endMarginSeconds: 150 });
      await fs.mkdir(path.resolve(__dirname, '../artifacts'), { recursive: true });
      await page.screenshot({ path: path.resolve(__dirname, '../artifacts/insert-tab.png') });
      await ui('start').click(); await done();
      assert.equal(await ui('status').getAttribute('data-tone'), 'success');
      assert.deepEqual(await values(), ['0:20:00', '3:00:00', '9:40:00', '1:30:00', '3:30:00', '5:30:00', '7:30:00']);
      assert.equal(await page.evaluate(() => fixture.deletes + fixture.saves), 0);
    });
    await scenario('invalid margins block and editing settings invalidates the preview', async () => {
      await ui('start-margin').fill('300'); await ui('end-margin').fill('300'); await ui('read').click(); await ready();
      assert.match(await ui('status').innerText(), /phải nhỏ hơn/); assert.equal(await ui('start').isDisabled(), true);
      await ui('start-margin').fill('0'); await ui('end-margin').fill('0'); await ui('read').click(); await ready();
      assert.equal(await ui('start').isDisabled(), false); await ui('end-margin').fill('10'); assert.equal(await ui('start').isDisabled(), true);
    });
    await scenario('separate tabs preserve settings and cleanup preview works without a checkbox or deletion', async () => {
      await install([m('1:00:00', true), m('3:00:00')]);
      await ui('interval').fill('145');
      assert.equal(await ui('insert-panel').isVisible(), true); assert.equal(await ui('cleanup-panel').isVisible(), false);
      assert.equal(await ui('reviewed').count(), 0); await preview();
      assert.equal(await ui('insert-panel').isVisible(), false); assert.equal(await ui('cleanup-panel').isVisible(), true);
      assert.equal(await page.evaluate(() => fixture.deletes), 0); assert.equal(await ui('times').locator('li').count(), 1);
      await ui('tab-insert').click(); await ready();
      assert.equal(await ui('interval').inputValue(), '145'); assert.equal(await ui('cleanup-start').isDisabled(), true);
      assert.equal(await ui('preview').isVisible(), false);
      await ui('tab-insert').press('ArrowRight'); await ready();
      assert.equal(await ui('tab-cleanup').getAttribute('aria-selected'), 'true');
      assert.equal(await ui('minimum-spacing').inputValue(), '60');
    });
    await scenario('reload reads new duration and warning data without changing settings or deleting points', async () => {
      await install([m('1:00:00', true), m('3:00:00')]); await preview(75);
      assert.equal(await ui('cleanup-start').isDisabled(), false);
      await page.evaluate(() => {
        document.querySelector('.duration').textContent = '11:00';
        const icon = document.createElement('span'); icon.setAttribute('icon', 'yt-icons:warning'); icon.style.color = 'rgb(220,30,30)'; icon.textContent = '⚠'; document.querySelectorAll('.ad-row')[1].append(icon);
      });
      await ui('load').click(); await ready();
      assert.equal(await ui('duration').innerText(), '00:11:00');
      assert.match(await ui('data-summary').innerText(), /2 điểm hiện có · 2 điểm thủ công có cảnh báo/);
      assert.equal(await ui('minimum-spacing').inputValue(), '75'); assert.equal(await ui('preview').isVisible(), false);
      assert.equal(await ui('cleanup-start').isDisabled(), true); assert.equal(await page.evaluate(() => fixture.deletes + fixture.saves), 0);
      await ui('cleanup-read').click(); await ready(); assert.equal(await ui('times').locator('li').count(), 2);
    });
    await scenario('switching tabs during a reload ignores a late result from the previous read', async () => {
      await page.evaluate(() => {
        const original = chrome.runtime.sendMessage; let reads = 0;
        chrome.runtime.sendMessage = async (message) => {
          if (message.type === 'MIDROLL_READ_DURATION' && ++reads === 1) {
            await new Promise((r) => setTimeout(r, 600)); return { videoId: 'test123', seconds: 650 };
          }
          return original(message);
        };
      });
      await ui('load').click(); assert.equal(await ui('load').isDisabled(), true);
      await ui('tab-cleanup').click(); await ready();
      await page.waitForTimeout(700);
      assert.equal(await ui('duration').innerText(), '00:10:00'); assert.equal(await ui('cleanup-panel').isVisible(), true);
      assert.equal(await ui('load').isDisabled(), false); assert.equal(await page.evaluate(() => fixture.deletes + fixture.saves), 0);
    });
    await scenario('red warning and spacing cleanup preserves automatic slots and earliest manual, including full rerenders', async () => {
      await install([m('1:00:00', true), m('2:00:00'), m('2:30:00'), { raw: '4:00:00', kind: 'automatic', warning: true }, m('3:45:00'), m('6:00:00')]);
      await page.evaluate(() => { fixture.cleanupRerender = true; });
      await preview(); assert.equal(await ui('times').locator('li').count(), 3);
      assert.equal(await page.evaluate(() => fixture.savedSettings.minimumSpacingSeconds), 60);
      await fs.mkdir(path.resolve(__dirname, '../artifacts'), { recursive: true });
      await page.screenshot({ path: path.resolve(__dirname, '../artifacts/cleanup-plan.png') });
      await run();
      assert.equal(await ui('status').getAttribute('data-tone'), 'success', await ui('status').innerText());
      assert.deepEqual(await values(), ['2:00:00', '4:00:00', '6:00:00']);
      assert.deepEqual(await page.evaluate(() => [fixture.deletedTimes, fixture.saves, fixture.clicks, fixture.oldEdits || 0, fixture.backgroundRunId]), [['1:00:00', '2:30:00', '3:45:00'], 0, 0, 0, null]);
      assert.equal(await page.locator('#automatic').isChecked(), true);
      await fs.mkdir(path.resolve(__dirname, '../artifacts'), { recursive: true });
      await page.screenshot({ path: path.resolve(__dirname, '../artifacts/cleanup-preview.png') });
    });
    await scenario('unknown origin is protected; pending manual is removed and a black icon is not a red warning', async () => {
      await install([{ raw: '1:00:00', warning: true }, { ...m('3:00:00', true), pending: true }, { ...m('5:00:00', true), black: true }]);
      await preview(); assert.equal(await ui('times').locator('li').count(), 1);
      assert.match(await ui('summary').innerText(), /Sẽ xóa 1 điểm thủ công Đang xem xét/);
      await run(); assert.deepEqual(await values(), ['1:00:00', '5:00:00']);
    });
    await scenario('Dang xem xet text selects the manual point for removal and does not exclude its nearby eligible neighbor', async () => {
      await install([{ ...m('1:00:00', true), pendingText: 'Đang xem xét' }, m('1:10:00'), m('3:00:00', true)]);
      await preview(120);
      assert.match(await ui('data-summary').innerText(), /1 điểm đang xem xét/);
      assert.deepEqual(await ui('times').locator('li').allTextContents(), ['1:00:00 — Đang xem xét', '3:00:00 — Cảnh báo của YouTube']);
      await run(); assert.deepEqual(await values(), ['1:10:00']);
      assert.deepEqual(await page.evaluate(() => fixture.deletedTimes), ['1:00:00', '3:00:00']);
    });
    await scenario('decorative circle question icons select manual rows for removal but protect unknown rows', async () => {
      const names = ['yt-icons:help_outline', 'yt-icons:help-outline', 'help-circle', 'question-mark-circle'];
      await install([...names.map((name, i) => ({ ...m(`${i + 1}:00:00`, true), questionIcon: name, decorative: true })), { raw: '5:00:00', questionIcon: 'yt-icons:help_outline', decorative: true }]);
      await preview(300);
      assert.equal(await ui('times').locator('li').count(), 4);
      assert.match(await ui('summary').innerText(), /Sẽ xóa 4 điểm thủ công Đang xem xét/);
      assert.match(await ui('summary').innerText(), /1 điểm chưa rõ loại/);
      assert.equal(await page.evaluate(() => fixture.deletes), 0);
      const adapter = await page.evaluate(async () => (await MidrollStudio.createAdapter()).cleanupSnapshot().rows.map((r) => r.pending));
      assert.deepEqual(adapter, [true, true, true, true, true]);
      await fs.mkdir(path.resolve(__dirname, '../artifacts'), { recursive: true });
      await page.screenshot({ path: path.resolve(__dirname, '../artifacts/review-pending.png') });
      await run(); assert.deepEqual(await values(), ['5:00:00']);
      assert.equal(await page.evaluate(() => fixture.saves), 0);
    });
    await scenario('row-linked hidden review tooltip is read without classifying another row as reviewing', async () => {
      await install([m('1:00:00', true), m('3:00:00', true)]);
      await page.evaluate(() => {
        const tooltip = document.createElement('div'); tooltip.id = 'review-tooltip'; tooltip.hidden = true; tooltip.textContent = 'Đang xem xét'; document.body.append(tooltip);
        const icon = document.createElement('span'); icon.setAttribute('icon', 'yt-icons:info'); icon.setAttribute('aria-describedby', tooltip.id); icon.textContent = 'ⓘ'; document.querySelector('.ad-row').append(icon);
      });
      await preview(); assert.deepEqual(await ui('times').locator('li').allTextContents(), ['1:00:00 — Đang xem xét', '3:00:00 — Cảnh báo của YouTube']);
      await run(); assert.deepEqual(await values(), []);
    });
    await scenario('question status in an open shadow root is recognized while help outside rows and hidden icons are ignored', async () => {
      await install([m('1:00:00', true), { ...m('3:00:00', true), questionIcon: 'yt-icons:help_outline', hiddenQuestion: true }]);
      await page.evaluate(() => {
        const host = document.createElement('status-glyph'); document.querySelector('.ad-row').append(host);
        const root = host.attachShadow({ mode: 'open' }); root.innerHTML = '<span icon="yt-icons:help_outline" aria-hidden="true">?</span>';
        const guide = document.createElement('span'); guide.setAttribute('icon', 'yt-icons:help_outline'); guide.textContent = '?'; document.getElementById('editor').append(guide);
      });
      await preview(); assert.match(await ui('summary').innerText(), /Sẽ xóa 1 điểm thủ công Đang xem xét/);
      assert.deepEqual(await page.evaluate(async () => (await MidrollStudio.createAdapter()).cleanupSnapshot().rows.map((r) => r.pending)), [true, false]);
      await run(); assert.deepEqual(await values(), []);
    });
    await scenario('a target changing to a question review icon after preview stops before any deletion', async () => {
      await install([m('1:00:00', true), m('3:00:00')]); await preview();
      await page.evaluate(() => { const icon = document.createElement('span'); icon.setAttribute('icon', 'yt-icons:help_outline'); icon.setAttribute('aria-hidden', 'true'); icon.textContent = '?'; document.querySelector('.ad-row').append(icon); });
      await run(); assert.equal(await ui('status').getAttribute('data-tone'), 'error'); assert.equal(await page.evaluate(() => fixture.deletes), 0);
      await preview(); await run(); assert.deepEqual(await values(), ['3:00:00']);
    });
    await scenario('review question appearing during a group stops before deleting the newly pending target', async () => {
      await install([m('1:00:00', true), m('3:00:00', true), m('5:00:00', true)]);
      await page.evaluate(() => {
        document.querySelector('.ad-row button').addEventListener('click', () => {
          const icon = document.createElement('span'); icon.setAttribute('icon', 'yt-icons:help_outline'); icon.setAttribute('aria-hidden', 'true'); icon.textContent = '?'; document.querySelector('.ad-row').append(icon);
        });
        const wait = MidrollWait.waitFor; MidrollWait.waitFor = (check, options) => wait(check, { ...options, timeout: 800 });
      });
      await preview(); await run();
      assert.equal(await ui('status').getAttribute('data-tone'), 'error');
      assert.deepEqual(await values(), ['3:00:00', '5:00:00']);
      assert.deepEqual(await page.evaluate(() => fixture.deletedTimes), ['1:00:00']);
      assert.equal(await page.evaluate(() => MidrollStudio.diagnostics().adRows[0].pending), true);
      await preview(); await run(); assert.deepEqual(await values(), []);
      assert.equal(await page.evaluate(() => fixture.saves), 0);
    });
    await scenario('unflagged pending manual is deleted regardless of spacing while pending automatic and unknown duplicates survive full rerenders', async () => {
      await install([{ ...m('1:00:00'), questionIcon: 'help-circle' }, { raw: '1:00:00', kind: 'automatic', questionIcon: 'help-circle' },
        { raw: '1:00:00', questionIcon: 'help-circle' }, m('6:00:00')]);
      await page.evaluate(() => { fixture.cleanupRerender = true; });
      await preview(60);
      assert.deepEqual(await ui('times').locator('li').allTextContents(), ['1:00:00 — Đang xem xét']);
      await run(); assert.equal(await ui('status').getAttribute('data-tone'), 'success', await ui('status').innerText());
      assert.deepEqual(await values(), ['1:00:00', '1:00:00', '6:00:00']);
      assert.equal(await page.locator('[data-ad-type="automatic"]').count(), 1);
      assert.deepEqual(await page.evaluate(async () => (await MidrollStudio.createAdapter()).cleanupSnapshot().rows.map((r) => [r.kind, r.pending])), [['automatic', true], ['unknown', true], ['manual', false]]);
      assert.equal(await page.evaluate(() => fixture.saves), 0);
    });
    await scenario('single-point adapter accepts pending manual and preserves same-time automatic and unknown rows', async () => {
      await install([{ ...m('1:00:00'), pending: true }, { raw: '1:00:00', kind: 'automatic', pending: true }, { raw: '1:00:00', pending: true }]);
      await page.evaluate(async () => {
        const adapter = await MidrollStudio.createAdapter(), before = adapter.cleanupSnapshot();
        await adapter.removePoint(MidrollCleanup.key(before.rows[0]), { expectedFingerprint: before.cleanupFingerprint });
      });
      assert.deepEqual(await page.evaluate(async () => (await MidrollStudio.createAdapter()).cleanupSnapshot().rows.map((r) => [r.kind, r.pending])), [['automatic', true], ['unknown', true]]);
      assert.equal(await page.evaluate(() => fixture.deletes), 1);
      assert.equal(await page.evaluate(() => fixture.saves), 0);
    });
    await scenario('manual section headings classify rows, warning siblings outside the controls are included', async () => {
      await install([{ raw: '1:00:00', warning: true }, { raw: '2:00:00' }]);
      await page.evaluate(() => {
        const heading = document.createElement('h3'); heading.textContent = 'Vị trí quảng cáo thủ công'; document.getElementById('list').prepend(heading);
        const row = document.querySelector('.ad-row'), controls = document.createElement('div'); controls.className = 'ad-break-controls'; row.prepend(controls); controls.append(row.querySelector('input'), row.querySelector('button'));
      });
      await preview(); await run(); assert.deepEqual(await values(), ['2:00:00']);
    });
    await scenario('warnings changing after preview stop before a delete', async () => {
      await install([m('1:00:00', true), m('5:00:00')]); await preview();
      await page.locator('[icon]').evaluate((n) => n.remove()); await run();
      assert.match(await ui('status').innerText(), /thay đổi/); assert.equal(await page.evaluate(() => fixture.deletes), 0);
    });
    await scenario('identical manual timecodes allow one occurrence removal without touching automatic duplicates', async () => {
      await install([m('1:00:00'), m('1:00:00'), { raw: '5:00:00', kind: 'automatic' }, m('5:00:00')]);
      await preview(); await run(); assert.equal(await ui('status').getAttribute('data-tone'), 'success');
      assert.deepEqual(await values(), ['1:00:00', '5:00:00']);
      assert.equal(await page.locator('[data-ad-type="automatic"]').count(), 1);
    });
    for (const mode of ['none', 'wrong', 'double']) {
      await scenario('cleanup ' + mode + ' acknowledgment stops after one click without saving', async () => {
        await install([m('1:00:00', true), { raw: '3:00:00', kind: 'automatic' }, m('5:00:00', true)]);
        await page.evaluate((mode) => {
          fixture.removeMode = mode; const wait = MidrollWait.waitFor;
          MidrollWait.waitFor = (check, options) => wait(check, { ...options, timeout: 700 });
        }, mode);
        await preview(); await run(); assert.equal(await ui('status').getAttribute('data-tone'), 'error');
        assert.deepEqual(await page.evaluate(() => [fixture.deletes, fixture.saves]), [1, 0]);
      });
    }
    await scenario('cancel while deletion is pending never clicks the next target', async () => {
      await install([m('1:00:00', true), m('5:00:00', true)]); await page.evaluate(() => { fixture.deleteDelay = 900; });
      await preview(); await ui('cleanup-start').click(); await page.waitForFunction(() => fixture.deletes === 1);
      assert.equal(await ui('load').isDisabled(), true); assert.equal(await ui('tab-insert').isDisabled(), true);
      await ui('stop').click(); await done(); assert.equal(await page.evaluate(() => fixture.deletes), 1); assert.equal(await page.evaluate(() => fixture.backgroundRunId), null);
    });
    await scenario('rollback during a quick group stops before the next group and preserves the automatic row', async () => {
      const initial = [m('1:00:00', true), m('2:00:00', true), m('3:00:00', true), m('4:00:00', true), m('5:00:00', true), m('6:00:00', true), { raw: '8:00:00', kind: 'automatic' }];
      await install(initial);
      await page.evaluate(() => {
        fixture.undoDeleteOnce = true; const wait = MidrollWait.waitFor;
        MidrollWait.waitFor = (check, options) => wait(check, { ...options, timeout: 800 });
      });
      await preview(); await run();
      assert.equal(await ui('status').getAttribute('data-tone'), 'error'); assert.equal(await page.evaluate(() => fixture.deletes), 5);
      assert.deepEqual(await values(), initial.map((entry) => entry.raw));
      assert.match(await ui('status').innerText(), /Đã bấm xóa 5 điểm trong nhóm/);
      assert.equal(await page.evaluate(() => fixture.saves), 0); assert.equal(await page.locator('[data-ad-type="automatic"]').count(), 1);
    });
    await scenario('stop during a quick group reports the unconfirmed group and never reaches group two', async () => {
      await install(Array.from({ length: 7 }, (_, i) => m(`${i + 1}:00:00`, true)));
      await preview(); await ui('cleanup-start').click(); await page.waitForFunction(() => fixture.deletes === 5);
      await ui('stop').click(); await done();
      assert.equal(await page.evaluate(() => fixture.deletes), 5);
      assert.match(await ui('status').innerText(), /nhóm đang xử lý nhưng chưa xác nhận/);
      assert.equal(await ui('status').getAttribute('data-tone'), 'warning');
      assert.equal(await ui('run-alert').getAttribute('data-severity'), 'warning');
      assert.match(await ui('alert-guidance').innerText(), /Đã bấm xóa 5 điểm nhưng chưa xác nhận/);
      assert.equal(await ui('alert-notice').isVisible(), false);
      assert.equal(await page.evaluate(() => fixture.backgroundRunId), null);
    });
    await scenario('lost focus cleanup confirms all points serially without retrying clicks', async () => {
      await install([m('1:00:00', true), m('5:00:00', true)]);
      await page.evaluate(() => { Object.defineProperty(document, 'hasFocus', { configurable: true, value: () => false }); fixture.deleteDelay = 300; });
      await preview(); await run(); assert.deepEqual(await values(), []); assert.equal(await page.evaluate(() => fixture.deletes), 2);
      assert.equal(await ui('status').getAttribute('data-tone'), 'success');
    });
    await scenario('audit: busy loading status is not a review removal and blocks cleanup until the row finishes loading', async () => {
      await install([m('1:00:00', true), m('3:00:00')]);
      await page.evaluate(() => { const spinner = document.createElement('ytcp-spinner'); spinner.textContent = 'Đang xử lý'; document.querySelector('.ad-row').append(spinner); });
      await preview(); assert.equal(await ui('cleanup-start').isDisabled(), true);
      assert.match(await ui('status').innerText(), /đang tải hoặc xử lý/); assert.equal(await page.evaluate(() => fixture.deletes), 0);
      assert.equal(await page.evaluate(() => MidrollStudio.diagnostics().adRows[0].pending), false);
      await page.locator('ytcp-spinner').evaluate((node) => node.remove());
      await preview(); await run(); assert.deepEqual(await values(), ['3:00:00']);
    });
    await scenario('audit: ordinary help class and help button question marks never classify an unflagged row as reviewing', async () => {
      await install([m('1:00:00'), m('3:00:00')]);
      await page.evaluate(() => {
        const row = document.querySelector('.ad-row'), text = document.createElement('span'); text.className = 'help'; text.textContent = 'Thông tin'; row.append(text);
        const help = document.createElement('button'); help.setAttribute('aria-label', 'Trợ giúp'); help.innerHTML = '<span icon="help-circle">?</span>'; row.append(help);
      });
      await preview(); assert.equal(await ui('cleanup-start').isDisabled(), true);
      assert.equal(await page.evaluate(() => MidrollStudio.diagnostics().adRows[0].pending), false);
      assert.equal(await page.evaluate(() => fixture.deletes), 0);
    });
    await scenario('audit: immutable automatic rows without a delete button still anchor minimum spacing', async () => {
      await install([{ raw: '1:00:00', kind: 'automatic' }, m('1:10:00'), m('4:00:00')]);
      await page.locator('[data-ad-type="automatic"] button').evaluate((node) => node.remove());
      await preview(60); assert.equal(await ui('times').locator('li').count(), 1); await run();
      assert.deepEqual(await values(), ['1:00:00', '4:00:00']); assert.equal(await page.locator('[data-ad-type="automatic"]').count(), 1);
    });
    await scenario('audit: automatic review state changing during cleanup is preserved without invalidating manual targets', async () => {
      await install([m('1:00:00', true), { raw: '3:00:00', kind: 'automatic' }, m('5:00:00', true)]);
      await page.evaluate(() => document.querySelector('.ad-row button').addEventListener('click', () => {
        const icon = document.createElement('span'); icon.setAttribute('icon', 'help-circle'); icon.textContent = '?'; document.querySelector('[data-ad-type="automatic"]').append(icon);
      }));
      await preview(); await run(); assert.equal(await ui('status').getAttribute('data-tone'), 'success', await ui('status').innerText());
      assert.deepEqual(await values(), ['3:00:00']); assert.equal(await page.evaluate(() => MidrollStudio.diagnostics().adRows[0].pending), true);
    });
    await scenario('audit: queued framework commits share group settling without repeated delete attempts', async () => {
      await install([...Array.from({ length: 7 }, (_, i) => m(`${i + 1}:00:00`, true)), { raw: '9:00:00', kind: 'automatic' }]);
      await page.evaluate(() => {
        fixture.deleteMicrotask = true; fixture.settleWindows = 0;
        const wait = MidrollWait.waitFor; MidrollWait.waitFor = (check, options) => { if (options?.stableFor === 400) fixture.settleWindows++; return wait(check, options); };
      });
      await preview(); await run(); assert.equal(await ui('status').getAttribute('data-tone'), 'success', await ui('status').innerText());
      assert.deepEqual(await values(), ['9:00:00']); assert.equal(await page.evaluate(() => fixture.deletes), 7);
      assert.ok(await page.evaluate(() => fixture.settleWindows < fixture.deletes)); assert.equal(await page.evaluate(() => fixture.saves), 0);
    });
    await scenario('audit: earliest subsecond manual point is kept when equal-second rows are listed in reverse order', async () => {
      await install([m('1:00:30'), m('1:00:05')]); await preview(); await run();
      assert.deepEqual(await values(), ['1:00:05']); assert.deepEqual(await page.evaluate(() => fixture.deletedTimes), ['1:00:30']);
    });
    await scenario('audit: automatic setting change after preview blocks all cleanup clicks', async () => {
      await install([m('1:00:00', true), m('3:00:00')]); await preview(); await page.locator('#automatic').uncheck(); await run();
      assert.equal(await ui('status').getAttribute('data-tone'), 'error'); assert.equal(await page.evaluate(() => fixture.deletes), 0);
    });
    await scenario('audit: one unavailable manual delete control blocks preview before any earlier target is deleted', async () => {
      await install([m('1:00:00', true), m('3:00:00', true)]);
      await page.locator('.ad-row button').last().evaluate((node) => node.remove());
      await preview(); assert.equal(await ui('cleanup-start').isDisabled(), true);
      assert.match(await ui('status').innerText(), /nút Xóa khả dụng/); assert.equal(await page.evaluate(() => fixture.deletes), 0);
      assert.deepEqual(await values(), ['1:00:00', '3:00:00']);
    });
    await scenario('audit: mixed frame and decimal precision cannot silently violate the minimum spacing rule', async () => {
      await install([m('1:00:17'), m('2:00.500')]); await preview(60);
      assert.equal(await ui('cleanup-start').isDisabled(), true); assert.match(await ui('status').innerText(), /khác định dạng/);
      assert.equal(await page.evaluate(() => fixture.deletes), 0);
    });
    await scenario('audit: a disabled target after preview blocks the group before any earlier deletion', async () => {
      await install([m('1:00:00', true), m('3:00:00', true)]); await preview();
      await page.locator('.ad-row button').last().evaluate((node) => { node.disabled = true; });
      await run(); assert.equal(await ui('status').getAttribute('data-tone'), 'error');
      assert.equal(await page.evaluate(() => fixture.deletes), 0); assert.deepEqual(await values(), ['1:00:00', '3:00:00']);
    });
    assert.deepEqual(errors, []); console.log(`PASS ${passed} cleanup/margin browser scenarios; no uncaught errors`);
  } finally { await browser.close(); await new Promise((r) => server.close(r)); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
