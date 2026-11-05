# Làm việc trong dự án

- Đọc [docs/HANDOFF.md](docs/HANDOFF.md) và kiểm tra `git status --short --branch` trước khi sửa. Cây làm việc có thể chứa bản mới hơn HEAD, gồm cả tệp chưa được Git theo dõi. Giữ công việc hiện có của người dùng.
- Đây là extension Chrome MV3 JavaScript thuần. Nạp `extension/` bằng Load unpacked. Khi đổi danh sách script, kiểm cả luồng mở từ popup và luồng khôi phục sự cố.
- Giữ luồng **Xem trước → Chèn/Dọn → kiểm tra → người dùng tự Lưu**. Chèn tuần tự và giữ mọi mốc cũ. Dọn chỉ xóa điểm thủ công đủ bằng chứng, bảo vệ điểm tự động và chưa rõ loại. Không dùng Xóa tất cả, API nội bộ, tự Lưu, tự chạy lại hoặc tự hoàn tác. Khi kết quả không chắc, dừng và yêu cầu đọc lại/xem trước mới.
- Giữ Tạm dừng ở ranh giới đã xác nhận, kiểm lại dữ liệu khi Tiếp tục, và giữ chỉnh sửa chưa lưu khi Dừng/Hủy. Giới hạn IPC/CDP vào đúng tab và lượt chạy. Giữ giao diện làm việc gọn, đưa lịch sử thay đổi vào tài liệu.
- Chạy `npm test`, `node --check` cho JS/CJS đã sửa và `git diff --check`. Các lệnh Playwright, điều kiện môi trường và phạm vi CI ở [tài liệu bàn giao](docs/HANDOFF.md#cài-chạy-và-kết-quả-ngày-05112026). Fixture có thể ghi đè ảnh trong `artifacts/`. Báo riêng kết quả logic, fixture, API Chrome thật và Studio đăng nhập.
- Chỉ ghi tên biến môi trường trong tài liệu. Giữ thông tin xác thực, nội dung `.env` và dữ liệu nhạy cảm của người dùng ngoài tài liệu và log chia sẻ.
