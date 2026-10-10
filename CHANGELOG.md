# Lịch sử thay đổi

0.1.17: mở rộng bảng hướng dẫn popup lên 460 px, tăng cỡ chữ và khoảng cách. Đặt chiều rộng cố định trên phần tử gốc, bỏ giới hạn theo viewport để tránh co hẹp khi Chrome đo kích thước popup ban đầu. Kiểm tra thông báo dài, hướng dẫn và viewport khởi tạo 25 px; giữ nguyên bảng chèn/dọn trong Studio.

0.1.16: thiết kế lại popup và bảng Studio, cố định header/tab/thanh thao tác, gom thiết lập, bỏ nút cộng/trừ để đồng nhất ô nhập và quy đổi giây, báo lỗi ngay tại ô nhập, phân biệt nút chèn/dọn và hiển thị số điểm. Thêm tiến độ đã xác nhận, giữ kế hoạch sau chạy để đối chiếu và yêu cầu xem trước lại. Làm rõ neo tự động ở trước/sau và lý do xóa từng mốc. Rút gọn hướng dẫn lặp; sửa phiên bản trong báo cáo lỗi popup. Thêm kiểm tra bố cục nhỏ, bàn phím, tiến độ/Dừng và preview. Giữ nguyên thuật toán, bảo vệ mọi điểm tự động/chưa rõ loại và việc người dùng tự Lưu.

0.1.15: thêm hai ô đoạn đầu/cuối riêng trong tab Dọn điểm, ghi nhớ cài đặt, mặc định 0. Xóa các điểm thủ công ngoài cửa sổ được phép, giữ mốc đúng ranh giới; luôn giữ mọi điểm tự động và chưa rõ loại, kể cả trong hai đoạn loại trừ. Preview ghi lý do, đổi ô nhập hủy preview. Kiểm tra bộ đếm phần nhỏ giây tại ranh giới cuối và dừng trước khi xóa nếu không so sánh được chắc chắn. Quy tắc Đang xem xét/cảnh báo/khoảng cách và việc tự Lưu giữ nguyên.

0.1.14: rà soát đầy đủ thuật toán và vòng đời, sửa thứ tự phần nhỏ giây, loading/help false positives, điểm bất biến/tự động mới, metadata và availability. Tối ưu đọc DOM/commit microtask, mở lại bảng và IPC abort. Rút hướng dẫn và sửa kiểm thử/benchmark. Chi tiết ở artifacts/AUDIT-0.1.14.md.

0.1.13 đổi quy tắc dọn theo yêu cầu: xóa tất cả điểm **thủ công Đang xem xét**, kể cả điểm có sẵn và điểm không có cảnh báo, không phụ thuộc khoảng cách. Sau đó xóa điểm thủ công có cảnh báo và lọc khoảng cách giữa các điểm còn lại. Mọi điểm tự động và điểm chưa rõ loại vẫn được giữ. Preview ghi lý do Đang xem xét và số điểm sẽ xóa; thay đổi trạng thái sau preview vẫn yêu cầu xem trước lại. Không tự lưu.

Lịch sử các bản trước (quy tắc giữ điểm Đang xem xét ở các bản cũ đã được thay bằng quy tắc xóa điểm thủ công ở 0.1.13):

0.1.12 nhận diện **Đang xem xét** và biểu tượng vòng tròn dấu hỏi trong hàng quảng cáo (help_outline/help-outline/help-circle/question-mark-circle hoặc glyph dấu hỏi). Nhận diện cả icon trang trí aria-hidden nhưng vẫn hiển thị, nhãn/tooltip được liên kết qua aria-describedby và shadow root mở. Giữ điểm đang xem xét khỏi cả hai quy tắc dọn dù có cảnh báo hoặc quá gần; số đếm gồm cả điểm chưa rõ nguồn. Đọc lại trạng thái trước khi xóa và dừng nếu trạng thái đổi sau xem trước hoặc trong lượt dọn. Icon ẩn thực sự/biểu tượng trợ giúp ngoài hàng không dùng để phân loại.

0.1.11 tăng tốc chèn và dọn: khi seek thật đã xác nhận và ô mới xuất hiện đúng mốc duy nhất, bỏ lượt chờ nhận diện 400 ms, vẫn chờ xác nhận sau nhập và kiểm tra cuối. Dọn theo nhóm tối đa 5: đọc lại và đối chiếu đúng một điểm mất sau từng click; phản hồi tức thời dùng chung một cửa sổ ổn định 400 ms cho nhóm. Phản hồi chậm vẫn chờ từng điểm. Chỉ báo tiến độ nhóm đã xác nhận; dừng/lỗi có thể để lại nhóm đã bấm xóa nhưng chưa xác nhận, thông báo số điểm trong nhóm cần kiểm tra. Không chèn nhiều điểm song song, không dùng nút Xóa tất cả hoặc API nội bộ.

Đo fixture 200 điểm cũ với toàn bộ danh sách dựng lại: 5 điểm chèn giảm 5,95 → 3,77 giây (khoảng 37% thời gian); 20 điểm xóa giảm 11,47 → 3,36 giây (khoảng 71%). Dữ liệu ở artifacts/performance-v0.1.11.json. Đây là phép đo cục bộ một lượt, không phải mức tăng bảo đảm trên Studio thật.

0.1.10 chia giao diện thành hai tab **Chèn điểm** và **Dọn điểm**, bỏ checkbox xác nhận xét duyệt. Nút **Tải lại dữ liệu** dùng chung đọc lại thời lượng, điểm chèn và cảnh báo đang có trong Studio, giữ các ô cài đặt và bỏ kế hoạch xem trước cũ. Không tải lại trang hay tự lưu. Chuyển tab giữ cài đặt, xóa preview của chức năng trước và tự đọc dữ liệu cho chức năng mới; không chuyển tab/tải dữ liệu khi đang chèn hoặc dọn.

0.1.9 thêm luồng **Xem trước dọn → Dọn điểm**, dùng sau khi đã lưu, đợi YouTube xét duyệt và mở lại trình quảng cáo. Xóa các điểm thủ công có cảnh báo đỏ, rồi lọc các điểm thủ công không có cảnh báo quá gần theo khoảng cách tối thiểu người dùng nhập, giữ điểm sớm hơn. Giữ mọi điểm tự động; điểm thủ công quá gần điểm tự động được chọn xóa. Điểm không rõ loại hoặc đang xét duyệt được giữ nguyên. Preview liệt kê từng mốc và lý do. Sau mỗi lần xóa đối chiếu toàn bộ điểm còn lại. Không xóa lại khi chưa rõ kết quả, không tự lưu. Nhận diện cảnh báo và nguồn điểm mới chỉ được kiểm thử trên fixture, chưa trên Studio thật.

0.1.8 bỏ mục hỗ trợ thường trực, chỉ hiện nút Sao chép thông tin lỗi khi có lỗi. Sao chép theo lần bấm của người dùng, có fallback chọn văn bản/Ctrl+C nếu clipboard bị chặn; không gửi thông tin ra ngoài. Biểu tượng luôn mở popup: ở tab video Studio, popup mở bảng trên trang rồi đóng; ở trang khác, danh sách video hay trang chrome://, popup hiện hướng dẫn và liên kết mở Studio. Trên video chưa mở hộp quảng cáo, bảng hướng dẫn mở hộp rồi Xem trước. Không dùng dấu ! thay cho thông báo. Giữ quyền và cơ chế chèn của 0.1.7.

0.1.7 tăng tốc đọc danh sách: gom ô thời gian/nút xóa theo tổ tiên một lần trong mỗi lượt đọc, bỏ so sánh từng cặp nút và dùng bộ đếm để đối chiếu các mốc cũ. Chỉ dùng cache style trong chính lượt đọc, không giữ cache DOM qua các lượt cập nhật Studio. Khi player thực tế đã xác nhận vị trí mới, bỏ lượt chờ 300 ms riêng cho ô hiển thị; trường hợp không có player vẫn chờ như cũ. Giữ đủ hai cửa sổ ổn định 400 ms để nhận diện ô mới và xác nhận mốc đã nhập.

Benchmark cục bộ so với ZIP 0.1.6: với 200 điểm cũ và dựng lại toàn bộ danh sách mỗi lần, 5 mốc mới giảm từ 8,78 xuống 5,97 giây (giảm khoảng 32% thời gian); median một snapshot giảm từ 20,4 xuống 4,6 ms. Đây là tốc độ trên fixture, không phải cam kết trên Studio thật. Dữ liệu ở artifacts/performance.json.

0.1.6 xử lý vị trí phát thực tế: khi nhận diện được player của đúng video hoặc một video native trong hộp quảng cáo, tạm dừng preview, seek đến mốc và đọc lại vị trí trước khi chèn. Nếu player đã nhận diện không di chuyển được, dừng trước khi tạo điểm. Nếu không có player hỗ trợ, vẫn chỉ sửa ô mới nhận diện chắc chắn; ô thời gian hiển thị không được coi là bằng chứng thanh timeline đã di chuyển. Sau chèn, chờ danh sách ổn định thay vì báo lỗi ngay khi Studio vẽ lại; đối chiếu đủ từng lần xuất hiện của mốc cũ. Khi điểm mới trùng vị trí thanh timeline và tất cả ô bị thay, tiếp tục dừng an toàn và báo mốc cụ thể.

0.1.5 dùng chrome.debugger và Emulation.setFocusEmulationEnabled để giữ riêng tab Studio hoạt động trong lúc chèn, kể cả khi bạn dùng ứng dụng khác hoặc thu nhỏ Chrome. Không đưa cửa sổ lên trước, chọn tab khác hay chiếm chuột/bàn phím toàn máy. Cần quyền debugger bắt buộc; Chrome hiện thanh thông báo trong lúc phiên điều khiển hoạt động. Phiên được ngắt sau khi xong, dừng, lỗi, chuyển trang hoặc mất kết nối. Quyền này không thể khai báo tùy chọn theo API Chrome.

Giữ việc xác nhận mốc ổn định và kiểm tra danh sách cuối của 0.1.4. Không chèn lại tự động sau một thao tác có kết quả chưa rõ.

Giữ việc tự đọc thời lượng của 0.1.3: không có ô nhập tay; ưu tiên dữ liệu đúng ID video và không suy đoán từ mốc quảng cáo cuối. Giữ định dạng mốc `1:07:17`, nút −/+ và bản sửa focus. Sau khi cập nhật cần Tải lại extension trong Chrome và F5 tab Studio.
