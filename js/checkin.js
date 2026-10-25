/* ===== checkin.js ===== */

// State
const checkinData = {
  emotion: null,
  emotionLabel: '',
  socialHours: null,
  sleepHours: 7,
  sleepQuality: null,
  studyPressure: null,  // 0-4
  stressLevel: 3,       // 0-10
  shareText: ''
};

const totalSteps = 6;

// Auth guard
document.addEventListener('DOMContentLoaded', function() {
  const user = requireAuth();
  if (!user) return;

  const greet = document.getElementById('userGreeting');
  if (greet) greet.textContent = user.name;

  updateProgress(1);
  updateSleepHours(7);
  updateStress(3);

  // Check if already checked in today
  const todayKey = new Date().toDateString();
  const lastCheckin = localStorage.getItem('moodtok_last_checkin');
  if (lastCheckin === todayKey) {
    const panel = document.getElementById('step1');
    if (panel) {
      const notice = document.createElement('div');
      notice.style.cssText = 'background:#dcfce7;border:1px solid #bbf7d0;border-radius:10px;padding:12px 16px;font-size:0.88rem;color:#166534;margin-bottom:16px;';
      notice.innerHTML = '✅ Bạn đã check-in hôm nay rồi. Bạn có thể check-in lại để cập nhật dữ liệu.';
      panel.insertBefore(notice, panel.querySelector('.emotion-grid'));
    }
  }
});

function updateProgress(step) {
  const pct = ((step - 1) / (totalSteps - 1)) * 100;
  const bar = document.getElementById('progressBar');
  const label = document.getElementById('progressLabel');
  if (bar) bar.style.width = pct + '%';
  if (label) label.textContent = `Bước ${step} / ${totalSteps}`;
}

function goNext(step) {
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('step' + step);
  if (target) {
    target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  updateProgress(step);
  if (step === 6) renderSummary();
}

// STEP 1: Emotion
function selectEmotion(el) {
  document.querySelectorAll('.emotion-item').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  checkinData.emotion = parseInt(el.dataset.value);
  checkinData.emotionLabel = el.dataset.label;
  document.getElementById('btn-next1').disabled = false;
}

// STEP 2: Social
function selectOption(el, type) {
  document.querySelectorAll('.option-card').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  checkinData.socialHours = parseFloat(el.dataset.value);
  document.getElementById('social-custom').value = '';
  document.getElementById('btn-next2').disabled = false;
}

function setCustomSocial(val) {
  if (val !== '' && !isNaN(val) && parseFloat(val) >= 0) {
    checkinData.socialHours = parseFloat(val);
    document.querySelectorAll('.option-card').forEach(e => e.classList.remove('selected'));
    document.getElementById('btn-next2').disabled = false;
  }
}

// STEP 3: Sleep hours
function updateSleepHours(val) {
  checkinData.sleepHours = parseFloat(val);
  const display = document.getElementById('sleep-hours-display');
  const pts = scoreSleepHours(val);

  if (display) {
    display.textContent = val + ' giờ — ' + pts + ' điểm';
    if (pts >= 85) display.style.color = '#22c55e';
    else if (pts >= 50) display.style.color = '#f59e0b';
    else display.style.color = '#ef4444';
  }
  checkStep3();
}

// STEP 3: Sleep quality (5 mức: 0-4)
function selectQuality(el) {
  document.querySelectorAll('.quality-card').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  checkinData.sleepQuality = parseInt(el.dataset.value);
  checkStep3();
}

function checkStep3() {
  const btn = document.getElementById('btn-next3');
  if (btn) btn.disabled = (checkinData.sleepQuality === null || checkinData.sleepQuality === undefined);
}

// STEP 4: Study pressure (chọn thẻ 0-4)
function selectPressure(el) {
  document.querySelectorAll('.pressure-opt').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  checkinData.studyPressure = parseInt(el.dataset.value);
  document.getElementById('btn-next4').disabled = false;
}

// STEP 4: Stress (slider 0-10)
const stressLabels = {
  0: 'Không stress (100đ)',  1: 'Rất thấp (100đ)',
  2: 'Thấp (80đ)',           3: 'Khá thấp (80đ)',
  4: 'Trung bình (60đ)',     5: 'Hơi cao (60đ)',
  6: 'Cao (35đ)',             7: 'Khá cao (35đ)',
  8: 'Rất cao (10đ)',         9: 'Cực kỳ cao (10đ)', 10: 'Tột đỉnh (10đ)'
};

function updateStress(val) {
  checkinData.stressLevel = parseInt(val);
  const numEl = document.getElementById('stress-val');
  const labelEl = document.getElementById('stress-label');
  if (numEl) numEl.textContent = val;
  if (labelEl) labelEl.textContent = stressLabels[val] || '';

  const pts = scoreStress(val);
  const color = pts >= 80 ? '#22c55e' : pts >= 60 ? '#f59e0b' : pts >= 35 ? '#f97316' : '#ef4444';
  if (numEl) numEl.style.color = color;
}

// STEP 5: Share
function updateCharCount() {
  const ta = document.getElementById('share-text');
  const cc = document.getElementById('char-count');
  if (ta && cc) {
    checkinData.shareText = ta.value;
    cc.textContent = ta.value.length;
  }
}

// STEP 6: Summary
function renderSummary() {
  const card = document.getElementById('summaryCard');
  if (!card) return;

  const mhi = computeMHI(checkinData);
  const breakdown = getMHIBreakdown(checkinData);
  const em = EMOTION_MAP[checkinData.emotion] || EMOTION_MAP[3];
  const qual = QUALITY_MAP[checkinData.sleepQuality ?? 2] || '-';

  const pressureLabels = ['Không áp lực','Áp lực nhẹ','Áp lực vừa','Áp lực cao','Áp lực rất cao'];
  const pLabel = pressureLabels[checkinData.studyPressure] || '-';

  card.innerHTML = `
    <div class="summary-row">
      <span class="summary-key">💬 Cảm xúc</span>
      <span class="summary-val">${em.emoji} ${em.label}</span>
    </div>
    <div class="summary-row">
      <span class="summary-key">📱 Mạng xã hội</span>
      <span class="summary-val">${checkinData.socialHours ?? '?'} giờ</span>
    </div>
    <div class="summary-row">
      <span class="summary-key">😴 Số giờ ngủ</span>
      <span class="summary-val">${checkinData.sleepHours} giờ</span>
    </div>
    <div class="summary-row">
      <span class="summary-key">🛏️ Chất lượng ngủ</span>
      <span class="summary-val">${qual}</span>
    </div>
    <div class="summary-row">
      <span class="summary-key">📚 Áp lực học tập</span>
      <span class="summary-val">Mức ${checkinData.studyPressure} – ${pLabel}</span>
    </div>
    <div class="summary-row">
      <span class="summary-key">🧘 Mức stress</span>
      <span class="summary-val">${checkinData.stressLevel}/10</span>
    </div>
    ${checkinData.shareText ? `
    <div class="summary-row">
      <span class="summary-key">💬 Chia sẻ thêm</span>
      <span class="summary-val" style="max-width:260px;text-align:right;font-style:italic;">"${checkinData.shareText.substring(0,80)}${checkinData.shareText.length > 80 ? '...' : ''}"</span>
    </div>` : ''}

    <div style="margin-top:8px;">
      <div style="font-size:0.8rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Điểm thành phần MHI</div>
      ${breakdown.map(b => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:0.85rem;">
          <span>${b.icon} ${b.label}</span>
          <span style="font-weight:700;color:${b.score >= 75 ? '#22c55e' : b.score >= 50 ? '#f59e0b' : '#ef4444'}">${b.score}/100</span>
        </div>
      `).join('')}
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:#f0f9ff;border-radius:10px;margin-top:10px;">
        <span style="font-weight:700;">💚 Chỉ số MHI</span>
        <span style="font-size:1.2rem;font-weight:800;color:${mhi >= 70 ? '#22c55e' : mhi >= 40 ? '#f59e0b' : '#ef4444'}">${mhi}/100</span>
      </div>
    </div>
  `;
}

// SUBMIT
function submitCheckin() {
  if (checkinData.emotion === null || checkinData.socialHours === null
      || checkinData.sleepQuality === null || checkinData.studyPressure === null) {
    showToast('Vui lòng hoàn thành tất cả các bước!', 'error');
    return;
  }

  const mhi = computeMHI(checkinData);
  const record = { date: new Date().toISOString(), ...checkinData, mhi };

  let history = [];
  try { history = JSON.parse(localStorage.getItem('moodtok_history')) || []; } catch {}
  history.push(record);
  localStorage.setItem('moodtok_history', JSON.stringify(history));
  localStorage.setItem('moodtok_last_checkin', new Date().toDateString());
  localStorage.setItem('moodtok_latest', JSON.stringify(record));

  showToast('Check-in thành công! Đang chuyển sang kết quả...', 'success');
  setTimeout(() => { window.location.href = 'result.html'; }, 1400);
}
