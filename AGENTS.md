# Làm việc trong dự án

## Bắt đầu
- Đọc [docs/HANDOFF.md](docs/HANDOFF.md) trước khi sửa.
- Danh sách script nạp vào trang nằm ở `extension/background.js` (mở từ popup) và `extension/run-alerts.js` (khôi phục sự cố); đổi một chỗ thì sửa và kiểm cả hai.

## Quy tắc sản phẩm
- Giữ luồng **Xem trước → Chèn/Dọn → kiểm tra → người dùng tự Lưu**.
- Chèn tuần tự và giữ mọi mốc cũ.
- Dọn chỉ xóa điểm thủ công đủ bằng chứng; bảo vệ điểm tự động và điểm chưa rõ loại.
- Không dùng Xóa tất cả, API nội bộ, tự chạy lại hoặc tự hoàn tác.
- Khi kết quả không chắc, dừng và yêu cầu đọc lại hoặc xem trước mới.
- Tạm dừng ở ranh giới đã xác nhận và kiểm lại dữ liệu khi Tiếp tục.
- Giữ chỉnh sửa chưa lưu khi Dừng/Hủy.
- Giới hạn IPC/CDP vào đúng tab và lượt chạy.
- Bảng làm việc chỉ hiện kế hoạch, tiến độ xác nhận và lý do lỗi/xóa; lịch sử thay đổi đặt trong tài liệu.

## Kiểm tra
- Sau khi sửa code: chạy `npm test`, `node --check` cho JS/CJS đã sửa và `git diff --check` (project chưa có lint); sửa `extension/` thì chạy thêm sáu suite fixture ghi trong HANDOFF.
- Fixture có thể ghi đè ảnh trong `artifacts/`; chạy trên bản sao tạm khi cần giữ ảnh cũ.
- Báo riêng kết quả logic, fixture, API Chrome thật và Studio đăng nhập.

## Ngoại lệ so với hướng dẫn chung
- Ba ZIP v0.1.6, v0.1.10, v0.1.13 trong `release/` được commit có chủ ý làm đầu vào benchmark; không xoá. ZIP bản mới vẫn chỉ đính kèm GitHub Release.
