# 🧠 MoodTok – Hướng dẫn chạy

## Chạy ứng dụng

Local, ứng dụng lưu tài khoản, check-in và khảo sát trong các file JSON ở thư mục `data/`. Trên Vercel, ứng dụng dùng PostgreSQL để học sinh và giáo viên luôn đọc dữ liệu từ cùng một nguồn.

1. Cài dependencies bằng `npm install`.
2. Chạy `npm start`.
3. Mở `http://localhost:3000`. Tài khoản giáo viên mặc định ở máy local là `admin` / `admin123`; đổi mật khẩu trước khi dùng thật.

### Deploy Vercel với Neon

1. Tạo project Neon và lấy **pooled connection string** trong mục **Connect**. Dùng connection string dạng `postgresql://...` có thông tin SSL do Neon cung cấp.
2. Trong Vercel → **Settings → Environment Variables**, thêm:
   - `DATABASE_URL`: pooled connection string Neon.
   - `JWT_SECRET`: chuỗi bí mật ngẫu nhiên; không dùng mật khẩu đăng nhập.
   - `INITIAL_TEACHER_USERNAME` và `INITIAL_TEACHER_PASSWORD`: tài khoản giáo viên đầu tiên.
3. Redeploy Vercel. Backend tự tạo các bảng cần thiết khi khởi động; không cần chạy SQL thủ công.

Neon Free hiện có hạn mức 100 CU-hours, 1 GB PostgreSQL storage và 5 GB truyền dữ liệu cho mỗi project. Database tự ngủ sau 5 phút không truy vấn và tự bật khi có request mới. Các trang giáo viên làm mới dữ liệu mỗi 15 giây khi tab đang mở và API không cache kết quả, nên check-in thường xuất hiện trong tối đa khoảng 15 giây. Vài trăm học sinh check-in mỗi ngày là tải nhỏ, nhưng thời gian giáo viên mở dashboard cũng giữ database hoạt động; theo dõi mục **Usage** của Neon. Nếu hết CU-hours hoặc dung lượng truyền dữ liệu miễn phí, compute sẽ tạm ngưng đến kỳ tiếp theo; nếu vượt giới hạn lưu trữ, thao tác ghi sẽ bị chặn. Các giới hạn này không xóa dữ liệu. Xem [bảng giá Neon](https://neon.com/pricing) trước khi bật gói trả phí.

Tài khoản/check-in cũ trong JSON hoặc filesystem tạm của Vercel không tự chuyển sang Neon. Tạo tài khoản giáo viên đầu tiên bằng hai biến `INITIAL_TEACHER_USERNAME` và `INITIAL_TEACHER_PASSWORD`; học sinh cần đăng ký/tạo lại nếu dữ liệu cũ không còn.

Local, ứng dụng tiếp tục dùng JSON trong `data/`; không cần đặt `DATABASE_URL`. Tài khoản giáo viên mặc định local là `admin` / `admin123`.

Biểu đồ của học sinh và biểu đồ lịch sử trong chi tiết học sinh ở trang giáo viên dùng cùng các bản ghi check-in; mỗi điểm là một lần check-in. Trang xu hướng toàn trường vẫn tổng hợp theo ngày và hiển thị số lượt check-in trong ngày.

**Bảo mật:** Không commit `.env` hoặc mật khẩu thật vào mã nguồn.

## ⚠️ QUAN TRỌNG

Có 2 cách mở website — chỉ dùng cách 1:

| Cách | Địa chỉ | Kết quả |
|------|---------|---------|
| ✅ **ĐÚNG** – Node.js server | `http://localhost:3000` | Có AI, lưu dữ liệu thật, đăng ký/đăng nhập hoạt động |
| ❌ **SAI** – Live Server / mở file trực tiếp | `127.0.0.1:5500` hoặc `file://...` | Không có backend, không lưu dữ liệu |

---

## 🚀 Cách khởi động

### Bước 1 – Mở Terminal trong VS Code
Nhấn **Ctrl + `** (backtick)

### Bước 2 – Chạy server
```
node server.js
```

### Bước 3 – Mở trình duyệt
Truy cập: **http://localhost:3000**

---

## 🔑 Tài khoản mặc định

| Vai trò | Tên đăng nhập | Mật khẩu |
|---------|--------------|----------|
| Giáo viên | `admin` | `admin123` |

Học sinh và giáo viên có thể **tự đăng ký** tại trang đăng nhập.

Mã xác thực để đăng ký giáo viên: **`HAUGIANG2024`**  
*(Lưu trong file `.env` → `SCHOOL_CODE`)*

---

## 🤖 Bật AI (Gemini)

1. Lấy API key miễn phí tại: https://aistudio.google.com/app/apikey
2. Mở file `.env`
3. Thay `your_gemini_api_key_here` bằng key của bạn:
   ```
   GEMINI_API_KEY=AIza...key_của_bạn...
   ```
4. Khởi động lại server

---

## 📁 Cấu trúc thư mục

```
tamly/
├── server.js          ← Backend Node.js (chạy cái này)
├── .env               ← Cấu hình (API key, mã trường)
├── data/              ← Dữ liệu lưu ở đây (JSON)
│   ├── users.json
│   ├── checkins.json
│   └── surveys.json
└── public/            ← Frontend (tự động serve bởi server)
    ├── index.html
    ├── login.html
    ├── checkin.html
    ├── result.html
    ├── dashboard.html
    └── survey.html
```

> **Lưu ý:** Thư mục `css/`, `js/`, `*.html` ngoài gốc là file **cũ** từ phiên bản trước.  
> **Chỉ dùng** thư mục `public/` khi chạy qua `node server.js`.
