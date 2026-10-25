/* ===== app.js – Shared utilities ===== */

// Format date Vietnamese
function formatDateVN(date) {
  const d = date || new Date();
  return d.toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateShort(date) {
  const d = date || new Date();
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

// Show toast notification
function showToast(msg, type) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show ' + (type || '');
  setTimeout(() => { t.className = 'toast'; }, 3000);
}

// Get current user
function getUser() {
  try {
    return JSON.parse(localStorage.getItem('moodtok_user')) || null;
  } catch { return null; }
}

// Logout
function logout() {
  localStorage.removeItem('moodtok_user');
  window.location.href = 'login.html';
}

// Auth guard (call on protected pages)
function requireAuth(role) {
  const user = getUser();
  if (!user) { window.location.href = 'login.html'; return null; }
  if (role && user.role !== role) { window.location.href = 'login.html'; return null; }
  return user;
}

// Set greeting
function setGreeting(elementId) {
  const user = getUser();
  const el = document.getElementById(elementId);
  if (el && user) el.textContent = `Xin chào, ${user.name}!`;
}

// ===== THANG ĐIỂM CHÍNH THỨC MHI =====

// Emotion map – value khớp với data-value trong checkin.html
// value: 5=Rất tích cực, 4=Tích cực, 3=Bình thường, 2=Buồn/chán nản, 1=Lo lắng/căng thẳng, 0=Rất buồn/tuyệt vọng
const EMOTION_MAP = {
  5: { label: 'Rất tích cực', emoji: '😄', color: '#22c55e',  score: 100 },
  4: { label: 'Tích cực',     emoji: '😊', color: '#84cc16',  score: 80  },
  3: { label: 'Bình thường',  emoji: '😐', color: '#f59e0b',  score: 60  },
  2: { label: 'Buồn / chán nản',      emoji: '😔', color: '#f97316', score: 35  },
  1: { label: 'Lo lắng / căng thẳng', emoji: '😰', color: '#ef4444', score: 25  },
  0: { label: 'Rất buồn / tuyệt vọng',emoji: '😞', color: '#991b1b', score: 10  },
};

// Chất lượng ngủ – value: 4=Rất tốt, 3=Tốt, 2=Bình thường, 1=Kém, 0=Rất kém
const QUALITY_MAP = {
  4: 'Rất tốt 🌟',
  3: 'Tốt 😊',
  2: 'Bình thường 😐',
  1: 'Kém 😔',
  0: 'Rất kém 😞',
};

const QUALITY_SCORE = { 4: 100, 3: 75, 2: 50, 1: 25, 0: 0 };

// 1. Điểm mạng xã hội
function scoreSocial(hours) {
  const h = parseFloat(hours) || 0;
  if (h < 1)  return 100;
  if (h < 2)  return 90;
  if (h < 3)  return 75;
  if (h < 4)  return 55;
  if (h < 5)  return 35;
  return 15;
}

// 2. Điểm thời lượng ngủ
function scoreSleepHours(hours) {
  const h = parseFloat(hours) || 0;
  if (h < 4)  return 0;
  if (h < 5)  return 25;
  if (h < 6)  return 50;
  if (h < 7)  return 70;
  if (h < 8)  return 85;
  return 100; // 8-10h và trên 10h đều 100
}

// 3. Điểm chất lượng ngủ (dùng QUALITY_SCORE)
function scoreSleepQuality(val) {
  return QUALITY_SCORE[parseInt(val)] ?? 50;
}

// 4. Điểm cảm xúc (dùng EMOTION_MAP)
function scoreEmotion(val) {
  return EMOTION_MAP[parseInt(val)]?.score ?? 60;
}

// 5. Điểm áp lực học tập (thang 0-4)
// Công thức: 100 - 25 × mức áp lực
function scoreStudyPressure(val) {
  const v = parseInt(val);
  if (isNaN(v)) return 50;
  return Math.max(0, Math.min(100, 100 - 25 * v));
}

// 6. Điểm stress (thang 0-10)
function scoreStress(val) {
  const s = parseInt(val) || 0;
  if (s <= 1)  return 100;
  if (s <= 3)  return 80;
  if (s <= 5)  return 60;
  if (s <= 7)  return 35;
  return 10; // 8-10
}

// Tính MHI = trung bình cộng 6 thành phần
function computeMHI(data) {
  const s1 = scoreSocial(data.socialHours);
  const s2 = scoreSleepHours(data.sleepHours);
  const s3 = scoreSleepQuality(data.sleepQuality);
  const s4 = scoreEmotion(data.emotion);
  const s5 = scoreStudyPressure(data.studyPressure);
  const s6 = scoreStress(data.stressLevel);
  return Math.round((s1 + s2 + s3 + s4 + s5 + s6) / 6);
}

// Lấy điểm breakdown để hiển thị
function getMHIBreakdown(data) {
  return [
    { label: 'Mạng xã hội',       icon: '📱', score: scoreSocial(data.socialHours) },
    { label: 'Thời lượng ngủ',    icon: '😴', score: scoreSleepHours(data.sleepHours) },
    { label: 'Chất lượng ngủ',    icon: '🛏️', score: scoreSleepQuality(data.sleepQuality) },
    { label: 'Cảm xúc',           icon: '💬', score: scoreEmotion(data.emotion) },
    { label: 'Áp lực học tập',    icon: '📚', score: scoreStudyPressure(data.studyPressure) },
    { label: 'Stress',             icon: '🧘', score: scoreStress(data.stressLevel) },
  ];
}

// Rule-based alert (dùng điểm thành phần)
function getRuleAlerts(data) {
  const alerts = [];
  const hrs      = parseFloat(data.sleepHours) || 7;
  const stress   = parseInt(data.stressLevel) || 5;
  const emotion  = parseInt(data.emotion);
  const social   = parseFloat(data.socialHours) || 1;
  const pressure = parseInt(data.studyPressure) ?? 2;

  if (hrs < 5)
    alerts.push({ level: 'danger', msg: '⚠️ Giấc ngủ dưới 5 giờ — cần nghỉ ngơi thêm.' });
  if (stress >= 8)
    alerts.push({ level: 'danger', msg: '🔴 Mức stress rất cao (8-10) — hãy thư giãn và chia sẻ với ai đó.' });
  if (emotion <= 1)
    alerts.push({ level: 'danger', msg: '💙 Cảm xúc rất tiêu cực — MoodTok sẵn sàng lắng nghe bạn.' });
  if (social >= 5)
    alerts.push({ level: 'warn',   msg: '📱 Sử dụng mạng xã hội từ 5 giờ trở lên — thử giảm bớt nhé.' });
  if (pressure >= 3)
    alerts.push({ level: 'warn',   msg: '📚 Áp lực học tập cao — hãy lập kế hoạch học tập hợp lý.' });
  if (hrs < 6 && stress >= 7)
    alerts.push({ level: 'danger', msg: '🚨 Ngủ ít + stress cao — tổ hợp cần được đặc biệt chú ý.' });

  return alerts;
}

// AI suggestions based on data
function getAISuggestions(data) {
  const tips    = [];
  const hrs     = parseFloat(data.sleepHours) || 7;
  const stress  = parseInt(data.stressLevel) || 5;
  const emotion = parseInt(data.emotion);
  const social  = parseFloat(data.socialHours) || 1;
  const pressure= parseInt(data.studyPressure) ?? 2;

  if (hrs >= 8 && hrs <= 10) {
    tips.push({ icon: '😴', text: 'Giấc ngủ của bạn đạt mức lý tưởng (8-10 giờ). Hãy duy trì thói quen ngủ đúng giờ nhé!' });
  } else if (hrs >= 7) {
    tips.push({ icon: '😴', text: 'Giấc ngủ khá tốt! Cố thêm một chút để đạt 8 giờ, mức tối ưu cho học sinh THPT.' });
  } else if (hrs < 6) {
    tips.push({ icon: '💤', text: 'Bạn ngủ ít hơn mức khuyến nghị. Thử tắt điện thoại trước 30 phút khi đi ngủ để cải thiện nhé.' });
  }

  if (stress >= 8) {
    tips.push({ icon: '🧘', text: 'Stress rất cao! Thử hít thở 4-7-8: hít vào 4 giây, nín thở 7 giây, thở ra 8 giây — lặp 3 lần.' });
  } else if (stress >= 6) {
    tips.push({ icon: '🧘', text: 'Mức stress khá cao. Hãy dành 10 phút đi bộ hoặc nghe nhạc nhẹ để thư giãn nhé.' });
  }

  if (social >= 5) {
    tips.push({ icon: '📱', text: `Bạn dùng mạng xã hội ${social} giờ hôm nay — khá nhiều. Thử đặt giới hạn app dưới 2 giờ/ngày.` });
  } else if (social >= 3) {
    tips.push({ icon: '📱', text: `Hôm nay dùng mạng xã hội ${social} giờ. Cố gắng giảm xuống dưới 2 giờ để có thêm thời gian cho bản thân.` });
  }

  if (emotion <= 1) {
    tips.push({ icon: '💬', text: 'Khi cảm thấy rất buồn hoặc lo lắng, hãy chia sẻ với người bạn tin tưởng. Bạn không cần phải một mình.' });
  } else if (emotion <= 2) {
    tips.push({ icon: '💬', text: 'Hôm nay tâm trạng không tốt lắm. Thử viết ra 1 điều bạn biết ơn hôm nay — dù nhỏ cũng được.' });
  }

  if (pressure >= 3) {
    tips.push({ icon: '📚', text: 'Áp lực học tập cao. Hãy chia nhỏ bài tập, nghỉ 5 phút sau mỗi 25 phút học (Pomodoro). Từng bước nhỏ sẽ đến đích.' });
  }

  if (emotion >= 4 && stress <= 3) {
    tips.push({ icon: '🌟', text: 'Bạn đang có trạng thái tinh thần rất tốt hôm nay! Ghi lại điều đang làm bạn vui để nhớ lại vào lúc khó khăn.' });
  }

  if (tips.length === 0) {
    tips.push({ icon: '💚', text: 'Bạn đang duy trì trạng thái cân bằng tốt. Tiếp tục check-in mỗi ngày để theo dõi xu hướng sức khỏe tinh thần nhé!' });
  }

  return tips.slice(0, 3);
}

// Generate mock history data for demo
function generateMockHistory(days) {
  const history = [];
  for (let i = days; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const emotion      = Math.floor(Math.random() * 5) + 1;          // 1-5
    const sleepHours   = +(5 + Math.random() * 5).toFixed(1);        // 5-10h
    const sleepQuality = Math.floor(Math.random() * 5);              // 0-4
    const socialHours  = +(0.5 + Math.random() * 5).toFixed(1);     // 0.5-5.5h
    const studyPressure= Math.floor(Math.random() * 5);              // 0-4
    const stressLevel  = Math.floor(Math.random() * 10);             // 0-9
    const entry = { date: d, emotion, sleepHours, sleepQuality, socialHours, studyPressure, stressLevel };
    entry.mhi = computeMHI(entry);
    history.push(entry);
  }
  return history;
}

// Init page greeting
document.addEventListener('DOMContentLoaded', function() {
  setGreeting('userGreeting');
  const dateEl = document.getElementById('dashDate');
  if (dateEl) dateEl.textContent = formatDateVN(new Date());
});
