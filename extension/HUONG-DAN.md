# Chèn và dọn điểm quảng cáo YouTube — 0.1.15

Dành cho Chrome từ 118, YouTube Studio tiếng Việt, một video đang mở. Bạn xem lại và tự bấm Tiếp tục/Lưu. Không cần API key, OAuth hoặc cài Node.js.

## Cài hoặc cập nhật

1. Giải nén ZIP vào một thư mục cố định, có `manifest.json` ngay bên trong.
2. Mở `chrome://extensions`, bật **Chế độ dành cho nhà phát triển**, chọn **Tải tiện ích đã giải nén**, rồi chọn thư mục đó.
3. Khi cập nhật, thay tệp trong đúng thư mục đã cài và bấm **Tải lại** extension. Nếu cài từ thư mục mã nguồn `extension`, chỉ cần Tải lại.
4. Lưu các chỉnh sửa Studio muốn giữ trước khi F5 trang. Mở lại trình quảng cáo và kiểm tra bảng có **v0.1.15**.

Extension cần quyền debugger để giữ riêng tab Studio hoạt động khi bạn dùng ứng dụng khác. Chrome hiện thanh thông báo trong lúc chạy; phiên kết thúc khi xong, dừng hoặc gặp lỗi. Chấp nhận quyền/bật lại extension nếu Chrome yêu cầu.

## Chèn điểm

1. Mở một video kiếm tiền dài tối thiểu 8 phút trong Studio, vào **Kiếm tiền → Quản lý vị trí quảng cáo**.
2. Bấm biểu tượng extension, chọn tab **Chèn điểm**.
3. Nhập bằng giây: **Đoạn đầu không chèn**, **Đoạn cuối không chèn**, **Khoảng cách giữa các điểm**. Hai đoạn cho phép 0; khoảng cách phải là số nguyên lớn hơn 0. Đoạn cuối tính lùi từ cuối video. Các giá trị dùng khi xem trước được nhớ trên máy.
4. Bấm **Xem trước** để tự đọc lại thời lượng và các điểm hiện có. Không cần nhập thời lượng. Kiểm tra các mốc rồi bấm **Chèn điểm**.
5. Kiểm tra toàn bộ danh sách trong Studio, tự bấm **Tiếp tục/Lưu**.

Điểm đầu bằng đoạn đầu bạn nhập; mỗi mốc tiếp theo cộng khoảng cách. Mốc mới không nằm trong đoạn cuối và luôn trước thời điểm video kết thúc. Ví dụ video 10 phút, đoạn đầu 90 giây, đoạn cuối 150 giây, khoảng cách 120 giây: 01:30, 03:30, 05:30, 07:30.

Luồng chèn giữ mọi điểm có sẵn, kể cả trong đoạn đầu/cuối, và bỏ qua mốc dự kiến gần/trùng điểm cũ trong 1 giây. Khoảng cách tạo một lưới mốc mới; không ép toàn bộ điểm cũ cách đều. Đối chiếu gần/trùng dùng giây nguyên đối với mốc có bộ đếm phần nhỏ giây, để tránh chèn trùng; không giả định FPS. Tối đa 1.000 mốc dự kiến mỗi lần xem trước; tăng khoảng cách nếu vượt giới hạn.

## Dọn điểm

1. Chọn tab **Dọn điểm**. Nhập **Đoạn đầu không chèn**, **Đoạn cuối không chèn** bằng số giây nguyên từ 0 trở lên và **Khoảng cách tối thiểu khi dọn** bằng số giây nguyên lớn hơn 0. Tổng hai đoạn phải nhỏ hơn thời lượng video. Hai ô dọn có cài đặt riêng với tab Chèn điểm, mặc định 0 và được nhớ sau khi xem trước.
2. Bấm **Xem trước dọn**. Bước này tự đọc lại dữ liệu mới và chưa xóa điểm nào.
3. Kiểm tra các mốc và lý do, rồi bấm **Dọn điểm**.
4. Kiểm tra kết quả trong Studio và tự bấm **Tiếp tục/Lưu**.

Quy tắc áp dụng cho tất cả điểm thủ công, gồm điểm có sẵn:

- Xóa điểm thủ công trước mốc đầu và sau mốc cuối tính lùi từ cuối video. Nhập 0 để bỏ qua đoạn tương ứng. Giữ mốc đúng ranh giới nếu không vướng quy tắc dọn khác. Ví dụ video 10 phút, chừa đầu/cuối 60 giây: xóa điểm thủ công trước 01:00 và sau 09:00; mốc 01:00:00 và 09:00:00 được giữ, 09:00:17 nằm sau ranh giới nên được chọn xóa.
- Xóa điểm thủ công **Đang xem xét** (vòng tròn dấu hỏi), kể cả không có cảnh báo và không gần điểm khác. Không cần đợi mọi điểm có kết quả.
- Xóa điểm thủ công có cảnh báo chất lượng của YouTube.
- Với các điểm thủ công còn lại, giữ điểm sớm hơn và xóa điểm sau nếu gần hơn khoảng cách tối thiểu. Có so sánh phần nhỏ giây khi hai mốc cùng giây hoặc ở ranh giới khoảng cách. Nếu trộn bộ đếm phần nhỏ giây khác 0 với giây thập phân, tool dừng vì không thể so sánh chắc chắn khi chưa biết đơn vị bộ đếm.
- Luôn giữ mọi điểm tự động, kể cả trong hai đoạn đầu/cuối, có cảnh báo hoặc Đang xem xét. Điểm thủ công quá gần điểm tự động được chọn xóa dù nằm trước nó. Các điểm tự động vẫn được giữ nếu gần nhau.
- Giữ điểm chưa xác định được loại. Trạng thái đang tải/xử lý không được coi là Đang xem xét; tool dừng để chờ dữ liệu đầy đủ.

Tool vẫn bấm xóa riêng từng điểm. Khi Studio cập nhật ngay, nhiều lượt dùng chung thời gian chờ; đây không phải thao tác Xóa tất cả. Nếu loại/trạng thái điểm thủ công, danh sách hoặc cài đặt quảng cáo tự động thay đổi sau xem trước, hãy xem trước lại. Thay đổi các ô cài đặt cũng bỏ kế hoạch cũ. Thay đổi trạng thái xét duyệt của điểm tự động/chưa rõ loại không làm chúng bị chọn xóa. Nếu ranh giới đoạn cuối có phần lẻ giây nhưng mốc Studio cùng giây dùng bộ đếm không rõ đơn vị, tool dừng trước khi xóa thay vì đoán vị trí.

## Tải dữ liệu và làm việc khác

**Xem trước** và **Xem trước dọn** đều tự đọc lại dữ liệu, nên thường không cần bấm Tải lại trước đó. Dùng **Tải lại dữ liệu** khi bạn chỉ muốn kiểm tra thời lượng và trạng thái mới; nút này không tải lại trang, không yêu cầu YouTube đánh giá lại và không thay đổi điểm nào. Chuyển tab giữ cài đặt, bỏ kế hoạch cũ và đọc dữ liệu cho chức năng mới.

Sau khi bắt đầu, có thể dùng ứng dụng khác hoặc thu nhỏ Chrome. Máy phải còn thức, Chrome phải chạy, video và trình quảng cáo phải giữ nguyên. Extension không đưa Chrome lên trước hoặc chiếm chuột/bàn phím. Không đóng/chuyển video, mở DevTools của tab đó hoặc bấm Hủy trên thanh điều khiển Chrome trong lúc chạy. Dùng nút **Dừng** để dừng bình thường.

## Khi bị dừng hoặc gặp lỗi

Các thay đổi đã thực hiện vẫn nằm trong bản chỉnh sửa Studio; không tự lưu hoặc hoàn tác. Kiểm tra cả điểm cuối/nhóm đang xử lý. Khi chưa rõ kết quả một thao tác, tool không bấm thêm/xóa lại để tránh sửa nhầm. Nếu cài đặt quảng cáo tự động bị Studio thay đổi, kiểm tra và đặt lại theo ý bạn trước khi lưu hoặc xem trước lại.

Nếu Studio chưa cung cấp thời lượng, dữ liệu thuộc video khác, danh sách chỉ tải một phần hoặc giao diện chưa được nhận diện, đợi tải xong rồi **Xem trước** lại; nếu cần, lưu chỉnh sửa muốn giữ trước khi F5. Không lấy mốc quảng cáo cuối làm thời lượng video. Trường Studio `1:07:17` được đọc là 1 phút 7 giây với phần nhỏ giây 17; không phải 1 giờ 7 phút.

**Sao chép thông tin lỗi** chỉ hiện khi có lỗi và chỉ sao chép theo lần bấm của bạn, không tự gửi dữ liệu. Nếu clipboard bị chặn, dùng Ctrl+C với phần văn bản được chọn. Mở extension ở trang khác sẽ hiện hướng dẫn vào đúng trang Studio.

## Giới hạn kiểm chứng

Các kiểm thử dùng trang Studio mô phỏng và Chrome với hồ sơ tạm. Chưa kiểm chứng DOM, trạng thái điểm hoặc lưu thực tế trên tài khoản Studio của bạn. Một danh sách ảo không khai báo tổng số hàng vẫn có thể chưa được nhận diện; cấu trúc không rõ phải kiểm tra thủ công. Báo cáo rà soát trước nằm trong `artifacts/AUDIT-0.1.14.md`, kết quả các phiên bản nằm trong `artifacts/VERIFICATION.md` của mã nguồn.

Hoàn tất nghĩa là các điểm đã được đọc lại đúng trong trình chỉnh sửa. Bạn vẫn phải lưu; điểm chèn không bảo đảm quảng cáo được phân phát, theo [YouTube Trợ giúp](https://support.google.com/youtube/answer/6175006?hl=vi).
