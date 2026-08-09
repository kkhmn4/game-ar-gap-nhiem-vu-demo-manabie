# Gắp nhiệm vụ — Game AR khởi động

Trò chơi AR điều khiển bằng cử chỉ tay cho **hoạt động 1** của buổi demo Manabie
*"GẮP VIỆC – GIAO AI"*. Quả cầu nhiệm vụ rơi từ trên xuống, người chơi chụm ngón
tay để **gắp** và thả vào **giỏ nhiệm vụ** ở đáy màn hình.

Clone từ [`earth-defender-ar`](../../../game%20AR/earth-defender-ar) — giữ nguyên lớp
camera và nhận diện tay MediaPipe, thay toàn bộ cơ chế chơi từ *ngắm và bắn* sang
*gắp và thả*.

---

## Vai trò sư phạm

Trò chơi không phải để giải trí. Nó tạo ra **tiêu chí phân loại công việc**. Cả
ván có 12 quả, chia đều hai nhóm:

- **06 quả xanh — việc trí tuệ nhân tạo dựng được bản nháp:** xây khung ma trận đặc tả cho môn, soạn dự thảo kế hoạch bài dạy, soạn kịch bản trình chiếu, soạn phiếu học tập, gợi ý bài tập về nhà, tóm tắt bài học thành infographic.
- **06 quả cam — việc nhà giáo giữ lại:** đều cần hiện diện, cần thấu cảm hoặc cần thao tác vật lí. Trí tuệ nhân tạo không làm thay và không chịu trách nhiệm thay nhà giáo.

Sáu nhãn quả xanh chép đúng Phụ lục 2 của kế hoạch bài dạy ngày 10/8, trùng từng
chữ với **06 việc của hoạt động 2**. Nhờ vậy báo cáo viên nối được hai hoạt động
mà không cần thêm lời dẫn. Ma trận đặc tả theo đặc trưng môn học là nguồn chuẩn;
năm sản phẩm sau phải truy vết được về cùng yêu cầu cần đạt.

Màn hình tổng kết hiển thị sẵn lời chốt của mục d.1, hai tiêu chí phân loại và
chỉ dẫn mở **Phiếu học tập số 1 — Câu hỏi 1** trước khi chuyển sang hoạt động 2.

---

## Chạy

```bash
npm install
npm run dev        # http://localhost:3100
```

Camera cần **HTTPS hoặc localhost** thì trình duyệt mới cho phép truy cập.

```bash
npm run lint       # tsc --noEmit
npm run build      # dist/
npm run preview    # chạy bản dist
```

Để kiểm tra riêng màn chốt trong quá trình phát triển, mở
`http://localhost:3100/?qa=debrief`. Tham số này chỉ dựng một lượt kết quả mẫu,
không thay đổi luồng chơi thông thường.

### Triển khai Netlify

Kho mã có sẵn [`netlify.toml`](netlify.toml): Netlify chạy `npm run build` và
phát hành thư mục `dist`. Khi site đã liên kết với nhánh `main` trên GitHub, mỗi
lần đẩy commit mới sẽ tự tạo một bản triển khai production.

---

## Điều khiển

| Chế độ | Thao tác |
| ------ | -------- |
| **Camera** | Chụm ngón cái và ngón trỏ ngay trên quả cầu để gắp · kéo xuống giỏ · mở tay ra để thả |
| **Chuột** | Giữ chuột lên quả cầu để gắp · kéo xuống giỏ · thả chuột |

Hỗ trợ **2 tay cùng lúc** — hai người chơi song song được.

### Chế độ chuột là phương án dự phòng bắt buộc

Nếu phòng demo không có camera, quyền camera bị chặn, hoặc MediaPipe không tải
được, trò chơi **tự chuyển sang chế độ chuột** và hiện cảnh báo — buổi demo không
bị gián đoạn. Nên chạy thử một lượt bằng chuột trước khi lên trình bày.

---

## Ba mức tốc độ

| Mức | Thời gian | Nhịp rơi | Tỉ lệ quả nhiễu |
| --- | --------: | -------: | --------------: |
| Thong thả | 120 giây | 1500 ms | 35% |
| Chuẩn | 90 giây | 1150 ms | 45% |
| Nhanh | 70 giây | 850 ms | 55% |

Trong hoạt động khởi động, dành **3 phút** cho một lượt chơi — dùng mức **Nhanh** hoặc **Chuẩn**.

---

## Kết thúc ván

Ván dừng khi **gắp đủ 6 nhiệm vụ cốt lõi** hoặc **hết giờ**. Hàng đợi quả cầu được
dựng sao cho cả 6 nhiệm vụ cốt lõi **chắc chắn xuất hiện**, rải đều — không phó mặc
cho ngẫu nhiên. Quả cốt lõi chưa gắp được sẽ thả lại.

---

## Cấu trúc

```text
src/
├── data/tasks.ts          # 06 quả xanh + 06 quả cam
├── utils/engine.ts        # Vòng lặp game, cơ chế gắp/thả, vẽ canvas
├── utils/audio.ts         # Tổng hợp âm bằng WebAudio, không tải tệp ngoài
├── components/Game.tsx    # Camera, MediaPipe HandLandmarker, fallback chuột
├── App.tsx                # Ba màn hình: giới thiệu · chơi · tổng kết
└── index.css              # Tailwind 4 + bảng màu Manabie
```

---

## Hệ thống thiết kế

Giao diện được dựng cho **một phòng tập huấn có máy chiếu**, người xem cách màn
hình 5–15 mét — không phải cho người ngồi trước laptop. Ràng buộc này chi phối
mọi quyết định bên dưới.

### Bộ chữ

| Vai trò | Bộ chữ | Vì sao |
| ------- | ------ | ------ |
| Hiển thị và nội dung | **Be Vietnam Pro** 400–900 | Bộ chữ thiết kế riêng cho dấu tiếng Việt. Ở cỡ tiêu đề 112 px, mọi lỗi chồng dấu (`Ắ`, `Ệ`, `Ữ`) đều lộ ra ngay |
| Chữ số bảng điểm | **JetBrains Mono** 700 | Chữ số đều bề ngang, đồng hồ đếm lùi không bị nhảy chữ |

> **JetBrains Mono không có subset tiếng Việt.** Vì vậy nó chỉ dùng cho **chữ số**.
> Mọi nhãn có dấu đều dùng `.t-eyebrow` (Be Vietnam Pro giãn chữ), kể cả nhãn vẽ
> trên canvas. Đây là lỗi dễ mắc: đặt nhãn tiếng Việt vào font mono thì chữ rơi
> về font hệ thống mà nhìn thoáng qua không nhận ra.

### Giãn dòng cho tiếng Việt

Chữ hoa tiếng Việt cần chỗ cho **cả dấu chồng phía trên** (`Ắ`, `Ổ`, `Ữ`) **lẫn dấu
nặng phía dưới** (`Ệ`, `Ụ`). Các trị số `line-height` quen dùng cho chữ Latin
(0.9–0.95) sẽ làm dấu trào lên đè dòng trên.

| Lớp | `line-height` | `padding-top` |
| --- | ------------: | ------------: |
| `.t-hero` | 1.04 | 0.16em |
| `.t-title` | 1.12 | 0.10em |

`padding-top` tính theo `em` nên tự co giãn cùng cỡ chữ ở mọi khổ màn hình.

### Bảng màu

Sáng hơn màu thương hiệu gốc một bậc — máy chiếu làm nhạt các tông trung tính
bão hòa, `#3C5AD2` chiếu lên tường xám đi rõ rệt.

| Vai trò | Mã màu | Gốc Manabie |
| ------- | ------ | ----------- |
| Nền | `#050A1C` → `#0D1836` | — |
| Quả cốt lõi | `#4C6DF0` | `#3C5AD2` |
| Giỏ, điểm nhấn | `#00D89A` | `#01C98D` |
| Quả nhiễu | `#FF6A3D` | — |
| Chữ | `#EEF2FF` | — |

### Chữ ký thị giác: dấu chụm ngón

Hai chấm tiến lại gần nhau — chính là cử chỉ điều khiển của trò chơi. Dùng lại ở
bốn chỗ: dấu mở đoạn, trạng thái chờ camera, nút chính, và con trỏ tay vẽ trên
canvas. Đây là thứ duy nhất được phép "làm dáng"; mọi chi tiết khác giữ im lặng.

### Ô nhiệm vụ thay cho dòng chữ tiến độ

Sáu ô nhiệm vụ sáng dần lên là **vật thể tiến độ**, thay cho dòng chữ "2/6". Từ
cuối phòng, người xem đọc được ngay còn thiếu việc nào — điều mà một con số không
làm được. Giỏ trên canvas cũng dâng mức chứa theo tiến độ.

### Gợi ý thao tác

Khi bàn tay lại gần một quả cầu, một vòng nét đứt hiện dần quanh quả đó. Người
chơi biết mình sắp gắp trúng cái gì trước khi chụm tay — không phải đoán.

---

## Sửa nội dung nhiệm vụ

Toàn bộ danh sách nằm ở [`src/data/tasks.ts`](src/data/tasks.ts). Đổi nhiệm vụ chỉ
cần sửa tệp này — không phải chạm vào engine.

Sáu nhãn quả xanh phải khớp Phụ lục 2 của kế hoạch bài dạy; sửa một bên thì sửa
luôn bên kia.

Quả cam cần nhẹ nhàng nhưng không hạ thấp nghề. Mục đích là buộc người chơi phân
biệt hai nhóm việc, không phải chê công việc của nhà giáo. Mỗi quả cam phải là
việc cần hiện diện, cần thấu cảm hoặc cần thao tác vật lí; việc ngoài chuyên môn
nhà giáo, chẳng hạn đỗ xe hay ăn trưa, không giúp phân loại nên đã bỏ.

Mỗi mục trong `NOISE_TASKS` cần ghi rõ `iconIndex`. Bỏ hoặc thêm một mục mà để
trống trường này thì biểu tượng của cả nhóm sẽ đổi hình theo vị trí trong
`ALL_TASKS`.

---

## Đã kiểm chứng

| Kiểm tra | Kết quả |
| -------- | ------- |
| `npm run lint` (tsc strict) | ✅ Sạch |
| `npm run build` | ✅ JS 364.52 kB · gzip 114.23 kB · CSS 93.64 kB |
| Chạy thật chế độ chuột | ✅ Canvas, HUD, đồng hồ và nhịp rơi hoạt động |
| Màn chốt 6/6 | ✅ Dựng bằng trạng thái QA, đủ 06 nhiệm vụ và không phải cuộn ở 1920×1080 |
| Lỗi console / lỗi trang | ✅ Không có |
| Tài nguyên ảnh / yêu cầu mạng thất bại | ✅ Không có |
| Bố cục desktop 1920×1080 | ✅ Màn mở đầu và màn chốt không tràn ngang/dọc |
| Bố cục mobile 390×844 | ✅ Không tràn ngang, cho phép cuộn dọc |
| Độ mượt màn chơi | ✅ 101 mẫu, trung bình 17.89 ms; p95 19 ms |
| Tiếng Việt trên canvas | ✅ Hiển thị đúng, tự xuống dòng theo bề rộng quả |
| Subset `vietnamese` được đóng gói | ✅ Đủ 5 trọng số Be Vietnam Pro trong `dist/` |
| Dấu chồng ở cỡ tiêu đề 112 px | ✅ Không đè dòng trên (chụp màn hình 1920×1080) |
| Giảm chuyển động | ✅ Tôn trọng `prefers-reduced-motion` |
| Viền hội tụ bàn phím | ✅ `:focus-visible` viền mint 3 px |

Chế độ camera chưa kiểm được tự động vì môi trường kiểm thử không có webcam —
**cần chạy thử tay trên máy sẽ dùng để trình bày.**
