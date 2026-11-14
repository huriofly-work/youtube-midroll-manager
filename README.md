# Tự động chèn và dọn điểm quảng cáo YouTube

Bản **0.1.21** cho Chrome từ 118 và YouTube Studio tiếng Việt, một video đang mở. Thời lượng đọc tự động; bạn nhập khoảng cách và đoạn đầu/cuối bằng giây. Khi chèn, giữ mọi điểm cũ. Khi dọn, xóa điểm thủ công trong các đoạn đầu/cuối bạn nhập, Đang xem xét/có cảnh báo và lọc các điểm còn lại quá gần, giữ điểm sớm hơn. Luôn giữ mọi điểm tự động và điểm chưa rõ loại. Bạn xem lại và tự Lưu.

Bảng hướng dẫn ngoài trang chèn quảng cáo rộng 460 px, chữ và khoảng cách lớn hơn. Giao diện cố định tab và thanh thao tác, gom cài đặt theo chức năng, quy đổi giây sang phút và ghi rõ lý do xóa. Khi chạy có tiến độ đã xác nhận, **Tạm dừng / Tiếp tục** và **Dừng / Hủy lượt**. Tạm dừng chờ xong điểm/nhóm hiện tại; tiếp tục kiểm tra lại dữ liệu rồi xử lý phần còn lại. Dừng/Hủy ngắt ngay và giữ thay đổi chưa lưu để kiểm tra. Tab Dọn giải thích điểm thủ công quá gần điểm tự động ở trước hoặc sau đều được chọn xóa. Sau chạy, giữ kế hoạch để đối chiếu và yêu cầu xem trước lại trước lượt tiếp theo.

Khi lượt chèn/dọn gặp lỗi, hộp xử lý ghi nguyên nhân, số điểm đã xác nhận và điểm/nhóm cần kiểm tra. Nếu bạn đang xem hộp lỗi trong Studio thì không bật thêm thông báo hệ thống. Lỗi có thể ảnh hưởng điểm báo đỏ và có thể đưa Chrome lên trước; lỗi chưa thay đổi điểm báo nhẹ, không tự focus. Dừng còn nhóm chưa xác nhận hiện cảnh báo vàng và dấu **!**, không báo hệ thống. **Để sau** đồng bộ hộp lỗi/thông báo; sau F5, biểu tượng khôi phục lỗi còn lưu. Không tự chạy lại hay tự Lưu.

[Hướng dẫn cài và dùng](extension/HUONG-DAN.md) · [Rà soát toàn bộ](artifacts/AUDIT-0.1.14.md) · [Kiểm chứng](artifacts/VERIFICATION.md) · [Lịch sử](CHANGELOG.md).

## Tải bản cài

Tải `Chen-quang-cao-YouTube-v0.1.21.zip` ở [GitHub Releases](https://github.com/huriofly-work/youtube-midroll-manager/releases/latest) và đối chiếu với tệp `SHA256SUMS` đi kèm. Giải nén vào một thư mục cố định. Trong Chrome, mở `chrome://extensions`, bật **Chế độ dành cho nhà phát triển**, chọn **Tải tiện ích đã giải nén** rồi chọn thư mục có `manifest.json`.

Đây là bản phát hành GitHub để cài thủ công. Khi cập nhật, lưu chỉnh sửa đang dở, thay tệp trong thư mục extension, bấm **Tải lại** extension rồi F5 Studio.

Bản 0.1.21 sửa trường hợp bấm Chèn/Dọn nhưng bảng im lặng khi thành phần điều khiển lượt chạy chưa được nạp. Mọi bước khởi động đều được bắt lỗi và giải phóng trạng thái chạy; lỗi hiện trong bảng với hướng dẫn cập nhật. Nếu bảng cũ đang bị kẹt, cần Tải lại extension và F5 Studio để thay mã đang nằm trong bộ nhớ.

Mã đóng gói ở `extension/`, không cần build, API key, OAuth hoặc Node.js để dùng. ZIP ở `release/` có `manifest.json` ngay gốc. Quyền: activeTab, scripting, storage, debugger và **notifications** để báo lỗi khi bạn đang dùng ứng dụng khác. Bản 0.1.21 giữ nguyên quyền của 0.1.19. Khi cập nhật: chấp nhận quyền/bật lại nếu Chrome yêu cầu, Tải lại extension và F5 Studio sau khi lưu thay đổi muốn giữ.

Các gói đã phát hành được đính kèm GitHub Releases; Git chỉ giữ ba ZIP cũ 0.1.6, 0.1.10 và 0.1.13 làm đầu vào đối chứng cho các bài đo hiệu năng.

## Kiểm thử cho người phát triển

Node.js 20 trở lên, Playwright theo package.json. Các bài kiểm thử dùng hồ sơ tạm và trang cục bộ; không dùng tài khoản Chrome cá nhân.

```powershell
npm install
npx playwright install chromium
npm test
npm run test:browser
npm run test:cleanup
npm run test:popup
npm run test:ui
npm run test:startup
npm run test:alerts
npm run test:alerts-native
npm run test:background
npm run test:audit-performance
```

Để dùng Chrome đã cài:

```powershell
$env:CHROME_TEST_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
```

`test:background` kiểm tra Chrome thật thu nhỏ qua cầu Chrome API mô phỏng/CDP, cần desktop. `test:alerts` kiểm tra hộp lỗi bằng fixture; `test:alerts-native` cần Chrome có DevTools Extensions.loadUnpacked/triggerAction và desktop, nạp extension thật trong hồ sơ tạm, kiểm tra API thông báo và cửa sổ với trang Studio được thay bằng HTML cục bộ. Không kiểm tra độ nổi bật của toast Windows. `test:audit-performance` so với ZIP 0.1.13 qua 3 lượt mỗi phiên bản, cần Python để đọc archive. Hai benchmark cũ vẫn chạy được qua `test:performance` và `test:speed-performance`; tên báo cáo có phiên bản hiện tại để không ghi đè kết quả lịch sử.

Không coi kiểm thử cục bộ là xác nhận Studio thật, YouTube đã lưu hoặc quảng cáo đã được phân phát.

GitHub Actions chạy kiểm thử logic và sáu bộ fixture trình duyệt (chèn, dọn, popup, giao diện, hộp lỗi và khởi động) sau mỗi lần push/PR. Kiểm thử Chrome thu nhỏ, API thông báo thật và benchmark vẫn chạy riêng tại máy có môi trường phù hợp.

## Bảo mật và bản quyền

Báo lỗ hổng bảo mật theo [SECURITY.md](SECURITY.md), không mở Issue công khai.

Mã nguồn được công khai để xem và tham khảo, chưa kèm giấy phép sử dụng lại. Mọi quyền được bảo lưu.
