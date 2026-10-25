# 🧠 MoodTok – Hướng dẫn chạy

## Đưa website lên Vercel

Project đã có cấu hình Vercel. Để deploy:

1. Đưa toàn bộ mã nguồn lên một GitHub repository. Không đưa file `.env` lên GitHub.
2. Trên Vercel, chọn **Add New → Project**, import repository rồi bấm **Deploy**.
3. Trong **Project Settings → Environment Variables**, thêm các biến cần dùng:
   - `JWT_SECRET`: chuỗi bí mật dài, tự tạo riêng.
   - `INITIAL_TEACHER_USERNAME` và `INITIAL_TEACHER_PASSWORD`: tài khoản giáo viên ban đầu.
   - `INITIAL_TEACHER_NAME`: không bắt buộc.
   - `GROQ_API_KEY` / `GROQ_MODEL` hoặc `GEMINI_API_KEY` / `GEMINI_MODEL`: không bắt buộc, dùng để bật AI.
   - `SCHOOL_CODE`: nếu ứng dụng sử dụng mã trường.
4. Bấm **Redeploy** sau khi thêm hoặc thay đổi biến môi trường. Vercel sẽ cấp link dạng `ten-du-an.vercel.app`.

**Lưu ý dữ liệu:** Vercel chạy backend dạng serverless. Project hiện lưu tài khoản, check-in và khảo sát trong file JSON; trên Vercel các file này nằm trong thư mục tạm và có thể mất khi function khởi động lại. Vì vậy bản deploy hiện tại phù hợp để xem thử, chưa phù hợp để lưu dữ liệu thật. Muốn giữ dữ liệu ổn định cần chuyển sang database trước khi dùng thực tế.

Biểu đồ của học sinh và biểu đồ lịch sử trong chi tiết học sinh ở trang giáo viên dùng cùng các bản ghi check-in; mỗi điểm là một lần check-in. Trang xu hướng toàn trường vẫn tổng hợp theo ngày và hiển thị số lượt check-in trong ngày.

**Bảo mật:** Không commit `.env`, không đưa API key vào mã nguồn và không dùng lại các key đã bị chia sẻ. Hãy thu hồi key cũ và tạo key mới trước khi deploy.

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
