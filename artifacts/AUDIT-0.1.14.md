# Rà soát chương trình — 0.1.14

Ngày 09/10/2026. Rà toàn bộ 17 tệp extension, bộ kiểm thử, cấu hình và hướng dẫn; so với gói 0.1.13 đã lưu. Kết quả là một bản đã sửa lỗi và tăng kiểm chứng, không phải cam kết không còn lỗi trên mọi biến thể Studio.

## Giữ đúng yêu cầu

Chrome/Studio tiếng Việt, một video; tự đọc thời lượng; khoảng cách và đoạn đầu/cuối do người dùng nhập. Khi chèn giữ mọi điểm cũ. Dọn được phép xóa mọi điểm thủ công, gồm điểm cũ và Đang xem xét; giữ mọi điểm tự động và chưa rõ loại. Lọc khoảng cách giữ điểm sớm hơn. Không phân tích âm thanh/chuyển cảnh. Không tự Lưu. Không tăng quyền, không thêm máy chủ hoặc OAuth.

## Lỗi và điểm yếu đã sửa

| Vấn đề trước rà soát | Thay đổi và bằng chứng |
|---|---|
| Hai điểm cùng giây nhưng khác phần nhỏ giây bị giữ theo thứ tự DOM | Sắp theo giây rồi bộ đếm; giữ 1:00:05 thay vì 1:00:30 khi danh sách đảo thứ tự. Test Node và browser. |
| Bộ đếm không rõ đơn vị trộn với giây thập phân có thể làm sai thứ tự/khoảng cách | Dừng trước dọn nếu phép so sánh cần trộn hai kiểu không xác định được đơn vị; không đoán FPS. Test Node và browser, vẫn cho xóa điểm cảnh báo/Đang xem xét nếu không cần phép so sánh đó. |
| Spinner/aria-busy/Đang xử lý từng bị coi là Đang xem xét và có thể được xóa | Tách loading khỏi review; chờ dữ liệu hoàn chỉnh và yêu cầu preview mới. Test không có click xóa khi loading. |
| Class help và dấu hỏi của nút trợ giúp trong hàng có thể gây nhận nhầm | Chỉ đọc tên glyph hoặc nhãn review phù hợp; loại trợ giúp thường. Test giữ các điểm không có cảnh báo này. |
| Điểm tự động chỉ đọc chặn toàn bộ luồng chèn; điểm không có nút Xóa có thể bị bỏ qua | Đọc các hàng đã nhận diện kể cả chỉ đọc/không có nút xóa, đưa vào bảo vệ và tính khoảng cách. Chỉ nhập ô mới cho phép nhập. Test cả chèn và dọn. |
| Điểm tự động mới xuất hiện có thể bị coi là ô mới của lần chèn thủ công | Kiểm tra nguồn của ô mới trước nhập; nếu là tự động thì dừng và không sửa. Test 1 click chèn, 0 sửa điểm, 0 xóa, 0 lưu. |
| Chưa theo dõi cài đặt quảng cáo tự động | Thêm trạng thái checkbox/role checkbox nhận diện được vào fingerprint. Thay đổi trước chạy chặn mọi click; đổi trong chạy dừng để người dùng kiểm tra trước lưu. Không tự đặt lại checkbox khi xảy ra sự cố. |
| Trạng thái review của auto/unknown đổi gây dừng dù chúng luôn được giữ | Fingerprint giữ nguyên thời gian/nguồn/số lượng; chỉ warning/review của manual ảnh hưởng kế hoạch. Test auto đổi review trong nhóm vẫn được giữ. |
| Mục tiêu không có nút Xóa khả dụng có thể làm dọn một phần rồi mới báo lỗi | Chặn preview nếu mục tiêu không xóa được; kiểm tra cả nhóm trước click nếu nút bị khóa sau preview. Test 0 click vào mọi điểm. |
| Phản hồi đến muộn sau Dừng giữ bộ chờ lâu | Dùng bộ chờ IPC chung có abort/deadline, dọn timer/listener và bỏ phản hồi muộn. Test pre-abort không gửi lệnh, cancel ngay, timeout/fallback và late reply. |
| Metadata video khác vẫn có thể được thay bằng đồng hồ UI cũ | Chặn fallback khi ID không khớp hoặc các ID player mâu thuẫn. Test có đồng hồ UI hợp lệ vẫn không chèn vào dữ liệu sai video. |
| Chuỗi seconds của metadata nhận cả kiểu không phải số thập phân | Kiểm tra định dạng và bảo vệ getter; không coi chuỗi rỗng/hex là seconds. Test typed seconds/nanos và getter ném lỗi. |
| Đồng hồ HTML5 dạng H:MM:SS bị đọc như trường M:SS:phần nhỏ giây của Studio | Phân biệt theo thành phần ytp-time-display/duration; giữ đúng quy tắc trường quảng cáo 1:07:17. Test tổng 00:10:00 đọc là 600 giây. |
| Ô quảng cáo không đọc được bị báo nhầm là xung đột thời lượng | Lỗi cấu trúc danh sách có mã riêng và được báo đúng nguyên nhân; không che bằng lỗi thời lượng. Hồi quy opaque row. |
| Mở popup lại nạp lại module và làm mất chẩn đoán lượt đang chạy | Dùng điểm vào mở lại bảng; không tái nạp module khi bảng đã có. Test giữ identity, trạng thái chạy và lastInsertion. |
| Hai observer và quét toàn trang để remount sau mọi thay đổi gây thừa công việc | Gộp observer, bỏ quét/mount khi hộp hiện tại vẫn kết nối và hiển thị. Theo dõi đóng/ẩn modal và đổi route; kiểm thử lại modal, shadow DOM, focus trap. |
| Commit DOM qua microtask bị rơi vào chờ riêng 400 ms mỗi điểm | Nhường microtask sau click, đọc lại toàn bộ hàng rồi mới tiếp tục. Chỉ dùng cửa sổ ổn định chung nếu đã xác nhận đúng từng lần mất một điểm. Test commit queued, rollback, hủy, mất thêm/sai điểm. |
| Thuật toán chèn/dọn quét và sao chép danh sách lặp theo từng mốc | Lưới chèn dùng danh sách cũ sắp xếp và con trỏ; dọn dùng lân cận auto đã sắp và điểm manual giữ cuối. Đối chiếu với cách tính brute-force qua 1.000 bộ dữ liệu ngẫu nhiên. |
| Nhánh allowLocked và tham số scope không còn dùng; request timeout viết lặp | Loại nhánh/tham số thừa, gom IPC vào wait.js. Không giữ DOM/style cache qua lượt cập nhật. |
| Hướng dẫn dài, lịch sử chen vào luồng dùng; khuyên Tải lại rồi Xem trước trùng việc đọc | Rút hướng dẫn, tách CHANGELOG khỏi README. Xem trước tự đọc dữ liệu mới; Tải lại dùng để xem trạng thái. Giữ hai tab và nút tải theo yêu cầu. |
| Benchmark cũ ghi đè báo cáo lịch sử, wildcard phụ thuộc shell/Node | Đặt tên báo cáo theo phiên bản; có benchmark 3 lượt, hash mã; test runner tự liệt kê tệp trên Windows. Thực chạy bằng Node 24.19.0. |

## Kiểm toán thuật toán

Lưới chèn bắt đầu bằng đoạn đầu, tăng theo khoảng cách nguyên và không vượt đoạn cuối. Khi đoạn cuối bằng 0, mốc vẫn trước thời điểm video kết thúc. Kiểm tra số nguyên an toàn, khoảng giá trị, thời lượng và giới hạn 1.000 mốc. Giữ multiset toàn bộ mốc cũ, gồm các lần xuất hiện trùng nhau. Quy tắc bỏ qua gần/trùng vẫn dùng giây nguyên đối với bộ đếm Studio, mang tính bảo thủ, không giả định FPS.

Dọn xóa manual warning/review, rồi duyệt các điểm phù hợp theo thứ tự thời gian. Với các mốc đã sắp, chỉ lân cận auto trước/sau và điểm manual giữ cuối có thể là mốc gần nhất. Auto được giữ làm điểm neo; unknown được giữ nhưng không dùng loại manual khác. Counter xử lý thứ tự trong cùng giây và ranh giới khoảng cách nguyên. Khi đơn vị không đủ để so sánh chắc chắn, dừng. Không sửa input, không dùng nút Xóa tất cả.

Lập kế hoạch chèn giảm từ các lần quét lặp xuống sắp xếp cộng một lượt qua dữ liệu. Dọn giảm phần chọn lân cận từ quét/copy lặp xuống sắp xếp và duyệt bằng con trỏ. Các thao tác thật vẫn đọc lại toàn bộ điểm sau click; chưa bỏ đối chiếu để đổi lấy tốc độ.

## Rà đủ từng mô-đun

| Tệp | Phạm vi đã kiểm tra |
|---|---|
| planner.js | Parse/format thời gian, biên đầu/cuối, điều kiện độ dài, khoảng cách, trùng, multiset và extra occurrence. |
| cleanup.js | Review/warning/nguồn điểm, greedy earliest, lân cận auto, precision, availability, stale plan, nhóm, hủy và kiểm tra cuối. |
| runner.js | Giữ mốc cũ, số lượng thêm, bỏ qua điểm đồng thời, auto setting, hủy và kiểm tra cuối. |
| studio.js | Dialog/control matching, shadow DOM/visibility, index hàng, metadata/UI, playhead, ô mới, delete, busy, nguồn, xác nhận và diagnostics. |
| wait.js | Foreground/background/freeze budgets, observers/events, ổn định, timeout, IPC/abort/delay, giải phóng tài nguyên. |
| duration-reader.js | Hàm MAIN tự chứa, identity, nguồn seconds/ms/ISO/typed, getter, vòng lặp, mâu thuẫn và giới hạn quét. |
| playhead-controller.js | Hàm MAIN, ràng buộc video/editor, player/native preview, pause/seek/readback, nhiều player, timer và đổi ngữ cảnh; không thay cách gọi sau rà soát. |
| background-session.js | Kiểm tra sender/frame/tab/video/token, attach, cleanup, watchdog, ping, mất kết nối, navigation, cancel khi attach và retry detach; giữ cơ chế đã kiểm thử. |
| background-client.js | Phiên, startup, heartbeat, lost/abort/pagehide và stop trong finally; request có abort. |
| background.js | Popup sender, route/quyền/tab, injection/probe, kiểm tra MAIN frame, reader và seek whitelist. |
| content.js | Settings, hai tab, dữ liệu/preview, race, route/mount, busy/stop, tiến độ, mở lại, lỗi/copy. |
| error-copy.js | Clipboard, fallback chọn văn bản, chỉ thao tác theo lần bấm, không hiện report cũ sau phục hồi; giữ vì có ích khi lỗi. |
| popup.js | Hướng dẫn ngoài trang phù hợp, mở bảng, retry, race và copy lỗi. |
| popup.html / popup.css | Nhãn, trạng thái, focus/hidden, hướng dẫn và liên kết; không thêm luồng thừa. |
| manifest.json | MV3, phiên bản, assets, Chrome tối thiểu, đúng bốn quyền cũ; không host/optional permission mới. |
| HUONG-DAN.md | Cài/cập nhật, hai chức năng, tải, nền, lỗi, quy tắc và giới hạn; bỏ lịch sử/chi tiết triển khai không cần khi sử dụng. |

## Hướng thay thế đã cân nhắc

[YouTube hướng dẫn](https://support.google.com/youtube/answer/6175006?hl=vi) thêm điểm trong trình chỉnh sửa và xóa qua nút cạnh từng điểm. [Danh sách trường videos.update](https://developers.google.com/youtube/v3/docs/videos/update) không có trường sửa danh sách mid-roll. Đây là cơ sở chưa chuyển sang YouTube Data API thông thường; không kết luận mọi API nội bộ/đối tác đều không có khả năng đó. Gọi endpoint nội bộ hoặc ghi thẳng state chưa có schema/persistence và kiểm chứng Studio thật đủ để thay thao tác hiện tại.

Bấm nhiều nút song song, ghi thẳng DOM hoặc dùng một nút xóa toàn bộ chưa chứng minh giữ auto/unknown và mốc phù hợp. Giữ mô hình từng thao tác, nhưng tối ưu thời gian chờ khi đã có readback. [Chrome debugger](https://developer.chrome.com/docs/extensions/reference/api/debugger) vẫn là transport hiện có cho chạy khi chuyển ứng dụng; chưa kiểm chứng phương án thay thế tương đương. Không bỏ quyền rồi quảng cáo chạy nền bảo đảm.

Quy trình gọn nhất: **Xem trước → Chèn/Dọn → kiểm tra → tự Lưu**. Chuyển tab tự đọc dữ liệu; thường không cần Tải lại ngay trước Xem trước. Không khôi phục phân tích âm thanh/chuyển cảnh đã hủy.

## Kiểm chứng và đo tốc độ

- 86 kiểm thử Node đạt qua `node tests/run.cjs`, gồm 500 bộ ngẫu nhiên cho chèn và 500 cho dọn với cách tính đối chứng.
- Toàn bộ 61 tình huống browser chèn đạt; 8 tình huống trọng điểm audit được chạy lại sau hoàn thiện UI/refactor. Thay đổi cuối sau đó chỉ thuộc luật/availability dọn và hướng dẫn.
- 35 tình huống browser dọn/đầu-cuối đạt trên mã cuối.
- 5 tình huống popup đạt; 3 tình huống Chrome thật thu nhỏ qua cầu API mô phỏng/CDP đạt.
- Cú pháp mọi tệp JS extension và CJS kiểm thử đạt. 17 tệp trong ZIP; CRC và từng byte khớp source, phiên bản 0.1.14 và quyền cũ đã kiểm tra.

Benchmark cuối chạy khi các suite browser khác đã kết thúc, Chrome headless/profile tạm, 200 điểm cũ, danh sách dựng lại toàn bộ, deletion commit qua microtask. Mỗi phép đo có 3 mẫu/phiên bản, đổi thứ tự baseline/current giữa lượt. So với ZIP 0.1.13:

| Phép đo | 0.1.13, median | 0.1.14, median | Diễn giải |
|---|---:|---:|---|
| Chèn 5 điểm | 3.630 giây | 3.636 giây | Gần như giữ nguyên; chênh khoảng 0.2%, không có bằng chứng tăng tốc đáng kể. |
| Xóa 20 điểm | 10.508 giây | 2.838 giây | Giảm 73.0% thời gian trong mô hình commit queued này. |

Không suy ra mức tăng này cho Studio thật hoặc cho mọi cách commit DOM. Studio phản hồi trễ vẫn cần chờ từng điểm; chèn vẫn cần xác nhận vị trí và mốc. Chi tiết các mẫu và SHA-256 của mã ở `performance-v0.1.14-vs-0.1.13.json`; hash đã đối chiếu source cuối.

Gói: `release/Chen-quang-cao-YouTube-v0.1.14.zip`, 43,553 byte, SHA-256 `fef5103b9355b433a9e238cab02195764596f252c3b298787d87a6aca2498198`.

## Giới hạn còn lại

Chưa cài/test trên tài khoản Studio thật trong phiên này. Thử nghiệm trang mô phỏng không chứng minh mọi DOM/icon/tooltip/mask của Studio đều được nhận ra; glyph SVG không có tên/nhãn, shadow root đóng và danh sách ảo không khai báo tổng số hàng còn cần dữ liệu thật để hỗ trợ. Bộ chặn partial hiện nhận aria-setsize rõ ràng, không tự tải/quét một danh sách ảo không rõ cấu trúc.

Cài đặt auto được theo dõi khi checkbox/role checkbox và nhãn được nhận diện. Nếu Studio tự đổi cấu hình, tool báo dừng, không tự lưu hay tự đặt lại. Frame counter không có đơn vị được giữ ở dạng gốc; không cam kết tính chính xác hỗn hợp đơn vị không có dữ liệu. Một thao tác đã bấm có thể để lại điểm/nhóm dang dở khi timeout, cancel hoặc mất phiên; luôn cần kiểm tra trước Lưu.

Cửa sổ ổn định 400 ms giúp phát hiện rollback đã thử, không phải chứng nhận server đã lưu. Không có thao tác chèn/xóa hàng loạt mới; nhóm tối đa 5 chỉ dùng chung chờ khi từng delta được chứng minh. Không bảo đảm máy ngủ, Chrome đóng, tab bị tạm dừng hay giao diện chưa hỗ trợ vẫn chạy. Các kết quả đủ để bàn giao bản đã kiểm thử cục bộ, chưa đủ để gọi là không thể có lỗi hoặc tốt nhất trên mọi Studio.
