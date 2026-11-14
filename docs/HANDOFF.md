# Bàn giao kỹ thuật cho Claude Code

Cập nhật ngày 14/11/2026. Làm việc tại thư mục gốc của repo, bản hiện tại là **0.1.21**: đã merge vào `main` và phát hành trên GitHub Releases. Người dùng đã nghiệm thu trên Studio đăng nhập ngày 05/11/2026 và báo đạt.

Ngày 14/11/2026 repo chuyển sang public. Lịch sử được viết lại để mọi commit dùng email noreply, nên `v0.1.21` và các commit sau đổi SHA; nội dung tệp không đổi. Repo cũ cùng hai PR của nó đã bị xoá khỏi GitHub; PR của repo hiện tại đánh số lại từ #1. Release được tạo lại trên repo mới với tệp đính kèm khớp SHA256.

## Trạng thái Git và tệp cần giữ

- Làm việc trực tiếp trong thư mục repo (không dùng worktree riêng), theo GitHub Flow: Issue, branch từ `main` mới nhất, PR có `Closes #số`, squash merge bằng email noreply. Ruleset buộc `main` đi qua PR có CI `checks` xanh, cấm force-push/xoá, và cấm xoá hoặc dời tag `v*`. Bản 0.1.20–0.1.21 được squash vào `main` thành commit `f104e3f` (tag `v0.1.21`); các commit lẻ của nhánh `release/0.1.21` không còn trên GitHub. [Remote GitHub](https://github.com/huriofly-work/youtube-midroll-manager)
- `extension/run-control.js` (mã chạy thật), `tests/run-control.test.cjs`, `tests/startup-browser.cjs`, `artifacts/STARTUP-FIX-0.1.21.md` và ảnh v0.1.20/v0.1.21 trong `artifacts/` đều đã được Git theo dõi. Trước khi sửa, đối chiếu bằng `git status --short --branch` và `git log --oneline main..HEAD`.
- `release/Chen-quang-cao-YouTube-v0.1.21.zip`, log kiểm thử và `.publish/` là dữ liệu cục bộ bị ignore. Ba ZIP 0.1.6, 0.1.10 và 0.1.13 được track để đo đối chứng. README trỏ sang tài khoản `huriofly-work`. ZIP mỗi bản phát hành đính kèm GitHub Release (public) cùng tệp SHA256SUMS, không commit vào Git.
- `.claude/settings.local.json` là quyền Claude Code riêng của máy người dùng, bị ignore. Quy tắc dùng chung cho mọi người mới đặt ở `.claude/settings.json` và commit.

## Sản phẩm và kiến trúc

Tiện ích Chrome Manifest V3 cho YouTube Studio tiếng Việt, xử lý một video đang mở ở trình chỉnh sửa vị trí quảng cáo. Dùng JavaScript thuần, HTML và CSS. Chrome tối thiểu 118 theo manifest. Người dùng xem trước, chạy chèn hoặc dọn, kiểm tra danh sách rồi tự bấm **Tiếp tục/Lưu** trong Studio. Tiện ích chạy trực tiếp từ `extension/`, không cần backend, bundler, API key, OAuth hoặc biến môi trường khi chạy.

| Thành phần | Vai trò |
| --- | --- |
| `extension/manifest.json`, `popup.{html,css,js}` | Điểm vào từ biểu tượng Chrome. Mở bảng trên tab video Studio đang hoạt động hoặc hiện hướng dẫn. |
| `background.js` → `content.js` | Service worker kiểm tra ngữ cảnh và nạp các script đóng gói theo thứ tự vào isolated world. Bảng dùng Shadow DOM, quản lý hai tab, cài đặt, preview, tiến độ và vòng đời lượt chạy. Mở lại bảng tái sử dụng instance hiện có. |
| `studio.js`, `duration-reader.js`, `playhead-controller.js` | Adapter đọc dialog, hàng quảng cáo và trạng thái tự động, thực hiện click/input và đọc lại. Service worker chỉ gọi các hàm MAIN world đóng gói để đọc thời lượng hoặc seek preview của video phù hợp. |
| `planner.js`, `runner.js`, `cleanup.js` | Lập kế hoạch chèn/dọn, kiểm fingerprint của preview, đối chiếu số lần xuất hiện của từng mốc, xác nhận từng thay đổi và kiểm tra cuối. |
| `run-control.js`, `wait.js` | Tạm dừng tại điểm xác nhận, kiểm fingerprint khi tiếp tục. Bộ chờ quan sát DOM và sự kiện, có ngân sách chờ foreground/background và hủy bằng `AbortSignal`. |
| `background-client.js`, `background-session.js` | Phiên CDP qua `chrome.debugger` để giữ tab hoạt động khi mất focus. Heartbeat, watchdog và xử lý điều hướng/detach kết thúc phiên. |
| `run-alerts.js`, `error-copy.js` | Theo dõi sự cố theo tab/video/run, hộp lỗi, dấu **!**, thông báo Chrome, mở lại sau F5, Để sau và sao chép chẩn đoán theo yêu cầu. |
| `tests/`, `.github/workflows/`, `artifacts/` | Kiểm thử Node, Playwright với Studio mô phỏng, kiểm tra API Chrome qua hồ sơ tạm, benchmark, CI và bằng chứng kiểm chứng. |

## Tính năng và quyết định cần giữ

- **Có mã chạy và kiểm thử cục bộ.** Chèn theo lưới giây, có đoạn đầu/cuối, giữ mọi mốc cũ, bỏ qua mốc trong ±1 giây quanh điểm có sẵn. Planner yêu cầu video từ 480 giây và giới hạn 1.000 mốc dự kiến. Ưu tiên thời lượng metadata đúng ID video, dùng nguồn UI có nhãn rõ khi phù hợp và dừng nếu nguồn mâu thuẫn. Giữ việc đọc tự động, không thêm ô thời lượng thủ công.
- **Có mã chạy và kiểm thử cục bộ.** Dọn chỉ chọn điểm xác định là thủ công. Xóa điểm thủ công Đang xem xét, có cảnh báo hoặc rơi vào đoạn đầu/cuối, sau đó xóa thêm các điểm thủ công còn lại quá gần. Giữ điểm thủ công phù hợp sớm hơn và xem điểm tự động ở cả hai phía là mốc cần bảo vệ. Giữ mọi điểm tự động và chưa rõ loại. Mỗi click xóa phải có đúng một thay đổi tương ứng. Tối đa 5 điểm dùng chung bước xác nhận ổn định khi phản hồi tức thời.
- **Có mã chạy và kiểm thử cục bộ.** Báo lỗi phân mức từ v0.1.18–0.1.19. Hộp đang được xem chặn thông báo trùng. Lỗi có nguy cơ ảnh hưởng dữ liệu có thể đưa đúng tab/cửa sổ lên trước. Cảnh báo dừng còn nhóm chưa xác nhận giữ dấu **!** và dùng mức nhẹ hơn. Để sau đồng bộ hộp và thông báo. Chrome từ chối icon SVG trong lần kiểm tra trước, nên thông báo dùng PNG.
- **Có mã chạy, kiểm thử cục bộ và nghiệm thu Studio (0.1.20–0.1.21).** Tạm dừng chờ xác nhận điểm chèn hoặc nhóm dọn hiện tại. Tiếp tục kiểm lại fingerprint. Nút Tạm dừng bị khóa ngay khi tác vụ chèn/dọn kết thúc vì không còn điểm dừng; `#run-state` giữ câu trạng thái, `#status` chỉ ghi số điểm đã xác nhận. Dừng/Hủy ngắt ngay, giữ các chỉnh sửa chưa lưu theo lựa chọn của người dùng. Bản 0.1.21 bắt lỗi từ lúc tạo run ID và bộ điều khiển ở cả hai luồng, giải phóng trạng thái bận và hủy preview cũ. Kiểm tra thứ tự nạp `run-control.js` ở cả đường mở từ popup và đường khôi phục sự cố khi thay đổi injection.
- **Ngoài phạm vi hiện tại.** Không có tự Lưu, tự chạy lại sau kết quả mơ hồ, hoàn tác, xử lý nhiều video hoặc phân tích âm thanh/chuyển cảnh. Theo rà soát trước, YouTube Data API công khai chưa có trường phù hợp trong `videos.update`. Gọi API nội bộ, ghi thẳng state, chèn song song và nút Xóa tất cả đã được cân nhắc rồi gác lại vì chưa chứng minh giữ dữ liệu an toàn. [Rà soát v0.1.14](../artifacts/AUDIT-0.1.14.md)
- **Bài học từ lỗi thực tế và fixture.** Chỉ sửa ô thời gian hiển thị không chứng minh playhead đã di chuyển. Focus/blur đơn giản từng cho kết quả giả rồi mất mốc sau khi Studio dựng lại DOM. Mã hiện tại seek rồi xác minh nếu đã nhận diện player. Nếu thiếu player hỗ trợ thì chỉ tiếp tục khi nhận diện được ô mới một cách chắc chắn. Khi các hàng dựng lại và mốc mới trùng mốc cũ, dừng nếu không phân biệt được; giữ đối chiếu số lần xuất hiện và cửa sổ ổn định 400 ms ở các bước xác nhận.
- **Yêu cầu giao diện.** Bảng làm việc chỉ hiện thông tin cần thao tác, gồm kế hoạch, tiến độ xác nhận và lý do lỗi/xóa. Đặt lịch sử thay đổi trong tài liệu, giữ bố cục dễ đọc khi cửa sổ hẹp.

## Bug, giới hạn và bảo mật

- **Startup v0.1.20.** Người dùng thấy `TypeError: Cannot read properties of undefined (reading 'create')`. Fixture tái hiện khi thiếu `MidrollRunControl`: lỗi nằm ngoài khối dọn trạng thái và bảng bị kẹt. Worker/tab giữ script cũ là một đường dẫn khả dĩ, trạng thái thật trên máy người dùng chưa xác minh. Bản 0.1.21 có bản sửa và hồi quy fixture. Sau cập nhật, giữ các chỉnh sửa Studio cần thiết rồi **Tải lại** extension, F5 Studio, kiểm tra bảng hiện v0.1.21 và Xem trước lại. Nếu Chrome vẫn hiện lỗi cũ, ghi nhận log rồi xóa log trong trang quản lý extension để phân biệt lỗi mới khi thử lại. [Phân tích lỗi](../artifacts/STARTUP-FIX-0.1.21.md)
- **Studio thật: người dùng nghiệm thu đạt ngày 05/11/2026.** Theo báo cáo của người dùng, seek, Chèn, Dọn, Tạm dừng/Tiếp tục, Dừng/Hủy và Lưu rồi mở lại đều đúng trên một video thử. [Chi tiết](../artifacts/VERIFICATION.md) Selector/nhãn tiếng Việt, icon không có nhãn, shadow root đóng, danh sách ảo và thứ tự sự kiện vẫn có thể đổi theo phiên bản Studio. Chưa xác nhận YouTube phân phát quảng cáo. Mốc hay nhóm đã click có thể còn dang dở khi timeout, hủy hoặc mất phiên. Việc đọc lại DOM chỉ xác nhận trạng thái cục bộ.
- **Thông báo Chrome thật.** Harness `test:alerts-native` từng đạt ở v0.1.19 nhưng bản 0.1.20 gặp `ReferenceError: chrome is not defined` ở `Runtime.evaluate` trước ca đầu. Thử chuyển sang worker context của Playwright bị chờ và đã dừng. Nguyên nhân gốc của harness chưa xác nhận. Toast Windows và khả năng luôn đưa Chrome lên trước còn thiếu nghiệm thu. [Bằng chứng theo phiên bản](../artifacts/VERIFICATION.md)
- **Ranh giới quyền.** Manifest khai báo `activeTab`, `scripting`, `storage`, `debugger`, `notifications`, không có quyền host rộng. `debugger` là quyền mạnh; giữ việc kiểm tra sender/frame/origin/video/run theo từng đường IPC, giới hạn CDP vào tab của lượt và giải phóng khi kết thúc. `storage.local` giữ cài đặt, `storage.session` giữ dữ liệu sự cố có định danh tab/video/run. Báo cáo chỉ sao chép khi người dùng yêu cầu. Qua đọc tĩnh các điểm vào chưa thấy tích hợp truyền chẩn đoán ra ngoài. Chưa chạy quét bảo mật hoặc audit phụ thuộc trong lượt này.
- **Nợ kiểm thử.** Phụ thuộc test được ghim bằng `package-lock.json`; repo chưa có script lint. Fixture và benchmark có thể ghi ảnh/JSON vào `artifacts/`, vài tên ảnh trùng với ảnh cũ đang track. Chạy trên bản sao tạm hoặc giữ bằng chứng hiện có trước khi chạy lại. CI chạy suite logic và sáu suite fixture, gồm startup; kiểm thử nền, API thật và benchmark chạy riêng. CI chạy khi push lên `main`, khi mở/cập nhật PR và khi chạy tay. PR chỉ đổi tệp `.md` hoặc tệp trong `docs/` bỏ qua bước cài và test, job `checks` vẫn báo đạt. Dependabot đề xuất cập nhật npm và GitHub Actions hằng tháng, mỗi loại gom thành một PR; PR cập nhật Playwright cần chạy lại fixture trước khi merge. Merge PR Dependabot trước các PR khác để khỏi phải cập nhật branch và chạy lại CI.

## Cài, chạy và kết quả ngày 05/11/2026

Chạy lệnh từ gốc dự án. CI khai báo Node 24 và Ubuntu 24.04. Lượt này dùng Node v26.13.0, npm 11.20.0 và có Chrome cài sẵn. README ghi Node 24 theo CI; lượt này chạy các lệnh trên Node 26.

| Việc | Lệnh hoặc cách chạy | Kết quả lần này |
| --- | --- | --- |
| Cài phụ thuộc test | `npm ci --ignore-scripts --no-audit --no-fund` (theo `package-lock.json`, có từ 14/11/2026), rồi `npx playwright install chromium`. CI thêm `--with-deps`. | Lượt 05/11 dùng Playwright 1.62.1. Bản Chromium mà bản này pin (1234) chưa được cài, cache chỉ có 1248, nên fixture chạy với `CHROME_TEST_PATH` trỏ Chrome cài sẵn. Từ 14/11/2026 lock file ghim Playwright 1.65.0. Ngày 14/11 đã cài Chromium 1254 bằng `npx playwright install chromium`, nên fixture không cần `CHROME_TEST_PATH`. |
| Build, đóng gói | Không có build. ZIP nội dung `extension/` với `manifest.json` ở gốc. | Đã đọc ZIP v0.1.21, so SHA-256 từng tệp với nguồn. 20/20 khớp, 59.774 byte. |
| Chạy | Chrome → `chrome://extensions` → Developer mode → Load unpacked → chọn `extension/`. Sau cập nhật, Reload extension rồi F5 Studio. | Người dùng đã nạp và nghiệm thu trên Studio đăng nhập ngày 05/11/2026, báo đạt cả 7 bước. |
| Logic | `npm test` | **120/120 đạt**, exit 0. |
| Cú pháp, whitespace | `node --check <file>` cho mọi JS/CJS trong `extension/`, `tests/` và `git diff --check`. | **37/37 tệp cú pháp đạt**, diff check exit 0. Không có lệnh lint riêng. |
| Fixture | `npm run test:browser`, `test:cleanup`, `test:popup`, `test:ui`, `test:startup`, `test:alerts` | Chạy trên bản sao tạm của mã 0.1.21 (trước khi viết lại lịch sử; cùng nội dung với `f104e3f`) với `CHROME_TEST_PATH`, không ghi đè ảnh trong repo. Cả sáu exit 0: chèn 61, dọn 38, popup 7, giao diện 16, hộp lỗi 23, startup 7, tổng **152 ca đạt**. Ngày 14/11/2026 chạy lại trên bản sao tạm của `bf175f1` với Playwright 1.65.0, Chromium 1254 và Node 26, không đặt `CHROME_TEST_PATH`: cả sáu exit 0, cùng số ca, **152 ca đạt**; `npm test` 120/120. |
| Chrome desktop | `npm run test:background`, `npm run test:alerts-native` | Chưa chạy lại sau khi có Playwright; lần gọi trước exit 1 vì lúc đó thiếu Playwright. Khi chạy lại cần desktop, hồ sơ tạm; native cần Chrome hỗ trợ CDP `Extensions.loadUnpacked` và `Extensions.triggerAction`. |
| Benchmark | `npm run test:performance`, `test:speed-performance`, `test:audit-performance` | Chưa chạy lại sau khi có Playwright; lần gọi trước cả ba exit 1 vì lúc đó thiếu Playwright. Cần Python trên PATH để đọc ZIP đối chứng. |

SHA-256 ZIP v0.1.21 đã đối chiếu là `a54259a0febf00bffc3b798a36d1e05fcfe1f4046e779d6241435f29cce94638`. Báo cáo lịch sử v0.1.21 ghi **271** ca logic/fixture đạt (119 logic, 152 fixture). Ca 302 mốc kiểm tra preview và dừng lúc khởi động, chưa chạy hết 302 mốc. Kết quả lịch sử không thay thế kết quả hôm nay. [Báo cáo v0.1.21](../artifacts/STARTUP-FIX-0.1.21.md)

Biến test tùy chọn gồm `CHROME_TEST_PATH` để dùng Chrome cài sẵn, `BROWSER_TEST_FILTER` để lọc ca chèn theo tên, và `PERF_VARIANT` để chọn biến thể cho benchmark cũ. Khi xác nhận toàn suite, bỏ lọc ca.

## Thứ tự tiếp tục đề xuất

1. **Trước và sau mỗi thay đổi mã.** Đọc [AGENTS.md](../AGENTS.md), chạy lại lệnh Git ở trên, giữ mọi thay đổi chưa commit nếu có. Sau khi sửa, chạy suite logic và sáu suite fixture trên bản sao bảo toàn ảnh; đường cơ sở 0.1.21 là bảng trên. Khi đổi injection, kiểm hai đường nạp module chạy đúng, thiếu module báo lỗi ở cả Chèn/Dọn và cho Xem trước lại.
2. **Nghiệm thu trên Studio đăng nhập cho mỗi bản mới.** Bản 0.1.21 đã đạt ngày 05/11/2026 theo báo cáo của người dùng. Dùng video thử, ghi lại danh sách trước và sau. Kiểm tra đọc đúng thời lượng, Chèn giữ mốc cũ, Dọn chỉ xóa đúng điểm thủ công đã xem trước, tạm dừng/tiếp tục và hủy đúng ranh giới. Người dùng tự Lưu rồi mở lại, đối chiếu mốc và cài đặt tự động. Thu dữ liệu chẩn đoán đã lược bỏ thông tin nhạy cảm nếu UI nhận diện sai. Theo dõi phân phát quảng cáo riêng với việc xác nhận các mốc đã lưu.
3. **Kiểm chứng nền và thông báo.** Chạy hai suite desktop trên hồ sơ tạm, điều tra đúng ngữ cảnh CDP của worker nếu lỗi `chrome is not defined` tái phát. Tiêu chí xong là có kết quả từng ca, xác nhận cleanup CDP và Chrome đăng ký thông báo, ghi riêng việc quan sát toast Windows nếu có.
4. **Phát hành sau mỗi bản mới.** Khi bản mới đã merge với CI xanh và nghiệm thu đạt, rà phạm vi diff, kiểm version, dựng ZIP mới từ `extension/` tại commit đã merge và đối chiếu từng tệp với nguồn. Tạo tag `vX.Y.Z` và GitHub Release kèm ZIP và SHA256SUMS sau khi người dùng đồng ý. Thay đổi chỉ ở tài liệu không cần phát hành.

Đọc thêm [hướng dẫn vận hành](../extension/HUONG-DAN.md), [lịch sử thay đổi](../CHANGELOG.md) và [nhật ký kiểm chứng](../artifacts/VERIFICATION.md).
