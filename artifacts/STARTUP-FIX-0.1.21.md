# Sửa lỗi khởi động 0.1.21 — 25/10/2026

Ảnh báo lỗi của người dùng xác nhận `Uncaught (in promise) TypeError: Cannot read properties of undefined (reading 'create')` trong `createRunControl`. Ảnh Studio vẫn ở bước xem trước 302 điểm, chưa hiện tiến độ hay nút Dừng.

Đã tái hiện trước khi sửa bằng Chrome tạm với fixture cục bộ: bỏ `MidrollRunControl` rồi bấm Chèn. Kết quả là chính TypeError trên, không có trạng thái lỗi trong bảng. Bản 0.1.20 gán `controller` trước khi gọi bộ điều khiển, còn lời gọi này nằm ngoài `try/finally`; lỗi làm giữ cờ chạy và chặn các lần bấm tiếp theo. Worker còn giữ danh sách nạp cũ trong khi các tệp đã được cập nhật là một đường có thể gây thiếu module. ZIP 0.1.20 hiện tại vẫn có `run-control.js` và danh sách nạp đúng; chưa xác nhận trạng thái worker thực tế của người dùng.

## Thay đổi

- Đưa việc tạo mã lượt, AbortController, cập nhật giao diện và bộ điều khiển vào `try/finally` cho cả Chèn và Dọn. Lỗi khởi động hủy kế hoạch cũ, giải phóng trạng thái và hiện thông báo thay vì giữ cờ chạy.
- Báo rõ thành phần điều khiển chưa được nạp, hướng dẫn Tải lại extension và làm mới Studio. Không bỏ qua tính năng Tạm dừng/Tiếp tục để tiếp tục chạy.
- Giữ điều khiển tạm dừng sẵn sàng trong khi chờ phản hồi khởi động. Gửi yêu cầu đăng ký theo dõi trước khi khởi tạo bộ điều khiển.
- Nếu chưa tạo được mã lượt, vẫn hiện hộp lỗi cục bộ; không gửi mã rỗng để đăng ký, xác nhận hay hoãn sự cố trong background.
- Cập nhật phiên bản, hướng dẫn và CI; thêm `npm run test:startup`. Quyền không đổi; không tự Lưu hoặc hoàn tác thay đổi Studio.

## Kết quả cục bộ

271 kiểm tra đạt với mã 0.1.21:

| Bộ kiểm tra | Số đạt |
| --- | ---: |
| Logic | 119 |
| Chèn trong fixture | 61 |
| Dọn/margin trong fixture | 38 |
| Popup | 7 |
| Giao diện và Tạm dừng/Tiếp tục | 16 |
| Hộp lỗi và khôi phục | 23 |
| Khởi động và lỗi khởi tạo mới | 7 |

Bộ mới kiểm tra thiếu module, lỗi bất ngờ khi tạo bộ điều khiển và khi tạo mã lượt cho cả hai chức năng. Các lỗi đều hiện thông báo, mở lại điều khiển, chưa chèn/xóa/lưu điểm nào; sau khi khôi phục module và Xem trước lại, chèn/dọn hoàn thành được. Cấu hình trong ảnh (21:01, đầu 180 giây, cuối 780 giây, khoảng cách 1 giây, bốn điểm tự động) tạo đúng 302 mốc, hiển thị trạng thái khởi động và Dừng được trước phản hồi chậm. Bài này không chạy hết 302 điểm.

37 tệp JS/CJS qua kiểm tra cú pháp; `git diff --check` đạt. Đã xem ảnh `startup-302-v0.1.21.png`. Các ảnh lịch sử mà bộ kiểm tra ghi vào tên cũ đã được phục hồi đúng byte; ảnh mới được giữ với hậu tố v0.1.21. Log từng bộ kiểm tra ở `artifacts/*-v0.1.21.log`.

## Gói cập nhật

`release/Chen-quang-cao-YouTube-v0.1.21.zip`: 20 tệp, 59.774 byte; từng tệp khớp nguồn theo byte. SHA-256: `a54259a0febf00bffc3b798a36d1e05fcfe1f4046e779d6241435f29cce94638`.

Gói cục bộ, chưa phát hành GitHub. Với bản nạp từ thư mục nguồn `extension`, bấm Tải lại extension, kiểm tra các chỉnh sửa đang dở rồi F5 Studio. Mở lại bảng có v0.1.21 và Xem trước lại; mã đã nằm trong tab không tự thay khi chỉ sửa tệp.

Chưa xác nhận chèn hoặc Lưu trên YouTube Studio đăng nhập của người dùng. Không coi fixture, số kiểm tra hoặc gói ZIP là bằng chứng YouTube đã lưu hoặc phân phát quảng cáo.
