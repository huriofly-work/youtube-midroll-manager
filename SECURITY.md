# Chính sách bảo mật

## Phiên bản được hỗ trợ

Chỉ bản phát hành mới nhất trên [GitHub Releases](https://github.com/huriofly-work/youtube-midroll-manager/releases/latest) được sửa lỗi bảo mật.

## Báo lỗ hổng

Đừng mở Issue công khai cho lỗ hổng bảo mật. Hãy báo riêng qua tab **Security** của repo → **Report a vulnerability**.

Nội dung nên có:

- Phiên bản extension và phiên bản Chrome.
- Các bước tái hiện và ảnh hưởng có thể xảy ra.
- Bằng chứng đã lược bỏ thông tin cá nhân, mã kênh và dữ liệu video riêng tư.

Đây là dự án cá nhân nên không có cam kết thời gian phản hồi. Lỗ hổng được xác nhận sẽ được sửa ở bản phát hành tiếp theo.

## Phạm vi

Extension chạy hoàn toàn trên máy người dùng, không có máy chủ, API key hay OAuth. Các quyền nhạy cảm gồm `debugger` và `scripting`, chỉ áp dụng cho tab YouTube Studio của lượt chạy. Lỗi khiến extension đọc hoặc ghi ngoài phạm vi đó đều thuộc phạm vi báo cáo.
