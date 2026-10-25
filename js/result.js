/* ===== result.js ===== */

let chartInstances = {};

document.addEventListener('DOMContentLoaded', function() {
  const user = requireAuth();
  if (!user) return;

  const nameEl = document.getElementById('welcomeTitle');
  if (nameEl) nameEl.textContent = `Xin chào, ${user.name}! 👋`;

  // Load latest checkin
  let latest = null;
  try { latest = JSON.parse(localStorage.getItem('moodtok_latest')); } catch {}

  // If no real data, use demo
  if (!latest) {
    latest = {
      emotion: 4, socialHours: 2.5, sleepHours: 7, sleepQuality: 3,
      studyPressure: 6, stressLevel: 5, shareText: ''
    };
  }

  // Compute MHI
  const mhi = computeMHI(latest);
  renderMHICircle(mhi);
  renderMHIStatus(mhi);
  renderTodaySummary(latest);
  renderAISuggestions(latest);

  // Load history
  let history = [];
  try { history = JSON.parse(localStorage.getItem('moodtok_history')) || []; } catch {}
  if (history.length < 7) {
    // Fill with mock data
    history = generateMockHistory(13);
    // Override last with actual
    if (latest.date) {
      history[history.length - 1] = { ...latest, date: new Date(latest.date), mhi };
    }
  } else {
    history = history.map(h => ({ ...h, date: new Date(h.date), mhi: h.mhi || computeMHI(h) }));
  }

  renderCharts(history.slice(-7));
  renderHistoryTable(history.slice(-14).reverse());
});

function renderMHICircle(mhi) {
  const scoreEl = document.getElementById('mhiScore');
  if (scoreEl) scoreEl.textContent = mhi;

  const fillEl = document.getElementById('mhiFill');
  if (fillEl) {
    const circumference = 2 * Math.PI * 50; // 314
    const offset = circumference - (mhi / 100) * circumference;
    fillEl.style.strokeDashoffset = offset;
    if (mhi >= 70) fillEl.setAttribute('stroke', '#22c55e');
    else if (mhi >= 40) fillEl.setAttribute('stroke', '#f59e0b');
    else fillEl.setAttribute('stroke', '#ef4444');
  }
}

function renderMHIStatus(mhi) {
  const statusEl = document.getElementById('mhiStatus');
  const descEl = document.getElementById('mhiDesc');
  const dot = statusEl?.querySelector('.status-dot');

  if (mhi >= 70) {
    if (dot) dot.className = 'status-dot good';
    if (statusEl) statusEl.querySelector('strong').textContent = 'Tốt';
    if (descEl) descEl.textContent = 'Chỉ số sức khỏe tinh thần của bạn hôm nay ở mức tốt. Hãy tiếp tục duy trì thói quen check-in mỗi ngày!';
  } else if (mhi >= 40) {
    if (dot) dot.className = 'status-dot mid';
    if (statusEl) statusEl.querySelector('strong').textContent = 'Cần chú ý';
    if (descEl) descEl.textContent = 'Trạng thái tinh thần của bạn cần được chú ý. Xem các gợi ý bên dưới để cải thiện nhé.';
  } else {
    if (dot) dot.className = 'status-dot bad';
    if (statusEl) statusEl.querySelector('strong').textContent = 'Cần hỗ trợ';
    if (descEl) descEl.textContent = 'Bạn đang trải qua giai đoạn khó khăn. Hãy chia sẻ với giáo viên tư vấn hoặc người thân nhé.';
  }
}

function renderTodaySummary(data) {
  const el = document.getElementById('todaySummary');
  if (!el) return;
  const em = EMOTION_MAP[data.emotion] || EMOTION_MAP[3];

  el.innerHTML = `
    <div class="summary-chip">${em.emoji} ${em.label}</div>
    <div class="summary-chip">😴 ${data.sleepHours}h ngủ</div>
    <div class="summary-chip">📱 ${data.socialHours}h MXH</div>
    <div class="summary-chip">🧘 Stress: ${data.stressLevel}/10</div>
  `;
}

function renderAISuggestions(data) {
  const tips = getAISuggestions(data);
  const el = document.getElementById('aiContent');
  if (!el) return;

  const alerts = getRuleAlerts(data);
  let html = '';

  alerts.forEach(a => {
    html += `<div class="ai-tip" style="border-left:3px solid ${a.level === 'danger' ? '#ef4444' : '#f59e0b'}">
      <span class="ai-tip-icon">${a.level === 'danger' ? '🔴' : '🟡'}</span>
      <span>${a.msg}</span>
    </div>`;
  });

  tips.forEach(t => {
    html += `<div class="ai-tip"><span class="ai-tip-icon">${t.icon}</span><span>${t.text}</span></div>`;
  });

  el.innerHTML = html;
}

function renderCharts(history) {
  const labels = history.map(h => formatDateShort(h.date instanceof Date ? h.date : new Date(h.date)));
  const emotions = history.map(h => h.emotion);
  const sleep = history.map(h => parseFloat(h.sleepHours));
  const social = history.map(h => parseFloat(h.socialHours));
  const stress = history.map(h => h.stressLevel);
  const pressure = history.map(h => h.studyPressure);

  const baseOpts = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
      y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 11 } } }
    }
  };

  // Emotion chart
  destroyChart('emotionChart');
  chartInstances['emotionChart'] = new Chart(document.getElementById('emotionChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: emotions,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99,102,241,0.08)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#6366f1',
        pointRadius: 5,
      }]
    },
    options: {
      ...baseOpts,
      scales: {
        ...baseOpts.scales,
        y: { ...baseOpts.scales.y, min: 0, max: 5, ticks: {
          callback: v => ['😞','😰','😔','😐','😊','😄'][v] || v
        }}
      }
    }
  });

  // Sleep chart
  destroyChart('sleepChart');
  chartInstances['sleepChart'] = new Chart(document.getElementById('sleepChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: sleep,
        backgroundColor: sleep.map(v => v >= 7 ? 'rgba(34,197,94,0.7)' : v >= 6 ? 'rgba(245,158,11,0.7)' : 'rgba(239,68,68,0.7)'),
        borderRadius: 6,
      }]
    },
    options: {
      ...baseOpts,
      scales: {
        ...baseOpts.scales,
        y: { ...baseOpts.scales.y, min: 0, max: 12, ticks: { callback: v => v + 'h' } }
      },
      plugins: {
        ...baseOpts.plugins,
        annotation: {
          annotations: {
            line1: { type: 'line', yMin: 7, yMax: 7, borderColor: '#22c55e', borderWidth: 1, borderDash: [4, 4] }
          }
        }
      }
    }
  });

  // Social chart
  destroyChart('socialChart');
  chartInstances['socialChart'] = new Chart(document.getElementById('socialChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: social,
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139,92,246,0.08)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#8b5cf6',
        pointRadius: 5,
      }]
    },
    options: {
      ...baseOpts,
      scales: {
        ...baseOpts.scales,
        y: { ...baseOpts.scales.y, min: 0, ticks: { callback: v => v + 'h' } }
      }
    }
  });

  // Stress + Pressure chart
  destroyChart('stressChart');
  chartInstances['stressChart'] = new Chart(document.getElementById('stressChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Stress',
          data: stress,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239,68,68,0.05)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#ef4444',
          pointRadius: 4,
        },
        {
          label: 'Áp lực học',
          data: pressure,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245,158,11,0.05)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#f59e0b',
          pointRadius: 4,
        }
      ]
    },
    options: {
      ...baseOpts,
      plugins: { legend: { display: true, labels: { font: { size: 11 } } } },
      scales: {
        ...baseOpts.scales,
        y: { ...baseOpts.scales.y, min: 0, max: 10 }
      }
    }
  });
}

function destroyChart(id) {
  if (chartInstances[id]) {
    chartInstances[id].destroy();
    delete chartInstances[id];
  }
}

function switchChartTab(period) {
  document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');

  let history = [];
  try { history = JSON.parse(localStorage.getItem('moodtok_history')) || []; } catch {}
  if (history.length < 7) history = generateMockHistory(period === 'month' ? 29 : 13);
  else history = history.map(h => ({ ...h, date: new Date(h.date), mhi: h.mhi || computeMHI(h) }));

  const days = period === 'month' ? 30 : 7;
  renderCharts(history.slice(-days));
}

function renderHistoryTable(history) {
  const tbody = document.getElementById('historyTableBody');
  if (!tbody) return;

  tbody.innerHTML = history.map(h => {
    const em = EMOTION_MAP[h.emotion] || EMOTION_MAP[3];
    const mhiClass = h.mhi >= 70 ? 'high' : h.mhi >= 40 ? 'mid' : 'low';
    const d = h.date instanceof Date ? h.date : new Date(h.date);
    return `<tr>
      <td>${d.toLocaleDateString('vi-VN')}</td>
      <td>${em.emoji} ${em.label}</td>
      <td>${h.sleepHours}h</td>
      <td>${h.socialHours}h</td>
      <td>${h.studyPressure}/10</td>
      <td>${h.stressLevel}/10</td>
      <td><span class="mhi-badge ${mhiClass}">${h.mhi}</span></td>
    </tr>`;
  }).join('');
}
