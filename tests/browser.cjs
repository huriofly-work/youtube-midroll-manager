// Local headless browser tests, never the user's signed-in Chrome profile.
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
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_TEST_PATH ? { executablePath: process.env.CHROME_TEST_PATH } : {})
  });
  const page = await browser.newPage({ viewport: { width: 1300, height: 940 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const fixture = `http://127.0.0.1:${server.address().port}/video/test123/monetization`;
  const status = page.locator('#midroll-helper-host').locator('#status');
  const read = page.locator('#midroll-helper-host').locator('#read');
  const start = page.locator('#midroll-helper-host').locator('#start');
  const input = page.locator('#midroll-helper-host').locator('#interval');
  const values = () => page.locator('.ad-row input').evaluateAll((nodes) => nodes.map((node) => node.value));
  let passed = 0;
  async function ready() {
    await page.waitForFunction(() => !globalThis.MidrollPanelHost.shadowRoot.getElementById('read').disabled);
  }
  async function preview() { await read.click(); await ready(); }
  async function metadata(seconds = 507, videoId = 'test123') {
    await page.evaluate(({ seconds, videoId }) => {
      const player = document.createElement('div');
      player.id = 'movie_player';
      player.getVideoData = () => ({ video_id: videoId });
      player.getDuration = () => seconds;
      document.body.prepend(player);
    }, { seconds, videoId });
  }
  async function timeline(ignoreSeek = false) {
    await page.evaluate((ignoreSeek) => {
      fixture.timelineSeconds = 20;
      const player = document.createElement('ytcp-video-player');
      player.getVideoData = () => ({ video_id: 'test123' });
      player.getDuration = () => fixture.previewDuration || 600;
      player.getCurrentTime = () => fixture.timelineSeconds;
      player.pauseVideo = () => { fixture.pauses = (fixture.pauses || 0) + 1; };
      player.seekTo = (seconds) => { if (!ignoreSeek) fixture.timelineSeconds = seconds; };
      document.getElementById('editor').append(player);
    }, ignoreSeek);
  }
  async function scenario(name, check, query = '') {
    if (process.env.BROWSER_TEST_FILTER && !name.includes(process.env.BROWSER_TEST_FILTER)) return;
    await page.goto(fixture + query);
    await ready();
    await check();
    passed++;
    console.log(`PASS ${name}`);
  }
  try {
    await scenario('preview, insert, preserve old points/automatic ads, never save/delete, repeat no duplicates', async () => {
      await preview();
      assert.match(await page.locator('#midroll-helper-host').locator('#summary').innerText(), /Giữ 3 điểm có sẵn.*Bỏ qua 1/);
      assert.equal(await page.locator('#midroll-helper-host').locator('#times li').count(), 4);
      await start.click();
      await page.waitForFunction(() => globalThis.MidrollPanelHost.shadowRoot.getElementById('status').dataset.tone === 'success');
      assert.deepEqual(await values(), ['0:20:00', '3:00:00', '9:40:00', '1:00:00', '5:00:00', '7:00:00', '9:00:00']);
      assert.equal(await page.locator('#automatic').isChecked(), true);
      assert.deepEqual(await page.evaluate(() => [fixture.saves, fixture.deletes, fixture.clicks]), [0, 0, 4]);
      await preview();
      assert.equal(await start.isDisabled(), true);
      assert.match(await status.innerText(), /Không cần thêm/);
    });
    await scenario('new-row edit when there is no playhead field', async () => {
      await page.locator('#playhead').evaluate((node) => node.remove());
      await preview();
      await start.click();
      await page.waitForFunction(() => globalThis.MidrollPanelHost.shadowRoot.getElementById('status').dataset.tone === 'success');
      assert.equal((await values()).length, 7);
      assert.equal((await values()).filter((time) => time === '3:00:00').length, 1);
    });
    await scenario('fully rerendered list with a distinct extra timestamp', async () => {
      await page.evaluate(() => { fixture.rerender = true; });
      await preview();
      await start.click();
      await page.waitForFunction(() => globalThis.MidrollPanelHost.shadowRoot.getElementById('status').dataset.tone === 'success');
      assert.equal((await values()).length, 7);
    });
    await scenario('rerender initially duplicates an old timestamp then settles to the new point', async () => {
      await page.evaluate(() => { fixture.rerender = true; fixture.provisionalTime = '0:20:00'; fixture.settleDelay = 700; });
      await preview(); await start.click();
      await page.waitForFunction(() => MidrollPanelHost.shadowRoot.getElementById('stop').hidden);
      assert.equal(await status.getAttribute('data-tone'), 'success', await status.innerText());
      assert.deepEqual(await values(), ['0:20:00', '3:00:00', '9:40:00', '1:00:00', '5:00:00', '7:00:00', '9:00:00']);
      assert.deepEqual(await page.evaluate(() => [fixture.clicks, fixture.deletes, fixture.saves]), [4, 0, 0]);
      assert.equal(await page.locator('#automatic').isChecked(), true);
    });
    await scenario('actual timeline is independent of the input and every rerender inserts at its real cursor', async () => {
      await timeline();
      await page.evaluate(() => { fixture.rerender = true; });
      await preview(); await start.click();
      await page.waitForFunction(() => MidrollPanelHost.shadowRoot.getElementById('stop').hidden);
      assert.equal(await status.getAttribute('data-tone'), 'success', await status.innerText());
      assert.deepEqual(await values(), ['0:20:00', '3:00:00', '9:40:00', '1:00:00', '5:00:00', '7:00:00', '9:00:00']);
      assert.deepEqual(await page.evaluate(() => [fixture.clicks, fixture.oldEdits || 0, fixture.deletes, fixture.saves]), [4, 0, 0, 0]);
      assert.equal(await page.locator('#automatic').isChecked(), true);
      const report = await page.evaluate(() => MidrollStudio.diagnostics().lastInsertion);
      assert.equal(report.phase, 'confirmed'); assert.equal(report.seek, 'confirmed');
      assert.equal(report.target, '00:09:00');
      assert.equal(report.fastIdentification, true); assert.ok(report.timings.confirmMs >= 400);
    });
    await scenario('fast identification still rejects a correct-looking point whose committed value later reverts', async () => {
      await timeline();
      await page.evaluate(() => {
        const original = addRow;
        globalThis.addRow = (time, old) => {
          const row = original(time, old);
          if (!old) row.querySelector('input').addEventListener('change', () => setTimeout(() => { row.querySelector('input').value = '0:00:00'; }, 50));
          return row;
        };
        const wait = MidrollWait.waitFor;
        MidrollWait.waitFor = (check, options) => wait(check, { ...options, timeout: Math.min(options?.timeout || 6000, 900) });
      });
      await preview(); await start.click(); await page.waitForFunction(() => MidrollPanelHost.shadowRoot.getElementById('stop').hidden);
      assert.equal(await status.getAttribute('data-tone'), 'error');
      assert.equal(await page.evaluate(() => MidrollStudio.diagnostics().lastInsertion.fastIdentification), true);
      assert.deepEqual(await page.evaluate(() => [fixture.clicks, fixture.oldEdits || 0, fixture.deletes, fixture.saves]), [1, 0, 0, 0]);
    });
    await scenario('unconfirmed actual timeline movement stops before creating a duplicate slot', async () => {
      await timeline(true);
      await preview(); await start.click();
      await page.waitForFunction(() => MidrollPanelHost.shadowRoot.getElementById('stop').hidden);
      assert.match(await status.innerText(), /vị trí thanh thời gian trước khi chèn/);
      assert.deepEqual(await page.evaluate(() => [fixture.clicks, fixture.oldEdits || 0, fixture.saves]), [0, 0, 0]);
    });
    await scenario('rerender with an ambiguous duplicate cursor slot never edits an old slot or clicks again', async () => {
      await page.evaluate(() => {
        fixture.rerender = true; fixture.provisionalTime = '0:20:00';
        const wait = MidrollWait.waitFor;
        MidrollWait.waitFor = (check, options) => wait(check, options?.timeoutMessage ? { ...options, timeout: 900 } : options);
      });
      await preview(); await start.click();
      await page.waitForFunction(() => MidrollPanelHost.shadowRoot.getElementById('stop').hidden);
      assert.match(await status.innerText(), /mốc 00:01:00.*vị trí thanh thời gian 0:20:00/s);
      assert.deepEqual(await values(), ['0:20:00', '3:00:00', '9:40:00', '0:20:00']);
      assert.deepEqual(await page.evaluate(() => [fixture.clicks, fixture.oldEdits || 0, fixture.deletes, fixture.saves]), [1, 0, 0, 0]);
      const report = await page.evaluate(() => MidrollStudio.diagnostics().lastInsertion);
      assert.equal(report.phase, 'identify'); assert.equal(report.extraTime, '0:20:00');
      assert.equal(report.newInputCount, 4); assert.equal(report.seek, 'seek-unavailable');
    });
    await scenario('continue after 171 populated points with duplicates and a rerendering independent timeline', async () => {
      await page.evaluate(() => {
        fixture.previewDuration = 1840;
        document.querySelector('.duration').textContent = '30:40';
        for (let i = 0; i < 171; i++) addRow(MidrollPlanner.formatStudioTime(60 + i * 10, '0:00:00'), true);
        fixture.rerender = true;
      });
      await timeline(); await input.fill('10');
      const old = await values();
      await preview(); await start.click();
      await page.waitForFunction(() => MidrollPanelHost.shadowRoot.getElementById('stop').hidden);
      assert.equal(await status.getAttribute('data-tone'), 'success', await status.innerText());
      assert.deepEqual(await values(), [...old, '29:30:00', '29:40:00']);
      assert.deepEqual(await page.evaluate(() => [fixture.clicks, fixture.oldEdits || 0, fixture.deletes, fixture.saves]), [2, 0, 0, 0]);
      assert.equal(await page.locator('#automatic').isChecked(), true);
      await preview(); assert.equal(await start.isDisabled(), true);
    });
    await scenario('opaque existing row prevents all insertion', async () => {
      await page.locator('.ad-row input').first().evaluate((node) => { node.value = 'unknown'; });
      await preview();
      assert.match(await status.innerText(), /Không đọc được toàn bộ/);
      assert.equal(await start.isDisabled(), true);
      assert.equal(await page.evaluate(() => fixture.clicks), 0);
    });
    await scenario('stale preview stops before mutating', async () => {
      await preview();
      await page.locator('.ad-row input').first().fill('0:21:00');
      await start.click();
      assert.match(await status.innerText(), /Xem trước lại/);
      assert.equal(await page.evaluate(() => fixture.clicks), 0);
    });
    await scenario('interval validation and invalidation', async () => {
      await preview();
      await input.fill('0');
      assert.equal(await start.isDisabled(), true);
      await preview();
      assert.match(await status.innerText(), /số giây nguyên lớn hơn 0/);
      await input.fill('1.5');
      await preview();
      assert.match(await status.innerText(), /số giây nguyên lớn hơn 0/);
    });
    await scenario('duration automatically loads on panel opening, with no duration input', async () => {
      assert.equal(await page.locator('#midroll-helper-host').locator('input#duration').count(), 0);
      assert.equal(await page.locator('#midroll-helper-host').locator('output#duration').innerText(), '00:10:00');
      assert.ok(await page.evaluate(() => fixture.durationReads > 0));
      assert.equal(await page.evaluate(() => fixture.clicks), 0);
      await preview();
      assert.equal(await start.isDisabled(), false);
    }, '?metadata=600');
    await scenario('stop while insertion is awaiting Studio does not attempt another insertion', async () => {
      await page.evaluate(() => { fixture.delay = 600; });
      await preview();
      await start.click();
      await page.waitForFunction(() => fixture.clicks === 1);
      await page.locator('#midroll-helper-host').locator('#stop').click();
      await page.waitForFunction(() => globalThis.MidrollPanelHost.shadowRoot.getElementById('stop').hidden);
      assert.match(await status.innerText(), /Đã dừng theo yêu cầu/);
      assert.equal(await page.evaluate(() => fixture.clicks), 1);
      assert.equal(await page.evaluate(() => fixture.saves), 0);
    });
    await scenario('closing editor aborts processing before insertion', async () => {
      await preview();
      await page.locator('#editor').evaluate((node) => { node.hidden = true; });
      await start.click();
      assert.match(await status.innerText(), /đóng trình quảng cáo/);
      assert.equal(await page.evaluate(() => fixture.clicks), 0);
    });
    await scenario('error information is hidden normally and copied only by a click without private page text', async () => {
      await page.locator('body > main').evaluate((node) => node.insertAdjacentHTML('beforebegin', '<p>private-account@example.com</p>'));
      const copy = page.locator('#midroll-helper-host').locator('#copy-error');
      assert.equal(await page.locator('#midroll-helper-host').locator('#advanced').count(), 0);
      assert.equal(await copy.isVisible(), false);
      await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { async writeText(text) { fixture.copied = text; } } }); });
      await input.fill('0'); await preview();
      assert.equal(await copy.isVisible(), true); assert.equal(await page.evaluate(() => fixture.copied), undefined);
      await copy.click();
      await page.waitForFunction(() => Boolean(fixture.copied));
      const data = await page.evaluate(() => fixture.copied);
      assert.ok(data.includes('Chèn vị trí quảng cáo'));
      assert.ok(!data.includes('private-account'));
      assert.ok(!data.includes('test123'));
      assert.equal(await page.locator('#midroll-helper-host').locator('#error-details').isVisible(), false);
      await input.fill('120'); await preview();
      assert.equal(await copy.isVisible(), false);
    });
    await scenario('blocked clipboard shows selectable error text and preserves the original error', async () => {
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { async writeText() { throw Error('denied'); } } });
        document.execCommand = () => false;
      });
      await input.fill('0'); await preview(); const original = await status.innerText();
      await page.locator('#midroll-helper-host').locator('#copy-error').click();
      const field = page.locator('#midroll-helper-host').locator('#error-details');
      await field.waitFor({ state: 'visible' });
      assert.ok((await field.inputValue()).includes(original));
      assert.equal(await status.innerText(), original);
      assert.equal(await field.evaluate((node) => node.selectionEnd - node.selectionStart), (await field.inputValue()).length);
      await page.evaluate(() => { navigator.clipboard.writeText = async (text) => { fixture.copied = text; }; });
      await page.locator('#midroll-helper-host').locator('#copy-error').click();
      await page.waitForFunction(() => Boolean(fixture.copied));
      assert.equal(await field.isVisible(), false);
      await input.fill('120'); await preview(); assert.equal(await field.isVisible(), false);
    });
    await scenario('a delayed clipboard failure cannot show an old report over a recovered panel', async () => {
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText() { return new Promise((resolve, reject) => { fixture.rejectCopy = reject; }); } } });
        document.execCommand = () => false;
      });
      await input.fill('0'); await preview();
      await page.locator('#midroll-helper-host').locator('#copy-error').click();
      await page.waitForFunction(() => Boolean(fixture.rejectCopy));
      await input.fill('120'); await preview();
      await page.evaluate(() => fixture.rejectCopy(Error('late failure')));
      assert.equal(await page.locator('#midroll-helper-host').locator('#error-details').isVisible(), false);
      assert.equal(await page.locator('#midroll-helper-host').locator('#copy-error').isVisible(), false);
    });
    await scenario('a video with no ad editor shows instructions and recovers when the editor opens', async () => {
      await page.evaluate(() => {
        document.body.append(MidrollPanelHost);
        fixture.stashedEditor = document.getElementById('editor'); fixture.stashedEditor.remove();
        MidrollRefreshDuration();
      });
      await ready();
      assert.equal(await page.locator('#midroll-helper-host').isVisible(), true);
      assert.match(await status.innerText(), /Kiếm tiền.*Quản lý vị trí quảng cáo/);
      assert.equal(await status.getAttribute('data-tone'), '');
      assert.equal(await start.isDisabled(), true);
      assert.equal(await page.locator('#midroll-helper-host').locator('#copy-error').isVisible(), false);
      assert.equal(await page.evaluate(() => fixture.clicks), 0);
      await page.evaluate(() => document.querySelector('main').append(fixture.stashedEditor));
      await preview(); assert.equal(await start.isDisabled(), false);
    });
    await scenario('controls in open shadow roots are read and edited', async () => {
      await page.evaluate(() => {
        const editor = document.getElementById('editor');
        const wrapper = document.createElement('div');
        wrapper.id = 'shadow-container';
        editor.replaceWith(wrapper);
        wrapper.attachShadow({ mode: 'open' }).append(editor);
      });
      // Fixture insertion handlers use document.getElementById; adapt only
      // the fixture's insert button to the equivalent shadow-contained UI.
      await page.locator('#insert').evaluate((node) => {
        const replacement = node.cloneNode(true);
        node.replaceWith(replacement);
        replacement.addEventListener('click', () => {
          fixture.clicks++;
          const scope = replacement.getRootNode();
          const row = document.createElement('div');
          row.className = 'ad-row';
          row.innerHTML = '<input aria-label="Thời gian bắt đầu quảng cáo"><button aria-label="Xóa vị trí quảng cáo">Xóa</button>';
          row.querySelector('input').value = scope.getElementById('playhead').value;
          scope.getElementById('list').append(row);
        });
      });
      await preview();
      await start.click();
      await page.waitForFunction(() => globalThis.MidrollPanelHost.shadowRoot.getElementById('status').dataset.tone === 'success');
      assert.equal((await values()).length, 7);
      assert.equal(await page.evaluate(() => fixture.saves), 0);
    });
    await scenario('indexed rows handle nested Polymer buttons and per-field shadow roots', async () => {
      await page.evaluate(() => {
        for (const row of document.querySelectorAll('.ad-row')) {
          const field = row.querySelector('input');
          const host = document.createElement('ytcp-text-input');
          field.replaceWith(host); host.attachShadow({ mode: 'open' }).append(field);
          const remove = row.querySelector('button');
          const wrapper = document.createElement('ytcp-button');
          wrapper.setAttribute('aria-label', 'Xóa vị trí quảng cáo');
          remove.replaceWith(wrapper); wrapper.append(remove);
        }
      });
      await preview(); await start.click();
      await page.waitForFunction(() => MidrollPanelHost.shadowRoot.getElementById('stop').hidden);
      assert.equal(await status.getAttribute('data-tone'), 'success', await status.innerText());
      // Deep selector results group shadow descendants separately from light
      // DOM nodes. Preserve values/counts rather than assume traversal order.
      assert.deepEqual((await values()).sort(), ['0:20:00', '3:00:00', '9:40:00', '1:00:00', '5:00:00', '7:00:00', '9:00:00'].sort());
      assert.deepEqual(await page.evaluate(() => [fixture.clicks, fixture.oldEdits || 0, fixture.deletes, fixture.saves]), [4, 0, 0, 0]);
    });
    await scenario('multiple time fields sharing one delete control remain unsupported before mutation', async () => {
      await page.evaluate(() => {
        const extra = document.createElement('input'); extra.value = '0:21:00';
        document.querySelector('.ad-row').append(extra);
      });
      await preview();
      assert.match(await status.innerText(), /Không đọc được toàn bộ/);
      assert.equal(await start.isDisabled(), true); assert.equal(await page.evaluate(() => fixture.clicks), 0);
    });
    await scenario('real keyboard typing survives a document capture focus trap and Studio shortcuts', async () => {
      await page.evaluate(() => {
        const dialog = document.getElementById('editor');
        fixture.keysIntercepted = 0;
        document.addEventListener('focusin', (event) => {
          if (!dialog.contains(event.target)) document.getElementById('playhead').focus();
        }, true);
        document.addEventListener('keydown', (event) => {
          fixture.keysIntercepted++;
          if (/\d/.test(event.key)) event.preventDefault();
        });
      });
      await page.locator('#playhead').click();
      await input.click();
      await page.keyboard.press('Control+A');
      await page.keyboard.type('90');
      assert.equal(await input.inputValue(), '90');
      assert.equal(await page.locator('#playhead').inputValue(), '0:00:00');
      assert.equal(await page.evaluate(() => fixture.keysIntercepted), 0);
      await preview();
      assert.equal(await start.isDisabled(), false);
    });
    await scenario('native modal dialog allows keyboard entry without disabling Studio', async () => {
      await page.locator('#editor').evaluate((editor) => {
        const modal = document.createElement('dialog');
        modal.id = editor.id;
        modal.setAttribute('aria-label', 'Quản lý vị trí quảng cáo');
        modal.append(...editor.childNodes);
        editor.replaceWith(modal);
        modal.showModal();
      });
      await page.locator('#playhead').click();
      await input.click();
      await page.keyboard.press('Control+A');
      await page.keyboard.type('150');
      assert.equal(await input.inputValue(), '150');
      assert.equal(await page.locator('#automatic').isEnabled(), true);
      await preview();
      assert.equal(await start.isDisabled(), false);
    });
    await scenario('panel remounts inside a dialog opened after the extension', async () => {
      await page.evaluate(() => {
        const host = globalThis.MidrollPanelHost;
        document.body.append(host);
        document.getElementById('editor').append(document.createElement('span'));
      });
      await page.waitForFunction(() => globalThis.MidrollPanelHost.parentElement === document.getElementById('editor'));
      assert.equal(await input.isEnabled(), true);
    });
    await scenario('nested current/total frame timecode is read as total video length', async () => {
      await page.locator('.duration').evaluate((node) => {
        node.outerHTML = '<span id="time-display"><span>00:00:00:00</span> / <span>00:10:00:00</span></span>';
      });
      await preview();
      assert.match(await page.locator('#midroll-helper-host').locator('#summary').innerText(), /00:10:00/);
      assert.equal(await start.isDisabled(), false);
    });
    await scenario('accessible duration label is read and never mistaken for the playhead', async () => {
      await page.locator('.duration').evaluate((node) => {
        node.outerHTML = '<input id="duration-metadata" aria-label="Thời lượng video" value="10:00" readonly>';
      });
      await preview();
      await start.click();
      await page.waitForFunction(() => globalThis.MidrollPanelHost.shadowRoot.getElementById('status').dataset.tone === 'success');
      assert.equal(await page.locator('#duration-metadata').inputValue(), '10:00');
      assert.equal(await page.evaluate(() => fixture.saves), 0);
    });
    await scenario('labeled duration text and player duration outside dialog are supported', async () => {
      await page.locator('.duration').evaluate((node) => { node.textContent = 'Thời lượng: 10:00'; });
      await preview();
      assert.equal(await start.isDisabled(), false);
      await page.locator('.duration').evaluate((node) => node.remove());
      await page.locator('body').evaluate((node) => node.insertAdjacentHTML('afterbegin', '<span class="ytp-time-duration">10:00</span>'));
      await preview();
      assert.equal(await start.isDisabled(), false);
    });
    await scenario('unrelated times are never used as duration; no manual entry is requested', async () => {
      await page.locator('.duration').evaluate((node) => node.remove());
      const message = await page.evaluate(async () => {
        try { await MidrollStudio.createAdapter({ timeout: 150 }); return ''; } catch (error) { return error.message; }
      });
      assert.match(message, /Studio chưa cung cấp được tổng độ dài/);
      assert.ok(!/nhập|điền/i.test(message));
      assert.equal(await start.isDisabled(), true);
      assert.equal(await page.evaluate(() => fixture.clicks), 0);
    });
    await scenario('direct interval entry invalidates preview and remains stable without stepper buttons', async () => {
      assert.equal(await input.getAttribute('type'), 'text');
      assert.equal(await page.locator('#midroll-helper-host').locator('#increase, #decrease').count(), 0);
      await preview();
      await input.fill('121');
      assert.equal(await start.isDisabled(), true);
      await page.waitForTimeout(800);
      assert.equal(await input.inputValue(), '121');
      await input.fill('1');
      await input.press('Tab');
      assert.equal(await input.inputValue(), '1');
    });
    await scenario('holding arrow keys in the plain interval field never changes the number', async () => {
      await input.click();
      await page.keyboard.down('ArrowUp');
      await page.keyboard.down('ArrowUp');
      await page.waitForTimeout(500);
      await page.keyboard.up('ArrowUp');
      await input.press('ArrowDown');
      assert.equal(await input.inputValue(), '120');
      assert.equal(await page.evaluate(() => fixture.clicks), 0);
    });
    await scenario('507-second player overrides an incorrect UI clock; 1:07:17 remains unchanged', async () => {
      await page.locator('.duration').evaluate((node) => { node.textContent = '0:20:00'; });
      await page.locator('.ad-row input').first().fill('1:07:17');
      await page.locator('.ad-row input').last().fill('7:45:00');
      await metadata();
      await preview();
      assert.match(await page.locator('#midroll-helper-host').locator('#summary').innerText(), /00:08:27 \(tự động\)/);
      assert.equal(await page.locator('#midroll-helper-host').locator('#duration').innerText(), '00:08:27');
      assert.deepEqual(await page.locator('#midroll-helper-host').locator('#times li').allTextContents(), ['00:01:00', '00:05:00', '00:07:00']);
      await start.click();
      await page.waitForFunction(() => globalThis.MidrollPanelHost.shadowRoot.getElementById('status').dataset.tone === 'success');
      assert.deepEqual(await values(), ['1:07:17', '3:00:00', '7:45:00', '1:00:00', '5:00:00', '7:00:00']);
      assert.deepEqual(await page.evaluate(() => [fixture.deletes, fixture.saves]), [0, 0]);
      assert.equal(await page.locator('#automatic').isChecked(), true);
    });
    await scenario('conflicting identity-checked metadata blocks insertion despite an available clock', async () => {
      await metadata();
      await page.evaluate(() => { document.getElementById('movie_player').video = { videoId: 'test123', lengthSeconds: '600' }; });
      const message = await page.evaluate(async () => {
        try { await MidrollStudio.createAdapter({ timeout: 150 }); return ''; } catch (error) { return error.message; }
      });
      assert.match(message, /Các nguồn Studio báo độ dài video khác nhau/);
      assert.deepEqual(await page.evaluate(() => [fixture.clicks, fixture.deletes, fixture.saves]), [0, 0, 0]);
    });
    await scenario('automatic three-part Studio length reads 8:27:17 as eight minutes', async () => {
      await page.locator('.duration').evaluate((node) => { node.textContent = '8:27:17'; });
      await page.locator('.ad-row input').last().fill('7:45:00');
      await preview();
      assert.equal(await start.isDisabled(), false);
      assert.match(await page.locator('#midroll-helper-host').locator('#summary').innerText(), /00:08:27/);
      assert.ok(!(await page.locator('#midroll-helper-host').locator('#summary').innerText()).includes('bạn nhập'));
    });
    await scenario('genuinely out-of-range existing point blocks with the automatically read length', async () => {
      await page.locator('.ad-row input').last().fill('9:00:00');
      await metadata();
      await preview();
      assert.equal(await start.isDisabled(), true);
      assert.match(await status.innerText(), /9:00:00.*00:09:00.*00:08:27 đọc từ Studio/);
      assert.deepEqual(await page.evaluate(() => [fixture.clicks, fixture.deletes, fixture.saves]), [0, 0, 0]);
    });
    await scenario('metadata loading is retried automatically without user input', async () => {
      assert.equal(await page.locator('#midroll-helper-host').locator('#duration').innerText(), '00:10:00');
      assert.ok(await page.evaluate(() => fixture.durationReads >= 2));
      assert.equal(await page.evaluate(() => fixture.clicks), 0);
    }, '?delayed=600');
    await scenario('same-video explicit metadata in a shadow component is read without a visible clock', async () => {
      await page.locator('.duration').evaluate((node) => node.remove());
      await page.evaluate(() => {
        const wrapper = document.createElement('div');
        document.body.prepend(wrapper);
        const player = document.createElement('ytcp-video-player');
        player.video = { videoId: 'test123', durationMs: 600000 };
        wrapper.attachShadow({ mode: 'open' }).append(player);
      });
      await preview();
      assert.equal(await start.isDisabled(), false);
      assert.equal(await page.locator('#midroll-helper-host').locator('#duration').innerText(), '00:10:00');
    });
    await scenario('a player for another video cannot provide duration', async () => {
      await page.locator('.duration').evaluate((node) => node.remove());
      await metadata(507, 'other');
      const message = await page.evaluate(async () => {
        try { await MidrollStudio.createAdapter({ timeout: 150 }); return ''; } catch (error) { return error.message; }
      });
      assert.match(message, /Studio còn dữ liệu của video khác/);
      assert.equal(await page.evaluate(() => fixture.clicks), 0);
    });
    await scenario('duration unavailable times out with retry guidance and zero changes', async () => {
      await page.locator('.duration').evaluate((node) => node.remove());
      await preview();
      assert.equal(await page.locator('#midroll-helper-host').locator('#duration').innerText(), 'Chưa đọc được');
      assert.equal(await start.isDisabled(), true);
      assert.match(await status.innerText(), /tải lại tab/);
      assert.ok(!/hãy nhập/i.test(await status.innerText()));
      assert.equal(await page.evaluate(() => fixture.clicks), 0);
    });
    await scenario('canceling an automatic read ignores late results', async () => {
      await page.locator('.duration').evaluate((node) => node.remove());
      await page.evaluate(() => { chrome.runtime.sendMessage = async () => { await new Promise((r) => setTimeout(r, 500)); return { videoId: 'test123', seconds: 600 }; }; });
      await read.click();
      await page.locator('#midroll-helper-host').locator('#close').click();
      await page.waitForTimeout(700);
      assert.equal(await page.evaluate(() => MidrollPanelHost.hidden), true);
      assert.equal(await start.isDisabled(), true);
      assert.equal(await page.evaluate(() => fixture.clicks), 0);
    });
    await scenario('an ad timestamp with a duration label is excluded from video length', async () => {
      await page.locator('.duration').evaluate((node) => node.remove());
      await page.locator('.ad-row input').first().evaluate((node) => { node.className = 'duration'; node.setAttribute('aria-label', 'Thời lượng'); });
      const message = await page.evaluate(async () => {
        try { await MidrollStudio.createAdapter({ timeout: 150 }); return ''; } catch (error) { return error.message; }
      });
      assert.match(message, /Studio chưa cung cấp được tổng độ dài/);
      assert.equal(await page.evaluate(() => fixture.clicks), 0);
    });
    await scenario('navigation clears the old length and automatically reads the new video', async () => {
      await preview();
      await page.evaluate(() => {
        document.querySelector('.duration').remove();
        const player = document.createElement('div');
        player.id = 'movie_player';
        player.getVideoData = () => ({ video_id: 'newvideo' });
        player.getDuration = () => 660;
        history.pushState({}, '', '/video/newvideo/monetization');
        document.body.prepend(player);
      });
      await page.waitForFunction(() => MidrollPanelHost.shadowRoot.getElementById('duration').textContent === '00:11:00');
      assert.equal(await start.isDisabled(), true);
      assert.equal(await page.evaluate(() => fixture.clicks), 0);
    });
    await scenario('leaving a video route cannot reuse the old editor duration', async () => {
      await page.evaluate(() => { history.pushState({}, '', '/channel/test/videos'); document.body.append(document.createElement('span')); });
      await page.waitForFunction(() => MidrollPanelHost.shadowRoot.getElementById('duration').textContent === 'Chưa đọc được');
      assert.equal(await start.isDisabled(), true);
      assert.match(await status.innerText(), /Hãy mở một video/);
    });
    await scenario('missing native focus events cannot falsely confirm a transient ad value', async () => {
      await page.locator('#playhead').evaluate((node) => node.remove());
      await page.evaluate(() => {
        fixture.commitOnFocusout = true;
        // Model the missing element focus events of an inactive document.
        HTMLInputElement.prototype.focus = function () {};
        HTMLInputElement.prototype.blur = function () {};
      });
      await preview();
      await start.click();
      await page.waitForFunction(() => MidrollPanelHost.shadowRoot.getElementById('status').dataset.tone === 'success');
      await page.waitForTimeout(100);
      assert.deepEqual(await values(), ['0:20:00', '3:00:00', '9:40:00', '1:00:00', '5:00:00', '7:00:00', '9:00:00']);
      assert.deepEqual(await page.evaluate(() => [fixture.clicks, fixture.deletes, fixture.saves]), [4, 0, 0]);
    });
    await scenario('hidden renderer resumes from the pending point without skipping or duplicating', async () => {
      await page.evaluate(() => {
        fixture.delay = 350;
        fixture.hidden = false;
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => fixture.hidden });
      });
      await preview();
      await start.click();
      await page.waitForFunction(() => fixture.clicks === 1);
      await page.evaluate(() => { fixture.hidden = true; document.dispatchEvent(new Event('visibilitychange')); });
      await page.waitForTimeout(800);
      assert.equal(await page.evaluate(() => fixture.clicks), 1);
      assert.match(await status.innerText(), /Tab Studio đang ẩn/);
      await page.evaluate(() => { fixture.hidden = false; document.dispatchEvent(new Event('visibilitychange')); });
      await page.waitForFunction(() => MidrollPanelHost.shadowRoot.getElementById('status').dataset.tone === 'success');
      assert.deepEqual(await values(), ['0:20:00', '3:00:00', '9:40:00', '1:00:00', '5:00:00', '7:00:00', '9:00:00']);
      assert.deepEqual(await page.evaluate(() => [fixture.clicks, fixture.deletes, fixture.saves]), [4, 0, 0]);
    });
    await scenario('actual Chrome freeze longer than six seconds resumes the same insertion', async () => {
      const cdp = await page.context().newCDPSession(page);
      await page.evaluate(() => { fixture.delay = 500; });
      await preview();
      await start.click();
      await page.waitForFunction(() => fixture.clicks === 1);
      try {
        await cdp.send('Page.setWebLifecycleState', { state: 'frozen' });
        await new Promise((resolve) => setTimeout(resolve, 6500));
      } finally {
        await cdp.send('Page.setWebLifecycleState', { state: 'active' });
        await cdp.detach();
      }
      await page.waitForFunction(() => MidrollPanelHost.shadowRoot.getElementById('status').dataset.tone === 'success');
      assert.deepEqual(await values(), ['0:20:00', '3:00:00', '9:40:00', '1:00:00', '5:00:00', '7:00:00', '9:00:00']);
      assert.deepEqual(await page.evaluate(() => [fixture.clicks, fixture.deletes, fixture.saves]), [4, 0, 0]);
    });
    await scenario('inactive window continues inserting while the page renderer is available', async () => {
      await page.evaluate(() => { Object.defineProperty(document, 'hasFocus', { configurable: true, value: () => false }); });
      await preview();
      await start.click();
      await page.waitForFunction(() => MidrollPanelHost.shadowRoot.getElementById('status').dataset.tone === 'success');
      assert.deepEqual(await values(), ['0:20:00', '3:00:00', '9:40:00', '1:00:00', '5:00:00', '7:00:00', '9:00:00']);
      assert.equal(await page.evaluate(() => fixture.clicks), 4);
      assert.equal(await page.locator('#automatic').isChecked(), true);
    });
    await scenario('background guard: rejected ad value stops with an error instead of silent success', async () => {
      await page.evaluate(() => { fixture.wrongTime = true; });
      await preview();
      await start.click();
      await page.waitForFunction(() => MidrollPanelHost.shadowRoot.getElementById('stop').hidden);
      assert.equal(await page.locator('#midroll-helper-host').locator('#status').getAttribute('data-tone'), 'error');
      assert.match(await status.innerText(), /Studio chưa xác nhận mốc/);
      assert.deepEqual(await page.evaluate(() => [fixture.clicks, fixture.deletes, fixture.saves]), [1, 0, 0]);
      assert.deepEqual((await values()).slice(0, 3), ['0:20:00', '3:00:00', '9:40:00']);
    });
    await scenario('background guard: cancel while hidden never attempts another ad insertion', async () => {
      await page.evaluate(() => {
        fixture.delay = 350;
        fixture.hidden = false;
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => fixture.hidden });
      });
      await preview();
      await start.click();
      await page.waitForFunction(() => fixture.clicks === 1);
      await page.evaluate(() => { fixture.hidden = true; document.dispatchEvent(new Event('visibilitychange')); });
      await page.waitForTimeout(500);
      await page.locator('#midroll-helper-host').locator('#stop').click();
      await page.waitForFunction(() => MidrollPanelHost.shadowRoot.getElementById('stop').hidden);
      assert.match(await status.innerText(), /Đã dừng theo yêu cầu/);
      assert.deepEqual(await page.evaluate(() => [fixture.clicks, fixture.deletes, fixture.saves]), [1, 0, 0]);
    });
    await scenario('background session failure prevents any insertion', async () => {
      await page.evaluate(() => { fixture.backgroundStartError = 'Không có quyền debugger'; });
      await preview(); await start.click();
      await page.waitForFunction(() => MidrollPanelHost.shadowRoot.getElementById('stop').hidden);
      assert.match(await status.innerText(), /Không có quyền debugger/);
      assert.deepEqual(await page.evaluate(() => [fixture.clicks, fixture.deletes, fixture.saves]), [0, 0, 0]);
    });
    await scenario('Chrome cancelling the background session aborts before another insertion', async () => {
      await page.evaluate(() => { fixture.delay = 500; });
      await preview(); await start.click();
      await page.waitForFunction(() => fixture.clicks === 1);
      await page.evaluate(() => fixture.messageListener({ type: 'MIDROLL_BACKGROUND_LOST', runId: fixture.backgroundRunId, message: 'Chrome đã ngắt phiên chạy nền' }));
      await page.waitForFunction(() => MidrollPanelHost.shadowRoot.getElementById('stop').hidden);
      assert.match(await status.innerText(), /Chrome đã ngắt phiên chạy nền/);
      assert.equal(await page.evaluate(() => fixture.clicks), 1);
      assert.equal(await page.evaluate(() => fixture.backgroundRunId), null);
    });
    await scenario('background session is released after successful insertion', async () => {
      await preview(); await start.click();
      await page.waitForFunction(() => MidrollPanelHost.shadowRoot.getElementById('status').dataset.tone === 'success');
      assert.deepEqual(await page.evaluate(() => fixture.backgroundRequests), ['MIDROLL_BACKGROUND_START', 'MIDROLL_BACKGROUND_STOP']);
      assert.equal(await page.evaluate(() => fixture.backgroundRunId), null);
    });
    await scenario('stop during background startup never inserts after a late success reply', async () => {
      await page.evaluate(() => {
        globalThis.backgroundMessage = async (message) => {
          if (message.type === 'MIDROLL_BACKGROUND_START') { await new Promise((r) => setTimeout(r, 500)); return { ok: true, runId: message.runId }; }
          return { ok: true };
        };
      });
      await preview(); await start.click();
      await page.locator('#midroll-helper-host').locator('#stop').click();
      await page.waitForFunction(() => MidrollPanelHost.shadowRoot.getElementById('stop').hidden);
      assert.match(await status.innerText(), /Đã dừng theo yêu cầu/);
      assert.equal(await page.evaluate(() => fixture.clicks), 0);
    });
    await scenario('audit: readonly automatic slots without delete buttons are read, preserved and never used as playhead controls', async () => {
      await page.evaluate(() => {
        const row = document.querySelector('.ad-row'); row.setAttribute('data-ad-type', 'automatic'); row.querySelector('input').readOnly = true;
        row.querySelector('button').remove();
      });
      await preview(); assert.equal(await start.isDisabled(), false);
      await start.click(); await page.waitForFunction(() => MidrollPanelHost.shadowRoot.getElementById('stop').hidden);
      assert.equal(await status.getAttribute('data-tone'), 'success', await status.innerText());
      assert.deepEqual(await values(), ['0:20:00', '3:00:00', '9:40:00', '1:00:00', '5:00:00', '7:00:00', '9:00:00']);
      assert.deepEqual(await page.evaluate(() => [fixture.oldEdits || 0, fixture.deletes, fixture.saves, document.getElementById('automatic').checked]), [0, 0, 0, true]);
    });
    await scenario('audit: ordinary HTML5 player hour/minute/second readout is not parsed as a Studio frame field', async () => {
      await page.locator('.duration').evaluate((node) => { node.outerHTML = '<span class="ytp-time-display">00:01:00 / 00:10:00</span>'; });
      await preview(); assert.equal(await start.isDisabled(), false);
      assert.equal(await page.locator('#midroll-helper-host').locator('#duration').innerText(), '00:10:00');
    });
    await scenario('audit: changing the automatic setting after preview blocks before insertion', async () => {
      await preview(); await page.locator('#automatic').uncheck(); await start.click();
      await page.waitForFunction(() => MidrollPanelHost.shadowRoot.getElementById('stop').hidden);
      assert.equal(await status.getAttribute('data-tone'), 'error'); assert.equal(await page.evaluate(() => fixture.clicks), 0);
    });
    await scenario('audit: a Studio side effect on the automatic setting stops after the first attempt without saving', async () => {
      await page.evaluate(() => document.getElementById('insert').addEventListener('click', () => { document.getElementById('automatic').checked = false; }));
      await preview(); await start.click(); await page.waitForFunction(() => MidrollPanelHost.shadowRoot.getElementById('stop').hidden);
      assert.equal(await status.getAttribute('data-tone'), 'error'); assert.match(await status.innerText(), /cài đặt quảng cáo tự động/);
      assert.deepEqual(await page.evaluate(() => [fixture.clicks, fixture.saves]), [1, 0]);
    });
    await scenario('audit: reopening the panel during a run preserves module identities and diagnostics', async () => {
      await page.evaluate(() => { fixture.delay = 300; }); await preview(); await start.click();
      await page.waitForFunction(() => fixture.clicks === 1);
      assert.equal(await page.evaluate(() => {
        const adapterModule = MidrollStudio, last = MidrollStudio.diagnostics().lastInsertion;
        return MidrollShowPanel() && MidrollStudio === adapterModule && MidrollStudio.diagnostics().lastInsertion === last;
      }), true);
      await page.waitForFunction(() => MidrollPanelHost.shadowRoot.getElementById('stop').hidden);
      assert.equal(await status.getAttribute('data-tone'), 'success', await status.innerText());
      assert.equal(await page.evaluate(() => fixture.clicks), 4);
    });
    await scenario('audit: partial lists declaring a larger set size stop before previewing changes', async () => {
      await page.evaluate(() => document.querySelector('.ad-row').setAttribute('aria-setsize', '20'));
      await preview(); assert.equal(await start.isDisabled(), true); assert.match(await status.innerText(), /một phần danh sách/);
      assert.equal(await page.evaluate(() => fixture.clicks + fixture.deletes + fixture.saves), 0);
    });
    await scenario('audit: known wrong-video metadata cannot fall back to the still-visible previous UI clock', async () => {
      await metadata(507, 'other');
      const message = await page.evaluate(async () => {
        try { await MidrollStudio.createAdapter({ timeout: 150 }); return ''; } catch (error) { return error.message; }
      });
      assert.match(message, /dữ liệu của video khác/); assert.equal(await page.evaluate(() => fixture.clicks), 0);
    });
    await scenario('audit: a newly automatic point cannot be edited as the requested manual insertion', async () => {
      await page.evaluate(() => {
        const old = document.getElementById('insert'), button = old.cloneNode(true); old.replaceWith(button);
        button.addEventListener('click', () => { fixture.clicks++; const row = addRow(document.getElementById('playhead').value, true); row.setAttribute('data-ad-type', 'automatic'); });
      });
      await preview(); await start.click(); await page.waitForFunction(() => MidrollPanelHost.shadowRoot.getElementById('stop').hidden);
      assert.equal(await status.getAttribute('data-tone'), 'error'); assert.match(await status.innerText(), /Điểm mới là điểm tự động/);
      assert.deepEqual(await page.evaluate(() => [fixture.clicks, fixture.oldEdits || 0, fixture.deletes, fixture.saves]), [1, 0, 0, 0]);
      assert.deepEqual(await values(), ['0:20:00', '3:00:00', '9:40:00', '1:00:00']);
    });
    assert.deepEqual(errors, [], 'no uncaught browser errors');
    await page.goto(fixture);
    await ready();
    await preview();
    await fs.mkdir(path.resolve(__dirname, '../artifacts'), { recursive: true });
    // Versioned names keep earlier releases' tracked screenshots unchanged.
    const version = JSON.parse(await fs.readFile(path.resolve(__dirname, '../extension/manifest.json'), 'utf8')).version;
    await page.screenshot({ path: path.resolve(__dirname, `../artifacts/preview-v${version}.png`) });
    console.log(`${passed} local browser scenarios passed. Live Studio acceptance is still pending.`);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
