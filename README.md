# Tự động chèn và dọn điểm quảng cáo YouTube

Bản **0.1.17** cho Chrome từ 118 và YouTube Studio tiếng Việt, một video đang mở. Thời lượng đọc tự động; bạn nhập khoảng cách và đoạn đầu/cuối bằng giây. Khi chèn, giữ mọi điểm cũ. Khi dọn, xóa điểm thủ công trong các đoạn đầu/cuối bạn nhập, Đang xem xét/có cảnh báo và lọc các điểm còn lại quá gần, giữ điểm sớm hơn. Luôn giữ mọi điểm tự động và điểm chưa rõ loại. Bạn xem lại và tự Lưu.

Bảng hướng dẫn ngoài trang chèn quảng cáo rộng 460 px, chữ và khoảng cách lớn hơn. Giao diện cố định tab và thanh thao tác, gom cài đặt theo chức năng, quy đổi giây sang phút và ghi rõ lý do xóa. Nút chạy hiển thị số điểm trong kế hoạch; khi chạy có tiến độ đã xác nhận và nút Dừng. Tab Dọn giải thích điểm thủ công quá gần điểm tự động ở trước hoặc sau đều được chọn xóa. Sau chạy, giữ kế hoạch để đối chiếu và yêu cầu xem trước lại trước lượt tiếp theo.

[Hướng dẫn cài và dùng](extension/HUONG-DAN.md) · [Rà soát toàn bộ](artifacts/AUDIT-0.1.14.md) · [Kiểm chứng](artifacts/VERIFICATION.md) · [Lịch sử](CHANGELOG.md).

## Tải bản cài

Mở [GitHub Releases](https://github.com/HurioFly/youtube-midroll-manager/releases/latest), tải `Chen-quang-cao-YouTube-v0.1.17.zip`, giải nén vào một thư mục cố định. Trong Chrome, mở `chrome://extensions`, bật **Chế độ dành cho nhà phát triển**, chọn **Tải tiện ích đã giải nén** rồi chọn thư mục có `manifest.json`.

Repository và bản phát hành là **riêng tư**, cần đăng nhập tài khoản được cấp quyền để tải. Đây là bản phát hành GitHub để cài thủ công. Khi cập nhật, lưu chỉnh sửa đang dở, thay tệp trong thư mục extension, bấm **Tải lại** extension rồi F5 Studio.

Mã đóng gói ở `extension/`, không cần build, API key, OAuth hoặc Node.js để dùng. ZIP ở `release/` có `manifest.json` ngay gốc. Quyền vẫn là activeTab, scripting, storage, debugger. Khi cập nhật: Tải lại extension và F5 Studio sau khi lưu thay đổi muốn giữ.

Gói cài hiện tại được đính kèm GitHub Releases; Git chỉ giữ ba ZIP cũ 0.1.6, 0.1.10 và 0.1.13 làm đầu vào đối chứng cho các bài đo hiệu năng.

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
npm run test:background
npm run test:audit-performance
```

Để dùng Chrome đã cài:

```powershell
$env:CHROME_TEST_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
```

`test:background` kiểm tra Chrome thật thu nhỏ qua cầu Chrome API mô phỏng/CDP, cần desktop. `test:audit-performance` so với ZIP 0.1.13 qua 3 lượt mỗi phiên bản, cần Python để đọc archive. Hai benchmark cũ vẫn chạy được qua `test:performance` và `test:speed-performance`; tên báo cáo có phiên bản hiện tại để không ghi đè kết quả lịch sử.

Không coi kiểm thử cục bộ là xác nhận Studio thật, YouTube đã lưu hoặc quảng cáo đã được phân phát.

GitHub Actions chạy kiểm thử logic và bốn bộ fixture trình duyệt (chèn, dọn, popup và giao diện) sau mỗi lần push/PR. Kiểm thử Chrome thu nhỏ và benchmark vẫn chạy riêng tại máy có môi trường phù hợp.
