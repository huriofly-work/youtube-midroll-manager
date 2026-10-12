# Kiểm chứng bản 0.1.18 — 12/10/2026

Thêm hộp xử lý lỗi trong lượt chèn/dọn, thông báo hệ thống, dấu ! và tùy chọn đưa đúng cửa sổ/tab Chrome lên trước. Không đổi quy tắc chọn điểm hoặc tự Lưu.

- 105 kiểm thử logic đạt: tính toán/bảo vệ điểm, điều khiển chạy nền, thông báo, run/video ID, lưu trạng thái qua lần worker khởi động lại, chống báo lại khi đã xem, đọc lại sau mất renderer và không cảnh báo khi dừng theo yêu cầu. Phần theo dõi lỗi phải đăng ký thành công trước khi thay đổi điểm; dừng được ngay nếu đăng ký không phản hồi.
- 61 tình huống chèn, 38 dọn/margin, 7 popup, 6 UI và 19 hộp lỗi đạt trong Chrome headless/hồ sơ tạm với API mô phỏng. Kiểm tra không tự thử lại, xác nhận so với nhóm chưa xác nhận, Later/Escape, mở lại, đọc đúng tab để lập kế hoạch mới, clipboard bị chặn, lỗi quyền thông báo, điều hướng trong khi chạy, bàn phím trong native Studio dialog và kích thước 320×568/640×480/1366×900.
- 3 tình huống Chrome thật thu nhỏ qua cầu Chrome API/CDP đạt: chèn, dừng và dọn vẫn giữ minimized, phục hồi focus emulation và giữ điểm tự động/chưa rõ loại.
- 4 tình huống **API extension Chrome thật** đạt trong hồ sơ tạm, Chrome 154.0.8037.99. Nạp extension qua CDP; URL Studio được thay hoàn toàn bằng HTML cục bộ. Bắt đầu/kết thúc không khôi phục cửa sổ; Chrome chấp nhận thông báo PNG; đúng cửa sổ được khôi phục/focus; báo lặp chỉ có một thông báo, xác nhận xóa badge/notification; tắt tự focus giữ minimized, yêu cầu mở lỗi khôi phục đúng tab và dialog. Đã phát hiện API từ chối SVG và thay bằng PNG. Kiểm tra việc Chrome đăng ký thông báo qua notifications.getAll(), không đánh đồng với toast Windows đã hiện nổi bật.
- Đã xem ảnh ba hộp lỗi; chữ/nút không tràn ngang, nội dung và thao tác cuộn được khi cửa sổ ngắn. Ảnh UI dùng phiên bản 0.1.18, giữ nguyên ảnh 0.1.16. 34 tệp JS/CJS kiểm tra cú pháp đạt. Quyền thêm notifications; activeTab/scripting/storage/debugger vẫn giữ, không thêm quyền host rộng.
- ZIP 19 tệp, 55.668 byte; CRC và từng byte khớp nguồn. SHA-256: `88da85c3952cfbe195fa8d3184d05ffb3f18755fc1cff1d13d550bf1b1570ec3`.

Chưa kiểm chứng trên YouTube Studio đăng nhập của người dùng, khả năng Windows luôn đưa cửa sổ lên trước, độ nổi bật của toast, việc Lưu hoặc phân phát quảng cáo. Có fallback hộp lỗi/dấu ! khi thông báo hoặc focus bị chặn. Các phần dưới là lịch sử.

---

# Kiểm chứng bản 0.1.17

Mở rộng bảng hướng dẫn popup lên 460 px; tăng cỡ chữ và khoảng cách. Bỏ max-width theo viewport, đặt chiều rộng phần tử gốc để không phụ thuộc vùng hiển thị nhỏ khi khởi tạo. Bảng chèn/dọn trong Studio chỉ đổi số phiên bản.

- 92 kiểm thử logic và 7 popup browser đạt trên Chrome headless/profile tạm với Chrome API mô phỏng.
- Kiểm tra hướng dẫn ngoài Studio, trang danh sách Studio, mở bảng thành công, lỗi và thử lại, thiếu background, thông báo dài không tràn ngang. Bước hướng dẫn và nút Mở Studio nằm trong vùng 460×600. Với viewport ban đầu 25 px, phần tử gốc và body vẫn rộng 460 px; trở về 460 px không tràn ngang.
- Đã xem ảnh popup-guidance-v0.1.17.png và popup-error-v0.1.17.png. Ảnh v0.1.16 được giữ nguyên.
- ZIP 17 tệp, 46,259 byte; CRC và từng byte khớp nguồn. SHA-256: `7a6f955ad65a30e2491b207feff32a346ce26ea40015193474ddf7c634066653`.

Chưa kiểm chứng trực tiếp cửa sổ toolbar popup trên Chrome đang đăng nhập của người dùng. Không thay thuật toán, quyền, bảo vệ điểm tự động/chưa rõ loại hoặc việc tự Lưu. Các phần dưới là lịch sử.

---

# Kiểm chứng bản 0.1.16

Thiết kế lại toàn bộ giao diện popup và bảng trong Studio, đồng nhất các ô nhập trực tiếp số giây và bỏ nút cộng/trừ. Thuật toán và cơ chế chạy nền giữ nguyên.

- 92 kiểm thử logic đạt.
- 61 tình huống chèn browser đạt; thay hai bài kiểm tra nút cộng/trừ bằng nhập trực tiếp, bỏ preview cũ và giữ phím mũi tên không tự tăng giảm.
- 38 tình huống dọn/margin browser đạt; vẫn giữ mọi điểm tự động/chưa rõ loại và không tự Lưu.
- 6 popup đạt; thêm kiểm tra báo cáo lỗi lấy đúng phiên bản manifest và thông báo dài không tràn ngang ở 300 px.
- 6 UI đạt: hai tab/thanh thao tác cố định ở 320×568, 640×480, 1366×900 sau cuộn/xem trước; quy đổi giây, đầu vào sai, bàn phím và vô hiệu hóa kế hoạch; giải thích manual 02:01 bị xóa vì auto 03:00; giữ kế hoạch đã dùng để đối chiếu; tiến độ/Dừng trong cửa sổ ngắn và khóa ô nhập khi chạy. Preview danh sách một điểm được kiểm tra nằm trong phần đang nhìn thấy.
- 3 Chrome thu nhỏ đạt qua CDP/profile tạm và cầu Chrome API: chèn, hủy và dọn. Cửa sổ giữ minimized, focus emulation được phục hồi và điểm tự động/chưa rõ ở hai đầu được giữ. Sau lần chạy này, thay đổi cuối chỉ bỏ điều khiển tăng/giảm của giao diện.
- Đã kiểm tra trực quan ảnh ui-insert/cleanup với ba kích thước, ui-cleanup-plan, ui-running, popup-preview và ui-popup-error. Tab/nút chạy/Dừng không bị cuộn khuất, không tràn ngang, màu/nhãn phân biệt chèn và dọn. Ảnh kiểm chứng v0.1.15 được giữ nguyên; ảnh mới có phiên bản riêng.
- Cú pháp toàn bộ JS/CJS, Git whitespace, phiên bản và quyền đạt. Phiên bản 0.1.16; quyền activeTab/scripting/storage/debugger không đổi.
- ZIP 17 tệp, 46.272 byte; CRC và từng byte khớp nguồn. SHA-256: `54aee4b50e85731a3be06bef42b8aa881e1f65172b231de764826db23c981d38`.

Các kiểm tra dùng fixture và hồ sơ Chrome tạm. Chưa kiểm chứng UI mới, DOM/cảnh báo, Lưu hoặc phân phát quảng cáo trên YouTube Studio thật. Các phần dưới là lịch sử.

---

# Kiểm chứng bản 0.1.15 — 10/10/2026

Thêm đoạn đầu/cuối trong tab Dọn điểm; chỉ chọn điểm thủ công ngoài khoảng được phép. Hai ô riêng với tab Chèn điểm, mặc định 0, lưu sau xem trước. Mốc đúng ranh giới được giữ nếu không vướng quy tắc khác. Mọi điểm tự động và chưa rõ loại luôn được bảo vệ, kể cả ở hai đầu video hoặc trùng thời gian với mục tiêu thủ công.

- 92 kiểm thử logic đạt; thêm 6 kiểm thử gồm ranh giới/0/giá trị sai, phần nhỏ giây, bảo vệ automatic/unknown, hai đường chạy xóa và 300 bộ dữ liệu ngẫu nhiên đối chiếu cách tính độc lập.
- 38 tình huống cleanup/margin browser đạt; 3 tình huống mới kiểm tra xóa đúng qua rerender với điểm tự động/chưa rõ trùng mốc, đầu vào sai/preview cũ, cài đặt riêng và lưu cài đặt. Hai ô bị khóa khi chạy; không tự lưu, không chỉnh mốc và cài đặt tự động vẫn bật.
- 5 popup browser đạt.
- 3 Chrome thu nhỏ đạt: chèn, hủy, dọn cảnh báo/Đang xem xét/đoạn đầu-cuối. Dọn xóa đúng 10 điểm thủ công và giữ các điểm tự động/chưa rõ ở hai đầu video. Dùng CDP thật/profile tạm với cầu Chrome API và Studio mô phỏng. Lượt chạy trong sandbox không giữ được trạng thái minimized; chạy ngoài sandbox đạt cả 3 tình huống.
- Đã xem ảnh cleanup-margins-v0.1.15.png: preview xóa đúng 3/9 điểm thủ công và giữ 2 điểm tự động, 1 điểm chưa rõ nguồn. Các ảnh fixture cùng tên cập nhật theo bản mới.
- Kiểm tra cú pháp JS/CJS và Git diff whitespace đạt. Phiên bản manifest/package/popup/panel/diagnostics là 0.1.15; quyền không đổi.
- ZIP 17 tệp, 44.334 byte; CRC và từng byte khớp mã nguồn. SHA-256: `8349398ddab5ed01179c8178b9f7350c1bd8d91e6b714627f875c890ee338fc1`.

Giữ ranh giới nguyên mà không đoán FPS: mốc đầu có bộ đếm >0 vẫn nằm trong vùng được phép; mốc cuối với bộ đếm >0 nằm sau ranh giới và được chọn xóa. Khi cutoff cuối có phần lẻ giây và một mốc thủ công cùng giây dùng bộ đếm không rõ đơn vị, dừng trước khi xóa nếu mốc đó chưa có lý do xóa độc lập. Không dùng điểm thủ công đã loại theo đoạn đầu/cuối làm neo lọc khoảng cách; điểm tự động vẫn làm neo.

Chưa kiểm chứng trực tiếp DOM, lưu hoặc phân phát quảng cáo trên YouTube Studio thật. Các báo cáo bên dưới là lịch sử.

---

# Kiểm chứng bản 0.1.14

Rà soát đầy đủ ở AUDIT-0.1.14.md. Bản cuối giữ chính sách của người dùng: bảo vệ điểm cũ khi chèn; dọn mọi manual warning/Đang xem xét và lọc khoảng cách, giữ auto/unknown; không tự Lưu.

- 86 kiểm thử Node đạt qua node tests/run.cjs; 1.000 bộ dữ liệu ngẫu nhiên đối chiếu hai thuật toán.
- 61 kịch bản browser chèn đạt; chạy lại 8 trường hợp audit sau UI/refactor. 35 kịch bản cleanup/margin trên mã cuối đạt; không lỗi browser không bắt được.
- 5 kịch bản popup và 3 tình huống Chrome thu nhỏ đạt. Browser/extension APIs/Studio được mô phỏng theo từng suite; native focus sử dụng CDP thật với profile tạm.
- Cú pháp toàn bộ JS/CJS đạt; ZIP có 17 tệp, CRC đạt và nội dung byte khớp source. Quyền vẫn activeTab/scripting/storage/debugger, không host/optional permission mới.
- Ảnh preview.png, insert-tab.png, cleanup-plan.png, cleanup-preview.png, review-pending.png cập nhật từ fixture 0.1.14; đã xem trực quan giao diện.
- Benchmark 3 mẫu trên 200 điểm cũ so với 0.1.13: chèn 5 điểm 3.630 → 3.636 giây (không tăng tốc đáng kể); xóa 20 điểm với commit microtask 10.508 → 2.838 giây, giảm 73.0% thời gian. SHA mã đo khớp source cuối; dữ liệu đầy đủ ở performance-v0.1.14-vs-0.1.13.json.

Chưa kiểm thử DOM/lưu/phân phát quảng cáo trên Studio thật. Không bỏ cửa sổ xác nhận để đổi lấy tốc độ, không có nút bulk xóa 5 điểm. Báo cáo các bản cũ dưới đây là lịch sử; ảnh cùng tên hiện đã được cập nhật theo bản mới.

## Kết quả bản 0.1.13

Đổi quy tắc dọn theo yêu cầu mới: xóa điểm thủ công **Đang xem xét**, kể cả điểm có sẵn, không có cảnh báo và không gần điểm khác. Điểm tự động và chưa rõ loại luôn được giữ, kể cả có cảnh báo/Đang xem xét hoặc trùng mốc cần xóa. Điểm có cả cảnh báo và Đang xem xét chỉ có một lượt xóa, lý do Đang xem xét. Lọc khoảng cách chỉ xét các điểm thủ công còn lại. Không tự lưu.

- 73 kiểm thử Node đạt: kế hoạch, lý do, số điểm thủ công Đang xem xét cần xóa, bảo vệ automatic/unknown, cả runner từng điểm và nhóm; đổi trạng thái sau preview phải dừng.
- 25 kịch bản cleanup/margin browser đạt: chữ Đang xem xét, icon dấu hỏi trang trí, nhãn/tooltip/shadow root, xóa điểm Đang xem xét không có cảnh báo, bảo vệ các điểm trùng mốc tự động/chưa rõ qua full rerender, cả removePoint và removePoints. Hủy, mất thêm điểm, sai điểm, không phản hồi và rollback vẫn dừng. Trạng thái đổi yêu cầu preview mới; preview lại chọn xóa theo dữ liệu mới. Không tự lưu.
- 3 kịch bản Chrome thu nhỏ đạt: chèn, dừng chèn, dọn 7 điểm thủ công (cảnh báo hoặc Đang xem xét), giữ điểm tự động Đang xem xét và các điểm gốc khác. Cửa sổ giữ minimized và focus emulation được phục hồi. Dùng session manager hiện tại qua cầu mock Chrome API/CDP trên fixture; không phải Studio thật.
- 3 kiểm thử hồi quy browser cho shadow DOM của luồng chèn đạt.
- 13 tệp JavaScript đóng gói đạt kiểm tra cú pháp; phiên bản manifest/package/popup/panel/diagnostics 0.1.13, quyền không đổi.
- Đã xem ảnh review-pending.png: preview xóa 4 điểm thủ công Đang xem xét, giữ 1 điểm chưa rõ loại; từng mốc ghi đúng lý do. Các ảnh fixture hiện tại đã cập nhật, mô tả ảnh trong phần lịch sử là kết quả tại thời điểm bản cũ.
- ZIP 0.1.13 có 17 tệp gốc; CRC đạt, từng byte khớp thư mục extension, không có host_permissions mới.

Chưa kiểm thử DOM/icon thực tế trên Studio của người dùng. Tool vẫn bấm xóa từng điểm; nhóm tối đa 5 chỉ gom thời gian chờ xác nhận khi Studio phản hồi ngay. Kết quả các bản cũ dưới đây ghi lại quy tắc ở thời điểm đó, đã được thay bằng quy tắc mới trong 0.1.13.

## Kết quả bản 0.1.12

Sửa nhận diện Đang xem xét: thêm nhãn tiếng Việt và biểu tượng vòng tròn dấu hỏi/help_outline/help-outline/help-circle/question-mark-circle trong đúng hàng. Icon aria-hidden vẫn được kiểm tra khi có hình hiển thị; hidden/display:none bị loại. Đọc aria-description và tooltip được hàng tham chiếu qua aria-describedby, gồm shadow root mở. Không dùng biểu tượng trợ giúp chung bên ngoài hàng. Số điểm đang xem xét gồm cả hàng chưa rõ thủ công/tự động, hiện ở dữ liệu tải lại và preview.

- 72 kiểm thử Node đạt, gồm bảo vệ pending khỏi cảnh báo và khoảng cách, đếm pending của các loại manual/automatic/unknown.
- 23 kịch bản cleanup/margin browser đạt. Thêm nhãn Đang xem xét, icon dấu hỏi không có nhãn và aria-hidden, tooltip liên kết ẩn, shadow glyph, loại icon thật sự ẩn/help bên ngoài, không lấy pending làm điểm neo để loại hàng khác, trạng thái đổi sau preview và trong nhóm phải dừng trước mục tiêu mới đang xem xét. Giữ điểm pending kể cả trùng cảnh báo đỏ hoặc quá gần, 0 click xóa vào chúng, không tự lưu.
- Kiểm tra hồi quy các trường hợp shadow DOM của luồng chèn; 13 tệp JS đóng gói qua kiểm tra cú pháp. Không đổi quyền.
- Ảnh review-pending.png kiểm tra trực quan: nhận ra 5 điểm đang xem xét, số sẽ xóa bằng 0, nút Dọn điểm bị khóa; một điểm chưa rõ nguồn được tính pending đồng thời giữ nguyên.

Các glyph và DOM/Chrome API của fixture được mô phỏng theo thông tin người dùng cung cấp; chưa kiểm tra icon thực tế trên Studio của người dùng. Không khẳng định mọi biến thể SVG không có tên/nhãn đều được nhận ra. Tool vẫn bấm xóa riêng từng điểm; tối ưu nhóm chỉ gom khoảng chờ xác nhận khi Studio phản hồi ngay.

## Kết quả bản 0.1.11

Chèn bỏ cửa sổ nhận diện 400 ms chỉ khi player đã xác nhận seek thật, một mốc mới duy nhất xuất hiện ngay tại đích và mọi mốc cũ còn đủ. Đường chưa rõ giữ cơ chế chờ cũ. Cửa sổ xác nhận sau nhập 400 ms và kiểm tra danh sách cuối vẫn có.

Dọn chia nhóm tối đa 5. Sau từng click, đọc lại toàn bộ các hàng/loại/cảnh báo, đối chiếu chính xác một mốc mất và không click tiếp nếu phản hồi chưa xác nhận. Phản hồi tức thời dùng chung một cửa sổ ổn định 400 ms; phản hồi trễ chờ riêng. Chỉ báo tiến độ nhóm ổn định. Stop/lỗi trước khi nhóm xác nhận ghi số điểm đã bấm xóa trong nhóm, không nhấp lại và không tự lưu. Không có API nội bộ hoặc lệnh Xóa tất cả.

- 71 kiểm thử Node đạt: thêm runner nhóm 5/5/2, đối chiếu bảo vệ điểm khác, thiếu một điểm trong nhóm và hủy giữa nhóm.
- 53 kịch bản browser chèn đạt: thêm trường hợp fast identification có ô đích đúng nhưng giá trị nhập hồi lại sau 50 ms; dừng sau một lần chèn, không sửa điểm cũ.
- 17 kịch bản cleanup/margin đạt: nhóm phản hồi ngay, dựng lại toàn bộ hàng, trì hoãn, sai điểm/mất thêm điểm/không phản hồi, rollback sau nhóm 5 phải dừng trước nhóm tiếp theo, stop giữa cửa sổ ổn định báo nhóm chưa xác nhận. Bảo vệ các điểm tự động/chưa rõ/đang xét duyệt và không lưu.
- Kiểm thử Chrome thật thu nhỏ nối production session manager qua mock API/CDP: luồng chèn, dừng chèn và luồng dọn nhóm 7 điểm (5+2), giữ các điểm gốc/tự động, không lưu, cửa sổ giữ minimized và focus emulation được phục hồi. Đây không phải extension cài trên Studio thật.
- 13 tệp JS đóng gói qua kiểm tra cú pháp. Quyền giữ nguyên.

Benchmark một lượt trên hồ sơ Chrome headless tạm, Studio/player/messaging mô phỏng, danh sách dựng lại toàn bộ sau mỗi click, so với ZIP 0.1.10. Báo cáo ở performance-v0.1.11.json:

| 200 điểm cũ | 0.1.10 | 0.1.11 | Giảm thời gian |
| --- | ---: | ---: | ---: |
| Chèn 5 điểm | 5,952 s | 3,767 s | 36,7% |
| Xóa 20 điểm | 11,466 s | 3,355 s | 70,7% |

Cả 8 phép đo (20/200 điểm cũ × chèn/dọn × hai bản) giữ đầy đủ các điểm cần bảo vệ, đúng số click, không input vào điểm cũ, không lưu, không tắt quảng cáo tự động và không có lỗi JS chưa xử lý. Số đo này không chứng minh tốc độ trên Studio thật; phản hồi bất đồng bộ hoặc cấu trúc khác sẽ giữ đường chờ lâu hơn. Nhận diện chất lượng và loại điểm trên Studio thật vẫn cần người dùng xác nhận.

## Kết quả bản 0.1.10

Giao diện chia thành tab Chèn điểm/Dọn điểm, bỏ checkbox xác nhận xét duyệt và thêm Tải lại dữ liệu. Nút tải đọc lại dữ liệu đang có trong Studio, không reload trang hoặc yêu cầu xét duyệt máy chủ. Các giá trị nhập được giữ, kế hoạch cũ bị vô hiệu hóa. Chuyển tab tự đọc lại, giữ cài đặt và bỏ preview của tab cũ. Tabs/nút tải bị khóa trong lượt chèn hoặc dọn.

- 69 kiểm thử Node đạt; thuật toán chèn/dọn và transport giữ nguyên.
- 15 kịch bản cleanup/margin browser đạt, gồm kiểm tra mới về một tab hiển thị mỗi lúc, chuyển bằng bàn phím, giữ các ô nhập, xem trước dọn không cần checkbox, tải lại độ dài/cảnh báo mới không sửa điểm và vô hiệu hóa kế hoạch cũ, đổi tab khi đang tải bỏ qua kết quả cũ. Kiểm tra khóa tab/load khi đang xóa và hủy lượt chạy.
- 52 kịch bản hồi quy luồng chèn và 5 kịch bản popup đạt. 13 tệp JS đóng gói qua kiểm tra cú pháp. Ảnh insert-tab.png, cleanup-plan.png và cleanup-preview.png được kiểm tra trực quan. ZIP 0.1.10 gồm 17 tệp, 43.275 bytes, đã kiểm tra tập tệp, CRC, phiên bản/quyền và bytes khớp nguồn.

Chưa kiểm tra UI mới/nhận diện cảnh báo trên tài khoản Studio thật. Các ảnh và kiểm thử dùng hồ sơ Chrome tạm với Chrome API/Studio fixture; không phải bằng chứng chấp nhận trên dịch vụ. Không thêm quyền, không đổi quy tắc bảo vệ điểm tự động hoặc việc người dùng tự lưu.

## Kết quả bản 0.1.9

Bản 0.1.9 thêm đoạn đầu/cuối tùy chọn (giây), lưu cài đặt khi xem trước và luồng dọn điểm riêng sau khi người dùng xác nhận đã lưu/chờ xét duyệt. Không tự lưu hay thay lựa chọn quảng cáo tự động.

- 69 kiểm thử Node: lập lưới với giới hạn tùy chọn/0, kiểm tra khoảng trống không hợp lệ, dọn cảnh báo trước rồi giữ điểm thủ công sớm hơn, bảo vệ điểm tự động/chưa rõ/đang xét duyệt, ranh giới phần nhỏ giây, multiset mốc trùng, preview cũ, sai điểm xóa, thiếu phản hồi, mất điểm khác, hủy và kiểm tra cuối. Các kiểm thử background, thời lượng, playhead, chèn và wait vẫn đạt.
- 13 kịch bản trình duyệt cục bộ mới: chèn với đoạn đầu 90/cuối 150 giây, invalidation, điều kiện đã xét duyệt, preview không xóa, biểu tượng warning đỏ so với đen, nhận diện nhãn hàng/nhóm, cảnh báo nằm ngoài cụm input/delete, điểm đang xét duyệt, giữ điểm tự động readonly, dựng lại mọi hàng sau từng xóa, mốc trùng, cảnh báo đổi sau preview, không phản hồi/sai điểm/mất thêm điểm chỉ nhấp một lần, dừng và mất focus giả lập. Không có lỗi JS chưa xử lý. Cài đặt mới được kiểm tra trong storage mock.
- 52 kịch bản chèn cũ, 5 kịch bản popup và 2 kịch bản Chrome thật thu nhỏ vẫn đạt. Hai kịch bản Chrome thu nhỏ kiểm tra luồng chèn/khôi phục focus emulation, chưa kiểm tra dọn với extension đã cài trong toolbar.
- Kiểm tra cú pháp các tệp JavaScript đóng gói; ZIP được kiểm tra CRC, phiên bản, quyền, tập tệp và bytes bằng nguồn.

Ảnh `cleanup-plan.png` và `cleanup-preview.png` lấy từ fixture. Fixture dùng nhãn manual/automatic và biểu tượng warning có màu/thuộc tính xác định; không phải DOM của tài khoản người dùng. Nhận diện nguồn điểm qua nhãn và cảnh báo chất lượng mới **chưa kiểm chứng trên YouTube Studio thật**. Điểm thiếu nhãn được giữ nguyên, báo số điểm chưa rõ; không suy ra thủ công từ khả năng sửa/xóa. Không có cảnh báo không chứng minh đã xét duyệt; checkbox yêu cầu người dùng xác nhận thời điểm chạy dọn.

Thông tin phản hồi sau lưu được đối chiếu [YouTube Trợ giúp](https://support.google.com/youtube/answer/6175006?hl=vi) ngày 09/10/2026. Dấu cảnh báo nói về khả năng phân phát, không phải bảo đảm chấp thuận/cấm quảng cáo. Khi các điểm tự động quá gần nhau, giữ chúng theo yêu cầu dù không đạt khoảng cách tối thiểu.

## Kết quả các bản trước (lưu để đối chiếu)

### Kiểm chứng bản 0.1.8

Ngày kiểm tra: 2026-10-09 (Asia/Saigon).

- 61 kiểm tra Node.js: đạt, 0 lỗi. Gồm quản lý phiên chạy nền, bảo toàn mốc, chờ cập nhật, nhận diện thời lượng, controller vị trí phát và mở bảng từ popup. Endpoint mở bảng chỉ chấp nhận trang popup của chính extension, chỉ truy vấn tab đang hoạt động và không nhận tab ID tùy ý.
- 52 kịch bản trình duyệt headless: đạt, 0 lỗi JavaScript chưa xử lý. Dùng fixture cục bộ, API extension mô phỏng và hồ sơ tạm.
- 5 kịch bản popup headless: đạt. Trang khác/Chrome nội bộ được mô phỏng qua phản hồi worker, danh sách Studio, mở bảng thành công, lỗi có sao chép/thử lại và worker không kết nối được.
- 2 kịch bản Chrome thu nhỏ: đạt. Dùng lệnh CDP thật với bộ quản lý phiên production và cầu API debugger mô phỏng; không dùng phiên Chrome cá nhân.
- Kiểm tra cú pháp bằng node --check cho 12 tệp JavaScript của extension.
- artifacts/preview.png là giao diện mô phỏng đã kiểm tra trực quan, hiển thị độ dài tự đọc và không có ô nhập thời lượng.

## Popup và sao chép lỗi

Manifest dùng default_popup thay cho onClicked. Popup gửi MIDROLL_OPEN_PANEL; background xác thực sender, truy vấn tab active/currentWindow, chỉ inject các tệp đóng gói vào trang video có origin Studio chính xác. Tab không phù hợp được trả hướng dẫn, không inject và không hiện dấu !. Nếu chèn mã thất bại, popup nhận thông báo lỗi có thể khắc phục. Không thêm quyền tabs, clipboardWrite hoặc host_permissions; giữ nguyên activeTab/scripting/storage/debugger.

Bảng điều khiển bỏ details/textarea hỗ trợ thường trực. Nút sao chép chỉ hiện khi status có tone error; sao chép chứa thông báo lỗi, khoảng cách hợp lệ và diagnostics hẹp của hộp quảng cáo. Clipboard chỉ được ghi sau lần bấm. Kiểm thử không có ID video, thông tin tài khoản giả hoặc văn bản ngoài hộp trong báo cáo. Nếu clipboard bị chặn, giữ lỗi gốc và hiện vùng văn bản chỉ đọc được chọn sẵn để Ctrl+C; khi clipboard hoạt động lại, vùng fallback ẩn. Phản hồi clipboard lỗi đến muộn không hiển thị báo cáo cũ sau khi lỗi đã khắc phục.

Khi chưa có hộp quảng cáo trên trang video, bảng hướng dẫn mở hộp rồi Xem trước, không báo lỗi kỹ thuật và chưa chèn điểm. Kiểm thử mở lại hộp rồi Xem trước khôi phục được thao tác. Popup được render bằng HTML/CSS/JS production với Chrome messaging được mô phỏng; window.close cũng được thay bằng cờ kiểm thử. Chưa xác nhận thao tác bấm biểu tượng thật, grant activeTab hoặc popup trên trang chrome:// trong Chrome Extensions UI của người dùng. artifacts/popup-preview.png là ảnh popup mô phỏng.

## Tối ưu tốc độ

Bản 0.1.7 giữ hai bước chờ ổn định 400 ms (nhận diện ô mới, xác nhận mốc đã nhập) và kiểm tra cuối kế hoạch. Không chạy nhiều lượt chèn song song. Bỏ lượt chờ 300 ms riêng cho ô hiển thị chỉ khi preview thực tế đã xác nhận vị trí mới; nếu không có player hỗ trợ vẫn giữ bước chờ ô hiển thị. Thêm timings trong diagnostics cho các giai đoạn chuẩn bị, nhận diện và xác nhận.

Đọc ô/nút một lần rồi lập chỉ mục theo tổ tiên, kể cả tổ tiên qua shadow root. So sánh nút lồng nhau bằng tập hợp tổ tiên thay vì từng cặp; giữ đúng nút sâu nhất. Chia sẻ kết quả getComputedStyle trong chính một lượt đọc, không giữ cache giá trị/danh sách giữa hai lượt. Đối chiếu đủ số lần xuất hiện của mốc cũ bằng Map thay vì tìm/xóa tuần tự trong mảng. Thêm hồi quy nút Polymer lồng nhau, input nằm trong shadow root riêng và cấu trúc không rõ có nhiều ô thời gian dùng chung một nút xóa.

tests/performance.cjs nạp mã cũ từ ZIP 0.1.6 đã lưu và mã mới từ extension, trên cùng fixture/player, Chrome headless với hồ sơ tạm. Mỗi trường hợp chèn 5 mốc, Studio fixture dựng lại toàn bộ danh sách mỗi lần, dùng vị trí timeline độc lập với ô hiển thị. Snapshot median là median 10 lượt đọc trên danh sách ban đầu. Thời gian chèn bao gồm runner và kiểm tra cuối kế hoạch. Dữ liệu: artifacts/performance.json.

| Số điểm cũ | 0.1.6: 5 mốc mới | 0.1.7: 5 mốc mới | Giảm thời gian | Snapshot cũ → mới |
|---|---:|---:|---:|---:|
| 20 | 7.378,1 ms | 5.739,3 ms | 22% | 0,7 → 0,6 ms |
| 200 | 8.781,8 ms | 5.973,4 ms | 32% | 20,4 → 4,6 ms |

Cả bốn trường hợp đều đủ 5 mốc mới/5 lượt nhấp, giữ mọi mốc cũ, 0 sự kiện input vào ô cũ, 0 xóa/lưu, quảng cáo tự động vẫn bật và không có lỗi JavaScript chưa xử lý. Đây là phép đo cục bộ, không phải cam kết tốc độ trên Studio thật; thời gian tải/seek và dựng lại giao diện thực tế có thể chiếm phần lớn tổng thời gian.

Người dùng đã phản hồi 0.1.6 chạy tốt trên Studio. Phép đo tốc độ ở trên thực hiện với 0.1.7 trên fixture. Bản 0.1.8 giữ thay đổi về tốc độ đó; mức tăng trên video thật và luồng popup mới vẫn cần người dùng chạy xác nhận.

## Thanh timeline và nhận diện ô mới

Tái hiện trên trang mô phỏng với mã 0.1.5: sau một lần chèn, Studio dựng lại toàn bộ danh sách với điểm mới tạm trùng mốc cũ; dù 700 ms sau danh sách sẽ cập nhật đúng, bản cũ dừng ngay với chính thông báo “Studio đã vẽ lại danh sách và không xác định được ô mới”. Đây là cơ chế được tái hiện bằng fixture, chưa phải xác nhận DOM thực tế của tài khoản người dùng.

0.1.6 tách việc nhập ô hiển thị với việc seek preview thực tế. Bộ điều khiển MAIN chỉ tìm player theo danh sách thành phần cho phép, xác thực ID video/độ dài, tạm dừng và seek, rồi đọc getCurrentTime ổn định. Không gọi playVideo hay sửa đối tượng trạng thái quảng cáo. Fallback native chỉ nhận một video có độ dài khớp trong đúng editor được đánh dấu bởi lượt chạy. Không nhận mã hoặc lệnh tùy ý qua message. Player không hỗ trợ cho phép tiếp tục cơ chế sửa ô mới an toàn; player đã nhận diện nhưng seek không xác nhận được sẽ dừng trước khi nhấp chèn.

Kịch bản mới giữ timeline thật của fixture ở 00:20 độc lập hoàn toàn với ô thời gian hiển thị; nút chèn đọc timeline thay vì ô này. Bật dựng lại toàn bộ danh sách mỗi lần chèn. Đạt đủ 4 mốc mới, 0 sự kiện input vào ô cũ, 0 xóa/lưu và quảng cáo tự động vẫn bật. Kịch bản player nhận lệnh nhưng không di chuyển dừng với 0 lượt nhấp. Kịch bản 171 mốc lưới đã có (cộng 3 mốc ban đầu, gồm mốc trùng) tiếp tục thêm đúng 29:30/29:40, giữ nguyên toàn bộ mốc ban đầu và lần xem trước sau đó không còn mốc thiếu.

Nhận diện ô mới đợi bằng chứng ổn định 400 ms, đối chiếu multiset đầy đủ bằng số lần xuất hiện của từng raw timecode. Sau await phải đọc lại ô còn kết nối, không dùng tham chiếu DOM đã bị thay. Danh sách tạm thời/đang dựng lại được chờ thay vì dừng tức thì. Hạn nhận diện 15 giây xử lý ở foreground, bộ chờ vẫn có ngân sách riêng cho background. Không nhấp lại nút chèn khi kết quả chưa rõ.

Nếu điểm mới trùng mốc cũ và tất cả input đều bị thay, giá trị thời gian không đủ để chọn an toàn. Kịch bản này xác nhận dừng sau đúng 1 lượt nhấp, không sửa ô cũ, không xóa/lưu và báo cả mốc dự kiến lẫn vị trí thanh timeline. Không chọn ô theo chỉ số, không lấy đại một ô trùng và không bỏ điều kiện giữ điểm cũ. Diagnostics bổ sung lastInsertion chỉ gồm mốc/số điểm/giai đoạn/kết quả seek, không có ID tài khoản hoặc video.

Các controller và handler trong fixture là mô phỏng. Việc seek một player preview có làm thanh timeline của Studio thật cập nhật đúng hay không vẫn cần thử trên Studio thật; chưa thể bảo đảm mọi phiên bản giao diện hỗ trợ phương thức này.

## Thời lượng tự động

Không còn nguồn thời lượng nhập tay. Bảng đọc khi mở, khi Xem trước và khi chuyển sang video khác. Bộ đọc MAIN truy cập các thành phần trình phát/video được chỉ định, các hàm đọc getVideoData, getVideoUrl, getDuration, getPlayerResponse và các trường độ dài có đơn vị rõ ràng. Chỉ nhận metadata có ID video khớp đường dẫn đang mở. Giá trị số không rõ đơn vị và nguồn của video khác bị bỏ qua; nguồn đúng ID nhưng mâu thuẫn bị chặn. Không đọc vị trí phát, cookie, token hay toàn bộ trạng thái trang; không gọi mạng.

Nếu không có metadata phù hợp, đọc phần tử video trong hộp quảng cáo hoặc bộ đếm tổng thời gian có tên/nhãn rõ của Studio. Loại các ô thuộc điểm quảng cáo khỏi nhận diện thời lượng. Dữ liệu chưa tải được thử lại trong khoảng 10 giây; hết thời gian thì báo tải lại Studio để tự đọc lại, không yêu cầu nhập tay. Đóng bảng hủy lượt đọc và bỏ qua kết quả đến muộn.

Hồi quy video 08:27: trình phát đúng ID trả 507 giây dù bộ đếm UI sai. Giữ nguyên các điểm 1:07:17, 3:00:00, 7:45:00; thêm 1:00:00, 5:00:00, 7:00:00. Không thêm điểm sau 07:27, không xóa/lưu và không đổi quảng cáo tự động. Điểm cũ thực sự vượt độ dài vẫn bị chặn, hiển thị chính xác mốc và tổng thời gian đọc được.

Các kiểm tra tiếp tục bao gồm nút −/+ không tự lặp, bàn phím/focus trap, native modal, shadow DOM, dừng chèn, danh sách vẽ lại, bản xem trước cũ và không chèn trùng. Bài kiểm tra mới bao gồm metadata tải chậm, metadata trong shadow component, sai video, độ dài mâu thuẫn, không có dữ liệu, hủy lượt đọc và chuyển đường dẫn video.

## Mất focus và mất mốc

Đã tái hiện trên fixture trước khi sửa: giả lập focus/blur phần tử không phát, và UI chỉ ghi nhận mốc khi focusout. Bản cũ báo thành công nhưng bốn mốc mới trở về 0:00:00 sau cập nhật bất đồng bộ. Bản mới phát bổ sung các sự kiện thiếu, đọc lại mốc qua nhiều lượt cập nhật (ổn định ít nhất 400 ms thời gian kiểm tra) và kiểm tra danh sách cuối. Fixture này mô hình hóa một cơ chế gây mất mốc, không phải bằng chứng rằng Studio thật dùng chính xác cùng handler.

Kịch bản mất focus dùng document.hasFocus giả lập false: đủ bốn mốc được xác nhận, không xóa/lưu, quảng cáo tự động vẫn bật. Kịch bản hidden dùng trạng thái document.hidden giả lập: đang chờ mốc đầu không nhấp mốc tiếp theo; khi visible trở lại, đủ bốn mốc, không trùng. Kịch bản Page.setWebLifecycleState của Chrome thực sự freeze trang 6,5 giây trong một lần chèn, sau resume tiếp tục đúng thao tác, đủ bốn mốc và chỉ bốn lượt nhấp.

Bộ chờ giữ việc kiểm tra ổn định của 0.1.4, nhưng 0.1.5 bật focus emulation bằng giao thức Chrome trong phiên chèn để duy trì cập nhật trang khi cửa sổ mất focus. Không ghi đè getter hidden/hasFocus trong mã production. Không tính thời gian freeze hoặc hẹn giờ trễ quá mức như thời gian Studio xử lý; luôn đọc kết quả trước khi xét hết thời gian.

## Chạy nền với Chrome thu nhỏ

Bài tests/background-browser.cjs chạy Chrome có giao diện bằng hồ sơ tạm, cửa sổ giữ trạng thái minimized. Tắt focus emulation mặc định của Playwright trước mỗi kịch bản và bỏ các cờ disable-background-timer-throttling, disable-backgrounding-occluded-windows, disable-renderer-backgrounding. Trước khi bật phiên, document.hasFocus() là false. Fixture yêu cầu trang có focus để nhận lệnh chèn và tạo hàng qua requestAnimationFrame.

Bộ quản lý production gửi thật Emulation.setFocusEmulationEnabled(true) và Page.setWebLifecycleState(active). Kết quả đủ 4 mốc mới, giữ 3 mốc cũ, 4 lượt nhấp, 0 xóa/lưu, quảng cáo tự động vẫn bật. Sau khi xong, lệnh false được gửi và phiên được ngắt; document.hasFocus() trở lại false, cửa sổ vẫn minimized. Kịch bản dừng sau lượt nhấp đầu cũng phục hồi focus emulation và không nhấp mốc tiếp theo. API attach/detach được mô phỏng nối vào CDP của bài kiểm thử, không phải tải extension qua Chrome Extensions UI.

Các kịch bản headless bổ sung kiểm tra startup bị từ chối thì không chèn, người dùng ngắt phiên thì dừng, phiên được giải phóng sau khi xong, và hủy startup không chèn sau phản hồi đến muộn. Chrome thông báo quyền debugger và thanh điều khiển là hệ quả của API này, chưa kiểm tra giao diện thanh thông báo trong phiên Chrome người dùng.

## Giới hạn

Trang mô phỏng nạp mã production và giả lập Chrome storage/messaging cùng cấu trúc điều khiển. Hàm đọc metadata chạy trên đối tượng trình phát giả lập trong trang; background/manifest được kiểm tra với mock API. Chưa xác nhận việc tải tiện ích và chuyển ngữ cảnh ISOLATED/MAIN bằng Chrome Extensions UI thực tế trong phiên này.

Chưa thực hiện trên YouTube Studio thật: mở extension, tự đọc dữ liệu đang triển khai, chèn mốc, người dùng lưu và mở lại video. Các kiểm tra cục bộ không bảo đảm nhận diện được mọi cấu trúc Studio hiện tại, và không xác nhận YouTube phân phát quảng cáo. Khi cấu trúc hoặc kết quả chèn không rõ, extension dừng; các điểm đã thêm vẫn thuộc bản chỉnh sửa chưa lưu.
