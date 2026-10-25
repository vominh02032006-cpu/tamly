/* ===== api.js – shared utilities & API calls ===== */

// ── Auth helpers ──────────────────────────────────────────────────
function getToken()  { return localStorage.getItem('mt_token'); }
function getUser()   { try { return JSON.parse(localStorage.getItem('mt_user')); } catch { return null; } }
function logout()    { localStorage.removeItem('mt_token'); localStorage.removeItem('mt_user'); window.location.href = '/login.html'; }

function requireAuth(role) {
  const tok = getToken(); const user = getUser();
  if (!tok || !user) { window.location.href = '/login.html'; return null; }
  if (role && user.role !== role) { window.location.href = role === 'teacher' ? '/login.html' : '/checkin.html'; return null; }
  return user;
}

// ── Fetch wrapper ─────────────────────────────────────────────────
async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() }
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(path, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Lỗi ${r.status}`);
  return data;
}

// ── Toast ─────────────────────────────────────────────────────────
function showToast(msg, type) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show ' + (type || '');
  setTimeout(() => t.className = 'toast', 3500);
}

// ── Format date ───────────────────────────────────────────────────
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' });
}
function fmtDateShort(iso) {
  return new Date(iso).toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit' });
}
function fmtDateFull() {
  return new Date().toLocaleDateString('vi-VN', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
}

// ── MHI helpers (client-side mirror) ─────────────────────────────
const EMOTION_MAP = {
  5:{label:'Rất tích cực',  emoji:'😄', score:100},
  4:{label:'Tích cực',      emoji:'😊', score:80},
  3:{label:'Bình thường',   emoji:'😐', score:60},
  2:{label:'Buồn/chán nản', emoji:'😔', score:35},
  1:{label:'Lo lắng/căng thẳng',emoji:'😰',score:25},
  0:{label:'Rất buồn/tuyệt vọng',emoji:'😞',score:10}
};
const QUALITY_MAP = {4:'Rất tốt 🌟',3:'Tốt 😊',2:'Bình thường 😐',1:'Kém 😔',0:'Rất kém 😞'};

function scoreSocial(h)    { h=+h||0; if(h<1)return 100;if(h<2)return 90;if(h<3)return 75;if(h<4)return 55;if(h<5)return 35;return 15; }
function scoreSleepH(h)    { h=+h||0; if(h<4)return 0;if(h<5)return 25;if(h<6)return 50;if(h<7)return 70;if(h<8)return 85;return 100; }
function scoreSleepQ(v)    { return ({4:100,3:75,2:50,1:25,0:0})[+v]??50; }
function scoreEmo(v)       { return EMOTION_MAP[+v]?.score??60; }
function scorePress(v)     { v=+v; return isNaN(v)?50:Math.max(0,Math.min(100,100-25*v)); }
function scoreStress(v)    { v=+v||0; if(v<=1)return 100;if(v<=3)return 80;if(v<=5)return 60;if(v<=7)return 35;return 10; }

function computeMHI(d) {
  return Math.round((scoreSocial(d.socialHours)+scoreSleepH(d.sleepHours)+scoreSleepQ(d.sleepQuality)+scoreEmo(d.emotion)+scorePress(d.studyPressure)+scoreStress(d.stressLevel))/6);
}

function getBreakdown(d) {
  return [
    {icon:'📱',label:'Mạng xã hội',    score:scoreSocial(d.socialHours)},
    {icon:'😴',label:'Thời lượng ngủ', score:scoreSleepH(d.sleepHours)},
    {icon:'🛏️',label:'Chất lượng ngủ', score:scoreSleepQ(d.sleepQuality)},
    {icon:'💬',label:'Cảm xúc',         score:scoreEmo(d.emotion)},
    {icon:'📚',label:'Áp lực học tập',  score:scorePress(d.studyPressure)},
    {icon:'🧘',label:'Stress',           score:scoreStress(d.stressLevel)},
  ];
}

function mhiColor(mhi)  { return mhi>=70?'#22c55e':mhi>=40?'#f59e0b':'#ef4444'; }
function mhiStatus(mhi) { return mhi>=70?{dot:'good',label:'Tốt'}:mhi>=40?{dot:'mid',label:'Cần chú ý'}:{dot:'bad',label:'Cần hỗ trợ'}; }

// ── Init header ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const user = getUser();
  const nameEl = document.getElementById('hdrName');
  if (nameEl && user) nameEl.textContent = user.name;
  const sbName = document.getElementById('sbName');
  if (sbName && user) sbName.textContent = user.name;
  const dateEl = document.getElementById('dashDate');
  if (dateEl) dateEl.textContent = fmtDateFull();
});
