/* ===== result.js ===== */
let charts = {};
let fullHistory = [];

document.addEventListener('DOMContentLoaded', async () => {
  const user = requireAuth('student');
  if (!user) return;

  // Tên người dùng ở header
  const greet = document.getElementById('userGreeting');
  if (greet) greet.textContent = 'Xin chào, ' + user.name + '!';

  // Kiểm tra trạng thái AI song song với load data
  checkAIStatus();

  try {
    fullHistory = await api('GET', '/api/checkin/my');

    if (!fullHistory || fullHistory.length === 0) {
      document.getElementById('no-data').style.display = 'block';
      document.getElementById('has-data').style.display = 'none';
      return;
    }

    document.getElementById('no-data').style.display = 'none';
    document.getElementById('has-data').style.display = 'block';

    const latest = fullHistory[0];

    renderMHI(latest, user);
    renderBreakdown(latest);
    renderAI(latest);
    renderCharts(fullHistory, 7);
    renderHistory(fullHistory.slice(0, 30));

    // Load kết quả khảo sát gần nhất
    loadLastSurvey();

  } catch(e) {
    showToast('Lỗi tải dữ liệu: ' + e.message, 'error');
    document.getElementById('no-data').style.display = 'block';
    document.getElementById('has-data').style.display = 'none';
  }
});

// ── Kiểm tra và hiển thị trạng thái AI ───────────────────────────
async function checkAIStatus() {
  try {
    const status = await api('GET', '/api/ai/status');
    const badge  = document.getElementById('aiStatusBadge');
    const banner = document.getElementById('aiSetupBanner');

    if (status.configured) {
      if (badge) {
        const providerName = status.provider === 'groq' ? 'Groq AI' : 'Gemini AI';
        badge.textContent = `🟢 ${providerName} bật`;
        badge.style.background = '#dcfce7';
        badge.style.color = '#166534';
      }
      if (banner) banner.style.display = 'none';
    } else {
      if (badge) {
        badge.textContent = '🔴 AI chưa bật';
        badge.style.background = '#fee2e2';
        badge.style.color = '#991b1b';
      }
      if (banner) banner.style.display = 'block';
    }
  } catch {}
}

// ── MHI Ring ─────────────────────────────────────────────────────
function renderMHI(d, user) {
  const mhi   = d.mhi;
  const color = mhiColor(mhi);
  const st    = mhiStatus(mhi);

  // SVG circle animation — id: mhiFill
  const arc = document.getElementById('mhiFill');
  if (arc) {
    arc.setAttribute('stroke', color);
    setTimeout(() => {
      arc.style.transition = 'stroke-dashoffset 1s ease';
      arc.style.strokeDashoffset = 314 - (mhi / 100) * 314;
    }, 100);
  }

  const scoreEl = document.getElementById('mhiScore');
  if (scoreEl) scoreEl.textContent = mhi;

  const titleEl = document.getElementById('welcomeTitle');
  if (titleEl) titleEl.textContent = `Xin chào, ${user.name}! 👋`;

  // Status dot + label
  const statusEl = document.getElementById('mhiStatus');
  if (statusEl) {
    const dotEl   = statusEl.querySelector('.status-dot');
    const labelEl = document.getElementById('mhiStatusLabel');
    if (dotEl)   { dotEl.className = 'status-dot ' + st.dot; }
    if (labelEl) { labelEl.textContent = st.label; }
  }

  // Mô tả
  const descs = {
    good: 'Chỉ số sức khỏe tinh thần của bạn hôm nay ở mức tốt. Hãy tiếp tục duy trì thói quen check-in mỗi ngày!',
    mid:  'Trạng thái tinh thần cần được chú ý thêm. Xem các gợi ý từ AI để cải thiện nhé.',
    bad:  'Bạn đang trải qua giai đoạn khó khăn. Hãy chia sẻ với giáo viên tư vấn hoặc người thân.'
  };
  const descEl = document.getElementById('mhiDesc');
  if (descEl) descEl.textContent = descs[st.dot];

  // Chips tóm tắt hôm nay
  const em      = EMOTION_MAP[d.emotion] || EMOTION_MAP[3];
  const chipsEl = document.getElementById('todaySummary');
  if (chipsEl) {
    chipsEl.innerHTML = `
      <span class="summary-chip">${em.emoji} ${em.label}</span>
      <span class="summary-chip">😴 ${d.sleepHours}h ngủ</span>
      <span class="summary-chip">📱 ${d.socialHours}h MXH</span>
      <span class="summary-chip">🧘 Stress ${d.stressLevel}/10</span>
    `;
  }
}

// ── Breakdown ─────────────────────────────────────────────────────
function renderBreakdown(d) {
  const el = document.getElementById('breakdownGrid');
  if (!el) return;
  const bd = getBreakdown(d);
  el.innerHTML = bd.map(b => `
    <div style="background:white;border-radius:14px;padding:14px 10px;text-align:center;box-shadow:var(--card-shadow)">
      <div style="font-size:1.5rem;margin-bottom:5px">${b.icon}</div>
      <div style="font-size:.72rem;color:var(--text-muted);margin-bottom:6px;line-height:1.3">${b.label}</div>
      <div style="font-size:1.3rem;font-weight:800;color:${b.score>=75?'#22c55e':b.score>=50?'#f59e0b':'#ef4444'};margin-bottom:5px">
        ${b.score}<span style="font-size:.7rem;font-weight:500;color:var(--text-muted)">/100</span>
      </div>
      <div style="height:5px;background:var(--border);border-radius:99px;overflow:hidden">
        <div style="height:100%;width:${b.score}%;background:${b.score>=75?'#22c55e':b.score>=50?'#f59e0b':'#ef4444'};border-radius:99px"></div>
      </div>
    </div>
  `).join('');
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function renderMarkdownText(text) {
  return escapeHtml(String(text ?? ''))
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

function parseAIAnalysis(raw) {
  if (!raw) return null;
  let text = String(raw).trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) {
    text = text.slice(start, end + 1);
  }

  try {
    const parsed = JSON.parse(text);
    if (parsed && Array.isArray(parsed.tips) && parsed.tips.length > 0) return parsed;
  } catch {}

  return null;
}

// ── AI Section ────────────────────────────────────────────────────
function renderAI(d) {
  const el    = document.getElementById('aiContent');
  const badge = document.getElementById('aiBadge');
  if (!el) return;

  if (d.aiAnalysis) {
    if (badge) badge.textContent = '✨ Powered by Gemini';

    const parsed = parseAIAnalysis(d.aiAnalysis);
    if (parsed) {
      const tips = parsed.tips || [];
      el.innerHTML = tips.map(t =>
        `<div class="ai-tip"><span class="ai-tip-icon">${t.icon || '💡'}</span><span>${renderMarkdownText(t.text || '')}</span></div>`
      ).join('');
      return;
    }

    // Text thuần
    el.innerHTML = `<div class="ai-tip"><span class="ai-tip-icon">🤖</span><span>${renderMarkdownText(d.aiAnalysis)}</span></div>`;
    return;
  }

  // Không có Gemini → rule-based
  if (badge) badge.textContent = '⚙️ Rule-based';
  const alerts = d.alerts || [];
  const tips   = getRuleBasedTips(d);

  let html = '';
  alerts.forEach(a => {
    html += `<div class="ai-tip" style="border-left:3px solid ${a.level==='danger'?'#ef4444':'#f59e0b'}">
      <span class="ai-tip-icon">${a.level==='danger'?'🔴':'🟡'}</span>
      <span>${renderMarkdownText(a.msg)}</span>
    </div>`;
  });
  tips.forEach(t => {
    html += `<div class="ai-tip"><span class="ai-tip-icon">${t.icon}</span><span>${renderMarkdownText(t.text)}</span></div>`;
  });
  el.innerHTML = html || '<div class="ai-tip"><span class="ai-tip-icon">💚</span><span>Bạn đang ổn. Tiếp tục check-in mỗi ngày nhé!</span></div>';
}

function getRuleBasedTips(d) {
  const tips = [];
  const h = +d.sleepHours, s = +d.stressLevel, e = +d.emotion, sc = +d.socialHours, p = +d.studyPressure;
  if (h >= 8)       tips.push({ icon:'😴', text:'Giấc ngủ đạt mức lý tưởng. Hãy duy trì nhé!' });
  else if (h < 6)   tips.push({ icon:'💤', text:'Bạn ngủ ít hơn mức khuyến nghị. Thử tắt điện thoại 30 phút trước khi ngủ.' });
  if (s >= 8)       tips.push({ icon:'🧘', text:'Stress rất cao! Hít thở 4-7-8: hít 4 giây, nín 7 giây, thở ra 8 giây. Lặp 3 lần.' });
  else if (s >= 6)  tips.push({ icon:'🧘', text:'Stress khá cao. Dành 10 phút đi bộ hoặc nghe nhạc nhẹ.' });
  if (sc >= 5)      tips.push({ icon:'📱', text:`Bạn dùng MXH ${sc}h hôm nay. Thử đặt giới hạn dưới 2 giờ/ngày.` });
  if (e <= 1)       tips.push({ icon:'💬', text:'Khi cảm thấy rất buồn, hãy chia sẻ với người bạn tin tưởng.' });
  if (p >= 3)       tips.push({ icon:'📚', text:'Áp lực học tập cao. Chia nhỏ bài tập, nghỉ 5 phút sau mỗi 25 phút (Pomodoro).' });
  if (e >= 4 && s <= 3) tips.push({ icon:'🌟', text:'Trạng thái tinh thần tốt hôm nay! Ghi lại điều đang làm bạn vui.' });
  return tips.slice(0, 3);
}

// ── AI Chat ───────────────────────────────────────────────────────
async function sendChat() {
  const inp = document.getElementById('chat-input');
  const btn = document.querySelector('.btn-send') || document.querySelector('[onclick="sendChat()"]');
  const msg = inp?.value.trim();
  if (!msg) return;

  inp.value    = '';
  inp.disabled = true;
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }

  addChatMsg(msg, 'user');
  const tid = addChatMsg('⏳ Đang xử lý…', 'bot-load');

  try {
    // Gọi thẳng fetch với timeout 35s thay vì dùng api()
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35000);

    const resp = await fetch('/api/ai/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() },
      body:    JSON.stringify({ message: msg }),
      signal:  controller.signal
    });
    clearTimeout(timer);

    const data = await resp.json();
    document.getElementById(tid)?.remove();
    addChatMsg(data.reply || 'Không có phản hồi.', 'bot');

  } catch(e) {
    document.getElementById(tid)?.remove();
    if (e.name === 'AbortError') {
      addChatMsg('⏰ AI phản hồi quá lâu. Thử lại hoặc đặt câu hỏi ngắn hơn nhé.', 'bot');
    } else {
      addChatMsg('❌ Lỗi kết nối. Vui lòng thử lại.', 'bot');
    }
  } finally {
    inp.disabled = false;
    if (btn) { btn.disabled = false; btn.textContent = 'Gửi →'; }
    inp.focus();
  }
}

function addChatMsg(text, cls) {
  const id  = 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  const box = document.getElementById('chatMessages');
  if (!box) return id;
  const div = document.createElement('div');
  div.id = id;
  const isUser = cls === 'user';
  div.style.cssText = [
    'max-width:82%', 'padding:10px 14px', 'border-radius:14px',
    'font-size:.86rem', 'line-height:1.7', 'word-break:break-word',
    `align-self:${isUser ? 'flex-end' : 'flex-start'}`,
    `background:${isUser ? 'var(--primary)' : 'var(--bg)'}`,
    `color:${isUser ? '#fff' : 'var(--text)'}`,
    cls === 'bot-load' ? 'opacity:.6;font-style:italic' : ''
  ].filter(Boolean).join(';');

  if (isUser || cls === 'bot-load') {
    div.textContent = text;
  } else {
    // Render markdown đơn giản cho bot
    div.innerHTML = renderMarkdown(text);
  }
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  return id;
}

// ── Charts ────────────────────────────────────────────────────────
function switchChartTab(period, el) {
  document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  if (fullHistory.length > 0) renderCharts(fullHistory, +period);
}

function renderCharts(history, checkinCount) {
  const slice = history.slice(0, checkinCount).reverse();
  if (!slice.length) return;

  const firstCheckin = history.length - slice.length + 1;
  const labels = slice.map((_, index) => `Lần ${firstCheckin + index}`);
  const baseOpt = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        grid: { display: false },
        title: { display: true, text: 'Lần check-in' },
        ticks: { font: { size: 11 } }
      },
      y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 11 } } }
    }
  };
  baseOpt.plugins.tooltip = {
    callbacks: {
      title: items => {
        const checkin = slice[items[0].dataIndex];
        return `${items[0].label} · ${fmtDateShort(checkin.date)}`;
      }
    }
  };

  destroyChart('emotionChart');
  charts['emotionChart'] = new Chart(document.getElementById('emotionChart'), {
    type: 'line',
    data: { labels, datasets: [{ data: slice.map(h=>h.emotion), borderColor:'#6366f1', backgroundColor:'rgba(99,102,241,.08)', fill:true, tension:0.4, pointBackgroundColor:'#6366f1', pointRadius:5 }] },
    options: { ...baseOpt, scales: { ...baseOpt.scales, y: { ...baseOpt.scales.y, min:0, max:5, ticks:{ callback: v=>['😞','😰','😔','😐','😊','😄'][v]||v } } } }
  });

  destroyChart('sleepChart');
  charts['sleepChart'] = new Chart(document.getElementById('sleepChart'), {
    type: 'bar',
    data: { labels, datasets: [{ data: slice.map(h=>h.sleepHours), backgroundColor: slice.map(h=>h.sleepHours>=8?'rgba(34,197,94,.7)':h.sleepHours>=6?'rgba(245,158,11,.7)':'rgba(239,68,68,.7)'), borderRadius:6 }] },
    options: { ...baseOpt, scales: { ...baseOpt.scales, y: { ...baseOpt.scales.y, min:0, max:12, ticks:{callback:v=>v+'h'} } } }
  });

  destroyChart('socialChart');
  charts['socialChart'] = new Chart(document.getElementById('socialChart'), {
    type: 'line',
    data: { labels, datasets: [{ data: slice.map(h=>h.socialHours), borderColor:'#8b5cf6', backgroundColor:'rgba(139,92,246,.08)', fill:true, tension:0.4, pointBackgroundColor:'#8b5cf6', pointRadius:5 }] },
    options: { ...baseOpt, scales: { ...baseOpt.scales, y: { ...baseOpt.scales.y, min:0, ticks:{callback:v=>v+'h'} } } }
  });

  destroyChart('stressChart');
  charts['stressChart'] = new Chart(document.getElementById('stressChart'), {
    type: 'line',
    data: { labels, datasets: [
      { label:'Stress',    data: slice.map(h=>h.stressLevel),    borderColor:'#ef4444', fill:false, tension:0.4, pointRadius:4, pointBackgroundColor:'#ef4444' },
      { label:'Áp lực học', data: slice.map(h=>h.studyPressure), borderColor:'#f59e0b', fill:false, tension:0.4, pointRadius:4, pointBackgroundColor:'#f59e0b' }
    ] },
    options: { ...baseOpt, plugins:{ legend:{ display:true, labels:{ font:{size:11} } } }, scales:{ ...baseOpt.scales, y:{ ...baseOpt.scales.y, min:0, max:10 } } }
  });
}

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

// ── Render markdown đơn giản ─────────────────────────────────────
function renderMarkdown(text) {
  if (!text) return '';
  return text
    // Escape HTML trước
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // **bold**
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // *italic*
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Numbered list: "1. text" → li
    .replace(/^(\d+)\.\s+(.+)$/gm, '<li style="margin:4px 0 4px 16px;list-style:decimal">$2</li>')
    // Bullet: "- text" hoặc "• text"
    .replace(/^[-•]\s+(.+)$/gm, '<li style="margin:4px 0 4px 16px;list-style:disc">$1</li>')
    // Xuống dòng đơn → <br>
    .replace(/\n/g, '<br>');
}
function renderHistory(history) {
  const tbody = document.getElementById('historyTableBody');
  if (!tbody) return;
  tbody.innerHTML = history.map(h => {
    const em  = EMOTION_MAP[h.emotion] || EMOTION_MAP[3];
    const cls = h.mhi >= 70 ? 'high' : h.mhi >= 40 ? 'mid' : 'low';
    return `<tr>
      <td>${fmtDate(h.date)}</td>
      <td>${em.emoji} ${em.label}</td>
      <td>${h.sleepHours}h</td>
      <td>${h.socialHours}h</td>
      <td>${h.studyPressure}/4</td>
      <td>${h.stressLevel}/10</td>
      <td><span class="mhi-badge ${cls}">${h.mhi}</span></td>
    </tr>`;
  }).join('');
}

// ── Last Survey Result ────────────────────────────────────────────
async function loadLastSurvey() {
  try {
    const surveys = await api('GET', '/api/survey/my');
    const statusEl  = document.getElementById('surveyStatus');
    const resultDiv = document.getElementById('lastSurveyResult');
    const gridEl    = document.getElementById('surveyResultGrid');

    if (!surveys || surveys.length === 0) {
      if (statusEl) statusEl.textContent = 'Bạn chưa làm khảo sát nào. Làm khảo sát để đánh giá toàn diện hơn!';
      return;
    }

    const last    = surveys[0];
    const daysAgo = Math.floor((Date.now() - new Date(last.date)) / (1000*60*60*24));
    const when    = daysAgo === 0 ? 'hôm nay' : (daysAgo === 1 ? 'hôm qua' : daysAgo + ' ngày trước');
    if (statusEl) statusEl.textContent = `Lần khảo sát gần nhất: ${fmtDate(last.date)} (${when}). Khảo sát lại sau 2 tuần.`;

    if (!resultDiv || !gridEl) return;
    resultDiv.style.display = 'block';

    const w5color = last.who5Score >= 68 ? '#22c55e' : last.who5Score >= 52 ? '#f59e0b' : '#ef4444';
    const w5lbl   = last.who5Score >= 68 ? 'Tốt' : last.who5Score >= 52 ? 'Trung bình' : 'Cần chú ý';
    const pcolor  = last.pssScore  <= 13 ? '#22c55e' : last.pssScore <= 26 ? '#f59e0b' : '#ef4444';
    const plbl    = last.pssScore  <= 13 ? 'Thấp' : last.pssScore <= 26 ? 'Trung bình' : 'Cao';

    gridEl.innerHTML = `
      <div style="background:#f8fafc;border-radius:12px;padding:16px">
        <div style="font-size:.82rem;color:var(--text-muted);margin-bottom:6px">🌿 WHO-5 Well-being</div>
        <div style="font-size:1.6rem;font-weight:800;color:${w5color};line-height:1">
          ${last.who5Score}<span style="font-size:.8rem;font-weight:500;color:var(--text-muted)">/100</span>
        </div>
        <div style="height:6px;background:#e5e7eb;border-radius:99px;overflow:hidden;margin:8px 0">
          <div style="height:100%;width:${last.who5Score}%;background:${w5color};border-radius:99px"></div>
        </div>
        <span style="background:${w5color}22;color:${w5color};padding:3px 10px;border-radius:99px;font-size:.78rem;font-weight:600">${w5lbl}</span>
      </div>
      <div style="background:#f8fafc;border-radius:12px;padding:16px">
        <div style="font-size:.82rem;color:var(--text-muted);margin-bottom:6px">🧘 Mức stress (PSS)</div>
        <div style="font-size:1.6rem;font-weight:800;color:${pcolor};line-height:1">
          ${last.pssScore}<span style="font-size:.8rem;font-weight:500;color:var(--text-muted)">/40</span>
        </div>
        <div style="height:6px;background:#e5e7eb;border-radius:99px;overflow:hidden;margin:8px 0">
          <div style="height:100%;width:${(last.pssScore/40)*100}%;background:${pcolor};border-radius:99px"></div>
        </div>
        <span style="background:${pcolor}22;color:${pcolor};padding:3px 10px;border-radius:99px;font-size:.78rem;font-weight:600">Stress ${plbl}</span>
      </div>
    `;
  } catch {}
}
