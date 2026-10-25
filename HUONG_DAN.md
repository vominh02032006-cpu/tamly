# 🧠 MoodTok – Hướng dẫn chạy

## Chạy ứng dụng

Ứng dụng lưu tài khoản, check-in và khảo sát trong các file JSON ở thư mục `data/`; không cần Supabase.

1. Cài dependencies bằng `npm install`.
2. Chạy `npm start`.
3. Mở `http://localhost:3000`. Tài khoản giáo viên mặc định ở máy local là `admin` / `admin123`; đổi mật khẩu trước khi dùng thật.

Khi deploy lên Vercel, cần đặt `JWT_SECRET` trong Environment Variables. Giáo viên có thể tạo tài khoản tại trang đăng nhập; tài khoản mặc định `admin` / `admin123` chỉ được tạo khi chạy local. Vercel chỉ cho phép ghi dữ liệu tạm trong `/tmp`: dữ liệu có thể mất khi function khởi động lại và không được chia sẻ ổn định giữa các function hoặc người dùng. Vì vậy JSON trên Vercel phù hợp để chạy thử, nhưng không thể bảo đảm giáo viên luôn nhận được dữ liệu check-in của học sinh. Muốn dữ liệu dùng chung và lưu bền, ứng dụng cần chạy trên máy chủ có ổ đĩa bền vững hoặc dùng một dịch vụ lưu trữ.

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
