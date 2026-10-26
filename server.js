require('dotenv').config();
const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');
const { randomUUID } = require('crypto');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const IS_VERCEL  = process.env.VERCEL === '1';
const JWT_SECRET = process.env.JWT_SECRET || (IS_VERCEL ? '' : 'moodtok_secret');
const DATABASE_URL = process.env.DATABASE_URL || '';
const DB_POOL = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL, max: 1 }) : null;
const DB_PATH = path.join(__dirname, 'data');
const DATA_TABLES = {
  'users.json': 'moodtok_users',
  'checkins.json': 'moodtok_checkins',
  'surveys.json': 'moodtok_surveys'
};
DB_POOL?.on('error', error => console.error('Database connection error:', error.message));

// ── Khởi tạo thư mục & file dữ liệu ──────────────────────────────
if (!IS_VERCEL && !DB_POOL && !fs.existsSync(DB_PATH)) fs.mkdirSync(DB_PATH, { recursive: true });

async function readJSON(file) {
  if (DB_POOL) {
    const table = DATA_TABLES[file];
    if (!table) throw new Error(`Không hỗ trợ bộ dữ liệu: ${file}`);
    const { rows } = await DB_POOL.query(`SELECT data FROM ${table}`);
    return rows.map(row => row.data);
  }

  if (IS_VERCEL) throw new Error('Thiếu DATABASE_URL để kết nối cơ sở dữ liệu.');
  const fp = path.join(DB_PATH, file);
  if (!fs.existsSync(fp)) return [];
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

function writeJSON(file, data) {
  if (IS_VERCEL || DB_POOL) throw new Error('Không thể ghi file JSON khi đang dùng cơ sở dữ liệu.');
  fs.writeFileSync(path.join(DB_PATH, file), JSON.stringify(data, null, 2));
}

async function insertRecord(file, record) {
  if (DB_POOL) {
    const table = DATA_TABLES[file];
    if (!table) throw new Error(`Không hỗ trợ bộ dữ liệu: ${file}`);
    const columns = ['id', 'data'];
    const values = [record.id, record];
    if (file === 'users.json') {
      columns.push('username');
      values.push(record.username);
    } else {
      columns.push('student_id', 'date');
      values.push(record.studentId, record.date);
    }
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
    try {
      await DB_POOL.query(
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
        values
      );
    } catch (error) {
      if (file === 'users.json' && error.code === '23505') error.status = 409;
      throw error;
    }
    return record;
  }

  const records = await readJSON(file);
  records.push(record);
  writeJSON(file, records);
  return record;
}

async function updateRecord(file, id, changes) {
  const records = await readJSON(file);
  const current = records.find(record => record.id === id);
  if (!current) return null;
  const updated = { ...current, ...changes };

  if (DB_POOL) {
    const table = DATA_TABLES[file];
    if (!table) throw new Error(`Không hỗ trợ bộ dữ liệu: ${file}`);
    const { rowCount } = await DB_POOL.query(
      `UPDATE ${table} SET data = $1 WHERE id = $2`,
      [updated, id]
    );
    return rowCount ? updated : null;
  }

  writeJSON(file, records.map(record => record.id === id ? updated : record));
  return updated;
}

async function deleteRecord(file, id) {
  if (DB_POOL) {
    const table = DATA_TABLES[file];
    if (!table) throw new Error(`Không hỗ trợ bộ dữ liệu: ${file}`);
    const { rowCount } = await DB_POOL.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    return rowCount;
  }

  const records = await readJSON(file);
  const remaining = records.filter(record => record.id !== id);
  writeJSON(file, remaining);
  return records.length - remaining.length;
}

async function deleteStudentCheckins(studentId) {
  if (DB_POOL) {
    const { rowCount } = await DB_POOL.query(
      'DELETE FROM moodtok_checkins WHERE student_id = $1',
      [studentId]
    );
    return rowCount;
  }

  const checkins = await readJSON('checkins.json');
  const remaining = checkins.filter(checkin => checkin.studentId !== studentId);
  writeJSON('checkins.json', remaining);
  return checkins.length - remaining.length;
}

// Seed tài khoản mặc định nếu chưa có
async function seedUsers() {
  let users = await readJSON('users.json');
  if (users.length === 0) {
    const username = process.env.INITIAL_TEACHER_USERNAME || (IS_VERCEL ? '' : 'admin');
    const password = process.env.INITIAL_TEACHER_PASSWORD || (IS_VERCEL ? '' : 'admin123');
    if (username && password) {
      users = [
        {
          id: 'GV' + randomUUID(),
          name: process.env.INITIAL_TEACHER_NAME || 'Giáo viên tư vấn',
          role: 'teacher',
          class: null,
          username,
          password: bcrypt.hashSync(password, 10),
          createdAt: new Date().toISOString()
        }
      ];
      if (DB_POOL) {
        await DB_POOL.query(
          `INSERT INTO moodtok_users (id, username, data)
           VALUES ($1, $2, $3)
           ON CONFLICT (username) DO NOTHING`,
          [users[0].id, users[0].username, users[0]]
        );
      } else {
        writeJSON('users.json', users);
      }
      console.log('✅ Đã tạo tài khoản giáo viên ban đầu');
    } else {
      console.warn('⚠️  Chưa tạo giáo viên ban đầu. Cấu hình INITIAL_TEACHER_USERNAME và INITIAL_TEACHER_PASSWORD.');
    }
  }
  if (!DB_POOL) {
    if (!fs.existsSync(path.join(DB_PATH, 'checkins.json'))) writeJSON('checkins.json', []);
    if (!fs.existsSync(path.join(DB_PATH, 'surveys.json'))) writeJSON('surveys.json', []);
  }
}

async function initializeStorage() {
  if (IS_VERCEL && !DB_POOL) {
    throw new Error('Thiếu DATABASE_URL. Hãy thêm connection string Neon vào Environment Variables trên Vercel.');
  }
  if (DB_POOL) {
    await DB_POOL.query(`
      CREATE TABLE IF NOT EXISTS moodtok_users (
        id text PRIMARY KEY,
        username text NOT NULL UNIQUE,
        data jsonb NOT NULL
      );
      CREATE TABLE IF NOT EXISTS moodtok_checkins (
        id text PRIMARY KEY,
        student_id text NOT NULL REFERENCES moodtok_users (id) ON DELETE CASCADE,
        date timestamptz NOT NULL,
        data jsonb NOT NULL
      );
      CREATE TABLE IF NOT EXISTS moodtok_surveys (
        id text PRIMARY KEY,
        student_id text NOT NULL REFERENCES moodtok_users (id) ON DELETE CASCADE,
        date timestamptz NOT NULL,
        data jsonb NOT NULL
      );
      CREATE INDEX IF NOT EXISTS moodtok_checkins_student_date_idx
        ON moodtok_checkins (student_id, date DESC);
      CREATE INDEX IF NOT EXISTS moodtok_surveys_student_date_idx
        ON moodtok_surveys (student_id, date DESC);
    `);
  }
  await seedUsers();
}
const storageReady = initializeStorage().then(
  () => null,
  error => error
);

app.use('/api', async (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  const error = await storageReady;
  if (error) {
    console.error('Storage initialization failed:', error.message);
    return res.status(503).json({
      error: IS_VERCEL
        ? 'Không kết nối được cơ sở dữ liệu. Hãy kiểm tra DATABASE_URL và cấu hình Neon trên Vercel.'
        : 'Không thể khởi tạo nơi lưu dữ liệu. Vui lòng kiểm tra log máy chủ.'
    });
  }
  if (!JWT_SECRET) {
    return res.status(503).json({
      error: 'Thiếu JWT_SECRET trên Vercel. Hãy thêm biến môi trường rồi deploy lại.'
    });
  }
  next();
});

// ══════════════════════════════════════════════════════════════════
// AI – Groq (miễn phí 14400 req/ngày) + Gemini dự phòng
// ══════════════════════════════════════════════════════════════════
const GROQ_API_KEY   = process.env.GROQ_API_KEY   || '';
const GROQ_MODEL     = process.env.GROQ_MODEL     || 'llama-3.1-8b-instant';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL   = process.env.GEMINI_MODEL   || 'gemini-3.8-flash';

const SYSTEM_PROMPT = `Bạn là trợ lý sức khỏe tinh thần MoodTok, hỗ trợ học sinh THPT tại Việt Nam.
Chỉ trả lời về: sức khỏe tinh thần, cảm xúc, stress, giấc ngủ, học tập, mạng xã hội, kỹ năng sống.
Nếu câu hỏi không liên quan, từ chối nhẹ: "Mình chỉ hỗ trợ về sức khỏe tinh thần thôi nhé."
Trả lời tiếng Việt, thân thiện, tối đa 200 từ.
Dùng **in đậm** cho các từ quan trọng.
Dùng danh sách đánh số (1. 2. 3.) khi liệt kê các bước hoặc gợi ý.
Không chẩn đoán bệnh, không thay thế chuyên gia.
Nếu có dấu hiệu tự làm hại, khuyên gặp giáo viên tư vấn ngay.`;

function isAIConfigured() {
  return (GROQ_API_KEY && GROQ_API_KEY !== 'your_groq_api_key_here') ||
         (GEMINI_API_KEY && GEMINI_API_KEY.startsWith('AIzaSy'));
}

function getAIProvider() {
  if (GROQ_API_KEY && GROQ_API_KEY !== 'your_groq_api_key_here') return 'groq';
  if (GEMINI_API_KEY && GEMINI_API_KEY.startsWith('AIzaSy')) return 'gemini';
  return null;
}

function httpsPost(hostname, path, headers, body) {
  const https = require('https');
  return new Promise((resolve, reject) => {
    const buf = Buffer.from(body);
    const req = https.request(
      { hostname, path, method: 'POST', headers: { ...headers, 'Content-Length': buf.length }, timeout: 30000 },
      (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          if (res.statusCode !== 200) return reject(new Error(`${res.statusCode}: ${d.slice(0,200)}`));
          try { resolve(JSON.parse(d)); } catch(e) { reject(e); }
        });
      }
    );
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout 30s')); });
    req.on('error', reject);
    req.write(buf);
    req.end();
  });
}

async function callGroq(prompt) {
  // Thử từng model theo thứ tự ưu tiên
  const models = [
    GROQ_MODEL,
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen/qwen3.8-27b',
  ].filter((m, i, a) => a.indexOf(m) === i); // bỏ trùng

  for (const model of models) {
    try {
      const body = JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: prompt }
        ],
        max_tokens: 800, temperature: 0.7
      });
      const data = await httpsPost(
        'api.groq.com',
        '/openai/v1/chat/completions',
        { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
        body
      );
      const text = data?.choices?.[0]?.message?.content;
      if (text) { console.log(`✅ Groq OK (${model})`); return text; }
    } catch(e) {
      if (e.message.includes('404') || e.message.includes('does not exist')) {
        console.log(`⚠️  Groq model ${model} không có, thử tiếp...`);
        continue;
      }
      throw e;
    }
  }
  return null;
}

async function callGeminiAPI(prompt) {
  const body = JSON.stringify({
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 800, temperature: 0.7 }
  });
  const data = await httpsPost(
    'generativelanguage.googleapis.com',
    `/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    { 'Content-Type': 'application/json' },
    body
  );
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

async function callGemini(prompt) {
  const provider = getAIProvider();
  if (!provider) return null;
  try {
    if (provider === 'groq') {
      const r = await callGroq(prompt);
      if (r) { console.log(`✅ Groq OK`); return r; }
    } else {
      const r = await callGeminiAPI(prompt);
      if (r) { console.log(`✅ Gemini OK`); return r; }
    }
  } catch(e) {
    const msg = e.message || '';
    if (msg) console.error(`AI error (${provider}):`, msg.slice(0,150));
  }
  return null;
}

// ── Middleware xác thực ───────────────────────────────────────────
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Chưa đăng nhập' });
  try {
    req.user = jwt.verify(header.replace('Bearer ', ''), JWT_SECRET);
    next();
  } catch { res.status(401).json({ error: 'Token không hợp lệ' }); }
}

function teacherOnly(req, res, next) {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Không có quyền truy cập' });
  next();
}

// ══════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ══════════════════════════════════════════════════════════════════

// ── Đăng nhập ────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Vui lòng nhập đầy đủ thông tin' });

  const users = await readJSON('users.json');
  const user  = users.find(u => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng' });

  const token = jwt.sign(
    { id: user.id, name: user.name, role: user.role, class: user.class, username: user.username },
    JWT_SECRET, { expiresIn: '7d' }
  );
  res.json({ token, user: { id: user.id, name: user.name, role: user.role, class: user.class, username: user.username } });
});

// ── Đăng ký học sinh (tự đăng ký) ───────────────────────────────
app.post('/api/auth/register-student', async (req, res) => {
  const { name, username, password, studentClass } = req.body;

  if (!name || !username || !password || !studentClass)
    return res.status(400).json({ error: 'Vui lòng điền đầy đủ tất cả thông tin' });

  if (!/^[a-zA-Z0-9_]+$/.test(username))
    return res.status(400).json({ error: 'Tên đăng nhập chỉ được dùng chữ, số và dấu gạch dưới, không có khoảng trắng' });

  if (password.length < 6)
    return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });

  const users = await readJSON('users.json');
  if (users.find(u => u.username === username))
    return res.status(400).json({ error: 'Tên đăng nhập đã tồn tại, vui lòng chọn tên khác' });

  const newStudent = {
    id:        'HS' + randomUUID(),
    name:      name.trim(),
    role:      'student',
    class:     studentClass.trim(),
    username,
    password:  bcrypt.hashSync(password, 10),
    createdAt: new Date().toISOString()
  };
  try {
    await insertRecord('users.json', newStudent);
  } catch (error) {
    if (error.status === 409) return res.status(400).json({ error: 'Tên đăng nhập đã tồn tại, vui lòng chọn tên khác' });
    throw error;
  }

  const token = jwt.sign(
    { id: newStudent.id, name: newStudent.name, role: 'student', class: newStudent.class, username: newStudent.username },
    JWT_SECRET, { expiresIn: '7d' }
  );

  console.log(`✅ Học sinh mới đăng ký: ${name} – Lớp ${studentClass} (${username})`);
  res.json({ token, user: { id: newStudent.id, name: newStudent.name, role: 'student', class: newStudent.class, username: newStudent.username } });
});

// ── Đăng ký giáo viên (tự do, không cần mã) ─────────────────────
app.post('/api/auth/register-teacher', async (req, res) => {
  const { name, username, password } = req.body;

  if (!name || !username || !password)
    return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin' });

  if (!/^[a-zA-Z0-9_]+$/.test(username))
    return res.status(400).json({ error: 'Tên đăng nhập chỉ được dùng chữ, số và dấu gạch dưới' });

  if (password.length < 6)
    return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });

  const users = await readJSON('users.json');
  if (users.find(u => u.username === username))
    return res.status(400).json({ error: 'Tên đăng nhập đã tồn tại, vui lòng chọn tên khác' });

  const newTeacher = {
    id:        'GV' + randomUUID(),
    name:      name.trim(),
    role:      'teacher',
    class:     null,
    username,
    password:  bcrypt.hashSync(password, 10),
    createdAt: new Date().toISOString()
  };
  try {
    await insertRecord('users.json', newTeacher);
  } catch (error) {
    if (error.status === 409) return res.status(400).json({ error: 'Tên đăng nhập đã tồn tại, vui lòng chọn tên khác' });
    throw error;
  }

  const token = jwt.sign(
    { id: newTeacher.id, name: newTeacher.name, role: 'teacher', class: null, username: newTeacher.username },
    JWT_SECRET, { expiresIn: '7d' }
  );

  console.log(`✅ Giáo viên mới đăng ký: ${name} (${username})`);
  res.json({ token, user: { id: newTeacher.id, name: newTeacher.name, role: 'teacher', class: null, username: newTeacher.username } });
});

// ── Giáo viên tạo tài khoản học sinh ────────────────────────────
app.post('/api/auth/create-student', auth, teacherOnly, async (req, res) => {
  const { username, name, studentClass } = req.body;
  if (!username || !name || !studentClass)
    return res.status(400).json({ error: 'Thiếu thông tin' });

  const users = await readJSON('users.json');
  if (users.find(u => u.username === username))
    return res.status(400).json({ error: 'Mã học sinh đã tồn tại' });

  const newStudent = {
    id:        'HS' + randomUUID(),
    name,
    role:      'student',
    class:     studentClass,
    username,
    password:  bcrypt.hashSync('123456', 10),
    createdAt: new Date().toISOString()
  };
  try {
    await insertRecord('users.json', newStudent);
  } catch (error) {
    if (error.status === 409) return res.status(400).json({ error: 'Mã học sinh đã tồn tại' });
    throw error;
  }
  res.json({ message: 'Tạo tài khoản thành công', student: { id: newStudent.id, name, username, class: studentClass, defaultPassword: '123456' } });
});

// ── Lấy danh sách học sinh (giáo viên) ───────────────────────────
app.get('/api/auth/students', auth, teacherOnly, async (req, res) => {
  const users = (await readJSON('users.json')).filter(u => u.role === 'student');
  res.json(users.map(u => ({ id: u.id, name: u.name, username: u.username, class: u.class, createdAt: u.createdAt })));
});

// ── Cập nhật thông tin học sinh (giáo viên) ──────────────────────
app.put('/api/auth/student/:id', auth, teacherOnly, async (req, res) => {
  const { name, studentClass } = req.body;
  if (!name || !studentClass)
    return res.status(400).json({ error: 'Thiếu thông tin' });

  const users = await readJSON('users.json');
  const idx = users.findIndex(u => u.id === req.params.id && u.role === 'student');
  if (idx === -1) return res.status(404).json({ error: 'Không tìm thấy học sinh' });

  const updated = await updateRecord('users.json', users[idx].id, {
    name: name.trim(),
    class: studentClass.trim()
  });
  if (!updated) return res.status(404).json({ error: 'Không tìm thấy học sinh' });
  console.log(`✏️  Đã cập nhật học sinh: ${name} (${updated.username})`);
  res.json({ success: true, student: { id: updated.id, name: updated.name, username: updated.username, class: updated.class } });
});

// ── Đặt lại mật khẩu học sinh (giáo viên) ────────────────────────
app.post('/api/auth/student/:id/reset-password', auth, teacherOnly, async (req, res) => {
  const users = await readJSON('users.json');
  const idx = users.findIndex(u => u.id === req.params.id && u.role === 'student');
  if (idx === -1) return res.status(404).json({ error: 'Không tìm thấy học sinh' });

  const updated = await updateRecord('users.json', users[idx].id, {
    password: bcrypt.hashSync('123456', 10)
  });
  if (!updated) return res.status(404).json({ error: 'Không tìm thấy học sinh' });
  console.log(`🔑 Đặt lại mật khẩu: ${updated.name} (${updated.username})`);
  res.json({ success: true, message: 'Mật khẩu đã được đặt lại về 123456' });
});

// ── Xóa tài khoản học sinh (giáo viên) ───────────────────────────
app.delete('/api/auth/student/:id', auth, teacherOnly, async (req, res) => {
  const users = await readJSON('users.json');
  const student = users.find(u => u.id === req.params.id && u.role === 'student');
  if (!student) return res.status(404).json({ error: 'Không tìm thấy học sinh' });

  const removedCheckins = IS_VERCEL
    ? (await readJSON('checkins.json')).filter(c => c.studentId === req.params.id).length
    : await deleteStudentCheckins(req.params.id);
  const removedUsers = await deleteRecord('users.json', req.params.id);
  if (!removedUsers) return res.status(404).json({ error: 'Không tìm thấy học sinh' });

  console.log(`🗑️  Đã xóa học sinh: ${student.name} (${student.username}), ${removedCheckins} check-in bị xóa`);
  res.json({ success: true, message: `Đã xóa tài khoản ${student.name}` });
});

// ── Lấy thông tin bản thân ───────────────────────────────────────
app.get('/api/auth/me', auth, async (req, res) => {
  const users = await readJSON('users.json');
  const user  = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Không tìm thấy' });
  res.json({ id: user.id, name: user.name, role: user.role, class: user.class, username: user.username });
});

// Đổi mật khẩu
app.post('/api/auth/change-password', auth, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const users = await readJSON('users.json');
  const idx = users.findIndex(u => u.id === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
  if (!bcrypt.compareSync(oldPassword, users[idx].password))
    return res.status(400).json({ error: 'Mật khẩu cũ không đúng' });
  const updated = await updateRecord('users.json', req.user.id, {
    password: bcrypt.hashSync(newPassword, 10)
  });
  if (!updated) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
  res.json({ message: 'Đổi mật khẩu thành công' });
});

// ══════════════════════════════════════════════════════════════════
// CHECK-IN ROUTES
// ══════════════════════════════════════════════════════════════════

// Gửi check-in (học sinh)
app.post('/api/checkin', auth, async (req, res) => {
  const { emotion, socialHours, sleepHours, sleepQuality, studyPressure, stressLevel, shareText } = req.body;

  // Validate
  if (emotion === undefined || socialHours === undefined || sleepHours === undefined
      || sleepQuality === undefined || studyPressure === undefined || stressLevel === undefined)
    return res.status(400).json({ error: 'Thiếu dữ liệu check-in' });

  const mhi = computeMHI({ emotion, socialHours, sleepHours, sleepQuality, studyPressure, stressLevel });

  // Gọi Gemini AI phân tích nội dung chia sẻ
  let aiAnalysis = null;
  if (shareText && shareText.trim().length > 5) {
    const prompt = buildAIPrompt({ emotion, socialHours, sleepHours, sleepQuality, studyPressure, stressLevel, shareText, mhi });
    const rawAi = await callGemini(prompt);
    const parsedAi = sanitizeAIResponse(rawAi);
    aiAnalysis = parsedAi ? JSON.stringify(parsedAi) : null;
  }

  const record = {
    id:         randomUUID(),
    studentId:  req.user.id,
    studentName:req.user.name,
    class:      req.user.class,
    date:       new Date().toISOString(),
    emotion:    parseInt(emotion),
    socialHours:parseFloat(socialHours),
    sleepHours: parseFloat(sleepHours),
    sleepQuality:parseInt(sleepQuality),
    studyPressure:parseInt(studyPressure),
    stressLevel:parseInt(stressLevel),
    shareText:  shareText || '',
    mhi,
    aiAnalysis,
    alerts:     getRuleAlerts({ emotion, socialHours, sleepHours, sleepQuality, studyPressure, stressLevel })
  };

  await insertRecord('checkins.json', record);

  res.json({ success: true, mhi, aiAnalysis, alerts: record.alerts });
});

// Lấy lịch sử check-in của học sinh hiện tại
app.get('/api/checkin/my', auth, async (req, res) => {
  const checkins = (await readJSON('checkins.json'))
    .filter(c => c.studentId === req.user.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(checkins);
});

// Lấy check-in hôm nay của học sinh
app.get('/api/checkin/today', auth, async (req, res) => {
  const today = new Date().toDateString();
  const checkin = (await readJSON('checkins.json'))
    .filter(c => c.studentId === req.user.id)
    .find(c => new Date(c.date).toDateString() === today);
  res.json(checkin || null);
});

// ══════════════════════════════════════════════════════════════════
// DASHBOARD ROUTES (giáo viên)
// ══════════════════════════════════════════════════════════════════

// Tổng quan
app.get('/api/dashboard/overview', auth, teacherOnly, async (req, res) => {
  const [checkins, users] = await Promise.all([
    readJSON('checkins.json'),
    readJSON('users.json')
  ]);
  const students = users.filter(u => u.role === 'student');
  const today    = new Date().toDateString();

  const todayCheckins = checkins.filter(c => new Date(c.date).toDateString() === today);
  const alerts        = checkins.filter(c => c.alerts && c.alerts.length > 0 &&
                          new Date(c.date).toDateString() === today);

  const avgMHI = todayCheckins.length > 0
    ? Math.round(todayCheckins.reduce((s, c) => s + c.mhi, 0) / todayCheckins.length)
    : null;

  res.json({
    totalStudents:   students.length,
    checkinToday:    todayCheckins.length,
    alertsToday:     alerts.length,
    avgMHI,
    checkinRate:     students.length > 0 ? Math.round((todayCheckins.length / students.length) * 100) : 0
  });
});

// Danh sách học sinh kèm check-in gần nhất
app.get('/api/dashboard/students', auth, teacherOnly, async (req, res) => {
  const [users, checkins] = await Promise.all([
    readJSON('users.json'),
    readJSON('checkins.json')
  ]);
  const students = users.filter(u => u.role === 'student');

  const result = students.map(s => {
    const myCheckins = checkins.filter(c => c.studentId === s.id)
                               .sort((a, b) => new Date(b.date) - new Date(a.date));
    const latest = myCheckins[0] || null;
    return {
      id:          s.id,
      name:        s.name,
      username:    s.username,
      class:       s.class,
      lastCheckin: latest ? latest.date : null,
      latestData:  latest,
      totalCheckins: myCheckins.length
    };
  });
  res.json(result);
});

// Chi tiết 1 học sinh (giáo viên xem)
app.get('/api/dashboard/student/:id', auth, teacherOnly, async (req, res) => {
  const users    = await readJSON('users.json');
  const student  = users.find(u => u.id === req.params.id && u.role === 'student');
  if (!student) return res.status(404).json({ error: 'Không tìm thấy học sinh' });

  const checkins = (await readJSON('checkins.json'))
    .filter(c => c.studentId === req.params.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  res.json({
    student: { id: student.id, name: student.name, class: student.class, username: student.username },
    checkins
  });
});

// Học sinh cần quan tâm hôm nay
app.get('/api/dashboard/alerts', auth, teacherOnly, async (req, res) => {
  const today    = new Date().toDateString();
  const checkins = (await readJSON('checkins.json'))
    .filter(c => new Date(c.date).toDateString() === today && c.alerts && c.alerts.length > 0)
    .sort((a, b) => a.mhi - b.mhi);
  res.json(checkins);
});

// Xu hướng 7 ngày (toàn trường)
app.get('/api/dashboard/trends', auth, teacherOnly, async (req, res) => {
  const checkins = await readJSON('checkins.json');
  const days     = [];
  for (let i = 6; i >= 0; i--) {
    const d   = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toDateString();
    const dc  = checkins.filter(c => new Date(c.date).toDateString() === key);
    days.push({
      date:        d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
      count:       dc.length,
      avgMHI:      dc.length ? Math.round(dc.reduce((s,c) => s + c.mhi, 0) / dc.length) : null,
      avgEmotion:  dc.length ? +(dc.reduce((s,c) => s + c.emotion, 0) / dc.length).toFixed(1) : null,
      avgSleep:    dc.length ? +(dc.reduce((s,c) => s + c.sleepHours, 0) / dc.length).toFixed(1) : null,
      avgSocial:   dc.length ? +(dc.reduce((s,c) => s + c.socialHours, 0) / dc.length).toFixed(1) : null,
      avgStress:   dc.length ? +(dc.reduce((s,c) => s + c.stressLevel, 0) / dc.length).toFixed(1) : null,
      avgPressure: dc.length ? +(dc.reduce((s,c) => s + c.studyPressure, 0) / dc.length).toFixed(1) : null,
    });
  }
  res.json(days);
});

// ══════════════════════════════════════════════════════════════════
// SURVEY ROUTES
// ══════════════════════════════════════════════════════════════════

app.post('/api/survey', auth, async (req, res) => {
  const { who5Answers, pssAnswers } = req.body;
  if (!Array.isArray(who5Answers) || who5Answers.length !== 5
      || who5Answers.some(answer => !Number.isInteger(answer) || answer < 0 || answer > 5)
      || !Array.isArray(pssAnswers) || pssAnswers.length !== 10
      || pssAnswers.some(answer => !Number.isInteger(answer) || answer < 0 || answer > 4))
    return res.status(400).json({ error: 'Dữ liệu khảo sát không hợp lệ' });

  const who5Raw   = who5Answers.reduce((s, a) => s + (a || 0), 0);
  const who5Score = who5Raw * 4;

  const reversedItems = [4, 5, 6];
  let pssScore = 0;
  pssAnswers.forEach((a, i) => {
    pssScore += reversedItems.includes(i) ? (4 - (a || 0)) : (a || 0);
  });

  const record = {
    id:         randomUUID(),
    studentId:  req.user.id,
    studentName:req.user.name,
    class:      req.user.class,
    date:       new Date().toISOString(),
    who5Answers,
    pssAnswers,
    who5Raw, who5Score, pssScore
  };

  await insertRecord('surveys.json', record);
  res.json({ success: true, who5Score, pssScore });
});

app.get('/api/survey/my', auth, async (req, res) => {
  const surveys = (await readJSON('surveys.json'))
    .filter(s => s.studentId === req.user.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(surveys);
});

app.get('/api/survey/all', auth, teacherOnly, async (req, res) => {
  res.json((await readJSON('surveys.json')).sort((a, b) => new Date(b.date) - new Date(a.date)));
});

// ── Kiểm tra trạng thái AI ────────────────────────────────────────
app.get('/api/ai/status', auth, (req, res) => {
  const provider = getAIProvider();
  res.json({
    configured: !!provider,
    provider:   provider,
    model:      provider === 'groq' ? GROQ_MODEL : (provider === 'gemini' ? GEMINI_MODEL : null)
  });
});

// ══════════════════════════════════════════════════════════════════
// AI CHAT ROUTE
// ══════════════════════════════════════════════════════════════════
app.post('/api/ai/chat', auth, async (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim())
    return res.status(400).json({ error: 'Thiếu nội dung' });

  if (!isAIConfigured()) {
    return res.json({ reply: '🔧 AI chưa được cấu hình. Vui lòng xem hướng dẫn tại trang Cách dùng để bật Gemini AI, hoặc liên hệ giáo viên tư vấn để được hỗ trợ trực tiếp.' });
  }

  // Lấy 3 check-in gần nhất để AI có context
  const checkins = (await readJSON('checkins.json'))
    .filter(c => c.studentId === req.user.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 3);

  const contextStr = checkins.length > 0
    ? '\nDữ liệu gần đây của bạn:\n' + checkins.map(c =>
        `- ${new Date(c.date).toLocaleDateString('vi-VN')}: cảm xúc ${c.emotion}/5, ngủ ${c.sleepHours}h, stress ${c.stressLevel}/10, MHI ${c.mhi}/100`
      ).join('\n')
    : '';

  const fullPrompt = contextStr
    ? `${contextStr}\n\nCâu hỏi của học sinh: "${message.trim()}"`
    : `Câu hỏi của học sinh: "${message.trim()}"`;

  const reply = await callGemini(fullPrompt);

  if (!reply) {
    return res.json({ reply: '⚠️ AI tạm thời không phản hồi. Vui lòng thử lại sau hoặc liên hệ giáo viên tư vấn.' });
  }

  res.json({ reply });
});

// ══════════════════════════════════════════════════════════════════
// MHI & RULE-BASED (server-side)
// ══════════════════════════════════════════════════════════════════
function scoreSocial(h)        { h=parseFloat(h)||0; if(h<1)return 100; if(h<2)return 90; if(h<3)return 75; if(h<4)return 55; if(h<5)return 35; return 15; }
function scoreSleepHours(h)    { h=parseFloat(h)||0; if(h<4)return 0; if(h<5)return 25; if(h<6)return 50; if(h<7)return 70; if(h<8)return 85; return 100; }
function scoreSleepQuality(v)  { return ({4:100,3:75,2:50,1:25,0:0})[parseInt(v)]??50; }
function scoreEmotion(v)       { return ({5:100,4:80,3:60,2:35,1:25,0:10})[parseInt(v)]??60; }
function scoreStudyPressure(v) { v=parseInt(v); if(isNaN(v))return 50; return Math.max(0,Math.min(100,100-25*v)); }
function scoreStress(v)        { v=parseInt(v)||0; if(v<=1)return 100; if(v<=3)return 80; if(v<=5)return 60; if(v<=7)return 35; return 10; }

function computeMHI(d) {
  return Math.round((scoreSocial(d.socialHours)+scoreSleepHours(d.sleepHours)+
    scoreSleepQuality(d.sleepQuality)+scoreEmotion(d.emotion)+
    scoreStudyPressure(d.studyPressure)+scoreStress(d.stressLevel))/6);
}

function getRuleAlerts(d) {
  const a=[], h=parseFloat(d.sleepHours)||7, s=parseInt(d.stressLevel)||5,
        e=parseInt(d.emotion), sc=parseFloat(d.socialHours)||1, p=parseInt(d.studyPressure)??2;
  if(h<5)  a.push({level:'danger',msg:'Giấc ngủ dưới 5 giờ — cần nghỉ ngơi thêm.'});
  if(s>=8) a.push({level:'danger',msg:'Mức stress rất cao (8-10) — hãy chia sẻ với ai đó.'});
  if(e<=1) a.push({level:'danger',msg:'Cảm xúc rất tiêu cực — cần được quan tâm.'});
  if(sc>=5)a.push({level:'warn',  msg:'Sử dụng mạng xã hội từ 5 giờ trở lên.'});
  if(p>=3) a.push({level:'warn',  msg:'Áp lực học tập cao — mức 3 hoặc 4.'});
  if(h<6&&s>=7) a.push({level:'danger',msg:'Ngủ ít + stress cao — tổ hợp cần đặc biệt chú ý.'});
  return a;
}

function sanitizeAIResponse(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let text = raw.trim();

  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) {
    text = text.slice(start, end + 1);
  }

  try {
    const parsed = JSON.parse(text);
    if (parsed && Array.isArray(parsed.tips) && parsed.tips.length > 0) {
      return parsed;
    }
  } catch {}

  return null;
}

function buildAIPrompt(d) {
  const emotionLabels = {5:'Rất tích cực',4:'Tích cực',3:'Bình thường',2:'Buồn/chán nản',1:'Lo lắng/căng thẳng',0:'Rất buồn/tuyệt vọng'};
  const qualLabels    = ['Rất kém','Kém','Bình thường','Tốt','Rất tốt'];
  return `Phân tích dữ liệu check-in sức khỏe tinh thần của học sinh THPT và đưa ra 3-4 gợi ý chăm sóc tinh thần.

Dữ liệu hôm nay:
- Cảm xúc: ${emotionLabels[d.emotion] || d.emotion}
- Ngủ: ${d.sleepHours} giờ, chất lượng: ${qualLabels[d.sleepQuality] || d.sleepQuality}
- Mạng xã hội: ${d.socialHours} giờ
- Áp lực học tập: mức ${d.studyPressure}/4
- Stress: ${d.stressLevel}/10
- Chỉ số MHI: ${d.mhi}/100
${d.shareText ? `- Học sinh chia sẻ: "${d.shareText}"` : ''}

Trả lời CHỈ theo JSON hợp lệ, không thêm lời giải thích, không thêm markdown code fence.
Ví dụ format đúng:
{"tips":[{"icon":"⭐","text":"**Giấc ngủ** quá ít, hãy ưu tiên đi ngủ sớm hơn 30 phút mỗi tối."}]}

Yêu cầu:
- 3-4 gợi ý, mỗi gợi ý 1-2 câu
- Thực tế, dễ áp dụng cho học sinh THPT
- Ưu tiên vấn đề có điểm thấp nhất trong 6 yếu tố
- text trong JSON phải là chuỗi UTF-8 hợp lệ, dùng **đậm** khi cần`;
}

app.use((error, req, res, next) => {
  console.error('API error:', error.message);
  if (res.headersSent) return next(error);
  res.status(500).json({ error: 'Lỗi máy chủ hoặc cơ sở dữ liệu. Vui lòng thử lại sau.' });
});

// ── Start server ──────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n🧠 MoodTok server đang chạy tại: http://localhost:${PORT}`);
    console.log(`📁 Dữ liệu lưu tại: ${DB_PATH}`);
    console.log('🔑 Tài khoản giáo viên cấu hình ban đầu qua biến môi trường.');
    if (isAIConfigured()) {
      const p = getAIProvider();
      const m = p === 'groq' ? GROQ_MODEL : GEMINI_MODEL;
      console.log(`🤖 AI: ĐÃ BẬT — Provider: ${p.toUpperCase()}, Model: ${m}`);
    } else {
      console.log(`\n⚠️  AI chưa bật. Lấy Groq key miễn phí tại: https://console.groq.com/keys`);
      console.log(`   Thêm vào .env: GROQ_API_KEY=gsk_xxxx\n`);
    }
  });
}

module.exports = app;
