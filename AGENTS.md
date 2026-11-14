# Làm việc trong dự án

## Bắt đầu
- Đọc [docs/HANDOFF.md](docs/HANDOFF.md) và chạy `git status --short --branch` trước khi sửa.
- Cây làm việc có thể khác HEAD, mới hơn hoặc cũ hơn; đối chiếu với `git diff` và PR đang mở trước khi giữ hay commit.
- Giữ công việc hiện có của người dùng, kể cả tệp chưa được Git theo dõi.
- Đây là extension Chrome MV3 JavaScript thuần; nạp `extension/` bằng Load unpacked.
- Khi đổi danh sách script, kiểm cả luồng mở từ popup và luồng khôi phục sự cố.

## Quy tắc sản phẩm
- Giữ luồng **Xem trước → Chèn/Dọn → kiểm tra → người dùng tự Lưu**.
- Chèn tuần tự và giữ mọi mốc cũ.
- Dọn chỉ xóa điểm thủ công đủ bằng chứng; bảo vệ điểm tự động và điểm chưa rõ loại.
- Không dùng Xóa tất cả, API nội bộ, tự Lưu, tự chạy lại hoặc tự hoàn tác.
- Khi kết quả không chắc, dừng và yêu cầu đọc lại hoặc xem trước mới.
- Tạm dừng ở ranh giới đã xác nhận và kiểm lại dữ liệu khi Tiếp tục.
- Giữ chỉnh sửa chưa lưu khi Dừng/Hủy.
- Giới hạn IPC/CDP vào đúng tab và lượt chạy.
- Giữ giao diện làm việc gọn; lịch sử thay đổi đặt trong tài liệu.

## Kiểm tra
- Chạy `npm test`, `node --check` cho JS/CJS đã sửa và `git diff --check`.
- Lệnh Playwright, điều kiện môi trường và phạm vi CI nằm ở [tài liệu bàn giao](docs/HANDOFF.md#cài-chạy-và-kết-quả-ngày-05112026).
- Fixture có thể ghi đè ảnh trong `artifacts/`; chạy trên bản sao tạm khi cần giữ ảnh cũ.
- Báo riêng kết quả logic, fixture, API Chrome thật và Studio đăng nhập.

## Bảo mật
- Chỉ ghi tên biến môi trường trong tài liệu.
- Giữ thông tin xác thực, nội dung `.env` và dữ liệu nhạy cảm của người dùng ngoài tài liệu và log chia sẻ.
