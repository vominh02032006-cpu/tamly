/* ===== checkin.js ===== */
const cd = { emotion:null, socialHours:null, sleepHours:7, sleepQuality:null, studyPressure:null, stressLevel:3, shareText:'' };
const TOTAL = 6;

document.addEventListener('DOMContentLoaded', async () => {
  const user = requireAuth('student');
  if (!user) return;
  const greet = document.getElementById('userGreeting');
  if (greet) greet.textContent = 'Xin chào, ' + user.name + '!';
  updateProgress(1);
  updateSleepDisplay(7);
  updateStressDisplay(3);

  try {
    const today = await api('GET', '/api/checkin/today');
    if (today) {
      const banner = document.createElement('div');
      banner.style.cssText = 'background:#dcfce7;border:1px solid #bbf7d0;border-radius:10px;padding:11px 14px;font-size:.86rem;color:#166534;margin-bottom:16px;';
      banner.innerHTML = `✅ Bạn đã check-in hôm nay lúc ${new Date(today.date).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}. <a href="result.html" style="color:var(--primary);font-weight:600">Xem kết quả →</a> hoặc check-in lại để cập nhật.`;
      document.getElementById('step1')?.prepend(banner);
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
});

function updateProgress(step) {
  const pct = ((step-1)/(TOTAL-1))*100;
  const bar = document.getElementById('progressBar');
  const lbl = document.getElementById('progressLabel');
  if (bar) bar.style.width = pct + '%';
  if (lbl) lbl.textContent = `Bước ${step}/${TOTAL}`;
}

function goStep(step) {
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('step' + step)?.classList.add('active');
  window.scrollTo({top:0,behavior:'smooth'});
  updateProgress(step);
  if (step === 6) renderSummary();
}

// ── Step 1: emotion ──
function selectEmotion(el) {
  document.querySelectorAll('.emotion-item').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  cd.emotion = +el.dataset.value;
  document.getElementById('btn-next1').disabled = false;
}

// ── Step 2: social ──
function selectSocial(el) {
  document.querySelectorAll('.option-card').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  cd.socialHours = +el.dataset.v;
  document.getElementById('social-custom').value = '';
  document.getElementById('btn-next2').disabled = false;
}

function setCustomSocial(v) {
  if (v !== '' && !isNaN(v) && +v >= 0) {
    cd.socialHours = +v;
    document.querySelectorAll('.option-card').forEach(e => e.classList.remove('selected'));
    document.getElementById('btn-next2').disabled = false;
  }
}

// ── Step 3: sleep ──
function updateSleepHours(v) { updateSleepDisplay(v); }

function updateSleepDisplay(v) {
  cd.sleepHours = +v;
  const pts = scoreSleepH(v);
  const el  = document.getElementById('sleep-val');
  if (el) {
    el.textContent = v + ' giờ – ' + pts + 'đ';
    el.style.color = pts >= 85 ? '#22c55e' : pts >= 50 ? '#f59e0b' : '#ef4444';
  }
  checkStep3();
}

function selectQuality(el) {
  document.querySelectorAll('.quality-card').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  cd.sleepQuality = +el.dataset.value;
  checkStep3();
}

function checkStep3() {
  const btn = document.getElementById('btn-next3');
  if (btn) btn.disabled = (cd.sleepQuality === null || cd.sleepQuality === undefined);
}

// ── Step 4: pressure + stress ──
function selectPressure(el) {
  document.querySelectorAll('.pressure-opt').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  cd.studyPressure = +el.dataset.value;
  document.getElementById('btn-next4').disabled = false;
}

function updateStress(v) { updateStressDisplay(v); }

function updateStressDisplay(v) {
  cd.stressLevel = +v;
  const pts = scoreStress(v);
  const el  = document.getElementById('stress-val');
  if (el) {
    el.textContent = v + ' – ' + pts + 'đ';
    el.style.color = pts >= 80 ? '#22c55e' : pts >= 60 ? '#f59e0b' : pts >= 35 ? '#f97316' : '#ef4444';
  }
}

// ── Step 5: share ──
function updateCharCount() {
  const ta = document.getElementById('share-text');
  const cc = document.getElementById('char-count');
  if (ta && cc) { cd.shareText = ta.value; cc.textContent = ta.value.length; }
}

// ── Step 6: summary ──
function renderSummary() {
  const card = document.getElementById('summaryCard');
  if (!card) return;
  const mhi = computeMHI(cd);
  const bd  = getBreakdown(cd);
  const em  = EMOTION_MAP[cd.emotion] || EMOTION_MAP[3];
  const pLabels = ['Không áp lực','Áp lực nhẹ','Áp lực vừa','Áp lực cao','Rất cao'];

  const rows = [
    ['💬 Cảm xúc', `${em.emoji} ${em.label}`],
    ['📱 Mạng xã hội', `${cd.socialHours}h`],
    ['😴 Giờ ngủ', `${cd.sleepHours}h`],
    ['🛏️ Chất lượng ngủ', QUALITY_MAP[cd.sleepQuality] || '-'],
    ['📚 Áp lực học tập', `Mức ${cd.studyPressure} – ${pLabels[cd.studyPressure]}`],
    ['🧘 Mức stress', `${cd.stressLevel}/10`],
  ];
  if (cd.shareText) rows.push(['💬 Chia sẻ', `"${cd.shareText.slice(0,60)}${cd.shareText.length>60?'...':''}"`]);

  card.innerHTML = `
    ${rows.map(([k,v]) => `
      <div class="summary-row">
        <span class="summary-key">${k}</span>
        <span class="summary-val">${v}</span>
      </div>`).join('')}
    <div style="margin-top:12px;background:#fff;border-radius:12px;padding:12px">
      <div style="font-size:.76rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text-muted);margin-bottom:10px">Điểm thành phần</div>
      ${bd.map(b => `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;font-size:.84rem">
          <span style="min-width:140px">${b.icon} ${b.label}</span>
          <div style="flex:1;height:6px;background:var(--border);border-radius:99px;overflow:hidden">
            <div style="height:100%;width:${b.score}%;background:${b.score>=75?'#22c55e':b.score>=50?'#f59e0b':'#ef4444'};border-radius:99px"></div>
          </div>
          <span style="font-weight:700;min-width:32px;text-align:right;color:${b.score>=75?'#22c55e':b.score>=50?'#f59e0b':'#ef4444'}">${b.score}</span>
        </div>`).join('')}
      <div style="text-align:center;font-size:1.2rem;font-weight:800;margin-top:12px;padding-top:12px;border-top:1px solid var(--border);color:${mhiColor(mhi)}">
        💚 MHI = ${mhi}/100
      </div>
    </div>
  `;
}

// ── Submit ──
async function submitCheckin() {
  if (cd.emotion===null || cd.socialHours===null || cd.sleepQuality===null || cd.studyPressure===null) {
    showToast('Vui lòng hoàn thành tất cả các bước!', 'error'); return;
  }
  const btn = document.getElementById('btn-submit');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Đang gửi…'; }

  try {
    const result = await api('POST', '/api/checkin', cd);
    showToast('Check-in thành công! MHI = ' + result.mhi, 'success');
    setTimeout(() => window.location.href = 'result.html', 1300);
  } catch(e) {
    showToast(e.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = '✅ Hoàn tất Check-in'; }
  }
}
