/* ===== dashboard.js ===== */

const MOCK_STUDENTS = [
  { id:'HS001', name:'Nguyễn Văn An',   class:'12A1', lastCheckin:'hôm nay',      emotion:4, sleepHours:7.5, sleepQuality:3, socialHours:1.5, studyPressure:1, stressLevel:3,  status:'ok'    },
  { id:'HS002', name:'Trần Thị Bình',   class:'12A1', lastCheckin:'hôm nay',      emotion:1, sleepHours:4.5, sleepQuality:0, socialHours:5.5, studyPressure:4, stressLevel:9,  status:'alert' },
  { id:'HS003', name:'Lê Minh Cường',   class:'12A2', lastCheckin:'hôm nay',      emotion:3, sleepHours:6.5, sleepQuality:2, socialHours:2.5, studyPressure:3, stressLevel:6,  status:'warn'  },
  { id:'HS004', name:'Phạm Ngọc Dung',  class:'11A1', lastCheckin:'hôm qua',      emotion:5, sleepHours:8.5, sleepQuality:4, socialHours:0.5, studyPressure:0, stressLevel:1,  status:'ok'    },
  { id:'HS005', name:'Hoàng Thị Ema',   class:'11A1', lastCheckin:'hôm nay',      emotion:0, sleepHours:3.5, sleepQuality:0, socialHours:6,   studyPressure:4, stressLevel:10, status:'alert' },
  { id:'HS006', name:'Ngô Văn Phát',    class:'12A2', lastCheckin:'hôm nay',      emotion:4, sleepHours:7.5, sleepQuality:3, socialHours:1.5, studyPressure:1, stressLevel:2,  status:'ok'    },
  { id:'HS007', name:'Vũ Thị Giang',    class:'10A1', lastCheckin:'2 ngày trước', emotion:2, sleepHours:6,   sleepQuality:1, socialHours:3.5, studyPressure:3, stressLevel:7,  status:'warn'  },
  { id:'HS008', name:'Đặng Minh Hải',   class:'10A1', lastCheckin:'hôm nay',      emotion:4, sleepHours:8,   sleepQuality:3, socialHours:1.5, studyPressure:1, stressLevel:3,  status:'ok'    },
];

MOCK_STUDENTS.forEach(s => {
  s.mhi = computeMHI(s);
});

let filteredStudents = [...MOCK_STUDENTS];
let dashCharts = {};

document.addEventListener('DOMContentLoaded', function() {
  const user = requireAuth('teacher');
  if (!user) return;

  const nameEl = document.getElementById('sidebarName');
  if (nameEl) nameEl.textContent = user.name || 'Giáo viên';

  const dateEl = document.getElementById('dashDate');
  if (dateEl) dateEl.textContent = formatDateVN(new Date());

  renderStudentTable(MOCK_STUDENTS);
  renderAlerts();
  initCharts();
});

function showSection(name) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.dash-section').forEach(s => s.classList.remove('active'));

  event.currentTarget?.classList.add('active');
  const sec = document.getElementById('section-' + name);
  if (sec) sec.classList.add('active');

  const titles = {
    overview: 'Tổng quan', students: 'Danh sách học sinh',
    alerts: 'Cảnh báo sớm', trends: 'Xu hướng', surveys: 'Khảo sát'
  };
  const titleEl = document.getElementById('sectionTitle');
  if (titleEl) titleEl.textContent = titles[name] || name;

  if (name === 'trends') renderTrendCharts();
  if (name === 'surveys') renderSurveyChart();
}

function filterByClass() {
  const cls = document.getElementById('classFilter')?.value;
  filteredStudents = cls === 'all' ? [...MOCK_STUDENTS] : MOCK_STUDENTS.filter(s => s.class === cls);
  renderStudentTable(filteredStudents);
}

function filterStudents(query) {
  const q = query.toLowerCase();
  filteredStudents = MOCK_STUDENTS.filter(s =>
    s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
  );
  renderStudentTable(filteredStudents);
}

function filterByMHI(range) {
  if (range === 'all') { filteredStudents = [...MOCK_STUDENTS]; }
  else if (range === 'high') { filteredStudents = MOCK_STUDENTS.filter(s => s.mhi >= 70); }
  else if (range === 'mid') { filteredStudents = MOCK_STUDENTS.filter(s => s.mhi >= 40 && s.mhi < 70); }
  else { filteredStudents = MOCK_STUDENTS.filter(s => s.mhi < 40); }
  renderStudentTable(filteredStudents);
}

function renderStudentTable(students) {
  const tbody = document.getElementById('studentTableBody');
  if (!tbody) return;

  tbody.innerHTML = students.map(s => {
    const em = EMOTION_MAP[s.emotion] || EMOTION_MAP[3];
    const mhiClass = s.mhi >= 70 ? 'high' : s.mhi >= 40 ? 'mid' : 'low';
    const statusMap = { ok: ['✅ Ổn định', 'ok'], warn: ['⚠️ Chú ý', 'warn'], alert: ['🔴 Cần hỗ trợ', 'alert'] };
    const [sLabel, sCls] = statusMap[s.status] || statusMap.ok;

    return `<tr>
      <td><code>${s.id}</code></td>
      <td><strong>${s.name}</strong></td>
      <td>${s.class}</td>
      <td>${s.lastCheckin}</td>
      <td>${em.emoji} ${em.label}</td>
      <td>${s.sleepHours}h</td>
      <td>${s.stressLevel}/10</td>
      <td><span class="mhi-badge ${mhiClass}">${s.mhi}</span></td>
      <td><span class="status-badge ${sCls}">${sLabel}</span></td>
      <td><button class="btn-detail" onclick="openStudentModal('${s.id}')">Chi tiết</button></td>
    </tr>`;
  }).join('');
}

function renderAlerts() {
  const alertStudents = MOCK_STUDENTS.filter(s => s.status !== 'ok');
  const list = document.getElementById('alertsList');
  if (!list) return;

  // Update badge
  const badge = document.getElementById('alertBadge');
  const alertCount = document.getElementById('alertCount');
  if (badge) badge.textContent = alertStudents.length;
  if (alertCount) alertCount.textContent = alertStudents.length;

  list.innerHTML = alertStudents.map(s => {
    const reasons = getRuleAlerts(s).map(a => `<span class="alert-reason">${a.msg.replace(/^[^\s]+\s/, '')}</span>`).join('');
    const isAlert = s.status === 'alert';
    return `<div class="alert-card ${isAlert ? '' : 'warn'}">
      <div class="alert-icon">${isAlert ? '🔴' : '⚠️'}</div>
      <div class="alert-body">
        <div class="alert-name">${s.name} – ${s.id}</div>
        <div class="alert-meta">Lớp ${s.class} • Check-in: ${s.lastCheckin} • MHI: ${s.mhi}/100</div>
        <div class="alert-reasons">${reasons}</div>
      </div>
      <div class="alert-actions">
        <button class="btn-contact" onclick="openStudentModal('${s.id}')">Xem chi tiết</button>
      </div>
    </div>`;
  }).join('');
}

function initCharts() {
  const days7 = generateMockHistory(6);
  const labels = days7.map(h => formatDateShort(h.date));

  // Emotion distribution (today)
  const emotionCounts = [0,0,0,0,0,0];
  MOCK_STUDENTS.forEach(s => { if (s.emotion >= 0) emotionCounts[s.emotion]++; });

  destroyDashChart('emotionDistChart');
  dashCharts['emotionDistChart'] = new Chart(document.getElementById('emotionDistChart'), {
    type: 'bar',
    data: {
      labels: ['😞 Kiệt sức','😰 Căng thẳng','😔 Buồn','😐 Bình thường','😊 Vui','😄 Rất vui'],
      datasets: [{
        data: emotionCounts.reverse(),
        backgroundColor: ['#991b1b','#ef4444','#f97316','#f59e0b','#84cc16','#22c55e'],
        borderRadius: 8,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: '#f1f5f9' }, ticks: { stepSize: 1 } }
      }
    }
  });

  // Avg social vs sleep
  const avgSleep = (MOCK_STUDENTS.reduce((a,s) => a + s.sleepHours, 0) / MOCK_STUDENTS.length).toFixed(1);
  const avgSocial = (MOCK_STUDENTS.reduce((a,s) => a + s.socialHours, 0) / MOCK_STUDENTS.length).toFixed(1);

  destroyDashChart('avgChart');
  dashCharts['avgChart'] = new Chart(document.getElementById('avgChart'), {
    type: 'doughnut',
    data: {
      labels: ['Giấc ngủ TB (h)', 'Mạng XH TB (h)', 'Còn lại'],
      datasets: [{
        data: [parseFloat(avgSleep), parseFloat(avgSocial), 24 - parseFloat(avgSleep) - parseFloat(avgSocial)],
        backgroundColor: ['#22c55e', '#8b5cf6', '#e5e7eb'],
        borderWidth: 0,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true, position: 'bottom', labels: { font: { size: 11 } } }
      },
      cutout: '65%'
    }
  });

  // MHI trend
  const mhiTrend = days7.map(() => 55 + Math.random() * 20);
  destroyDashChart('mhiTrendChart');
  dashCharts['mhiTrendChart'] = new Chart(document.getElementById('mhiTrendChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: mhiTrend.map(v => Math.round(v)),
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99,102,241,0.08)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#6366f1',
        pointRadius: 4,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { min: 0, max: 100, grid: { color: '#f1f5f9' } }
      }
    }
  });

  // Stress distribution
  const stressCounts = { low: 0, mid: 0, high: 0 };
  MOCK_STUDENTS.forEach(s => {
    if (s.stressLevel <= 3) stressCounts.low++;
    else if (s.stressLevel <= 6) stressCounts.mid++;
    else stressCounts.high++;
  });

  destroyDashChart('stressDistChart');
  dashCharts['stressDistChart'] = new Chart(document.getElementById('stressDistChart'), {
    type: 'pie',
    data: {
      labels: ['Thấp (1-3)', 'Trung bình (4-6)', 'Cao (7-10)'],
      datasets: [{
        data: [stressCounts.low, stressCounts.mid, stressCounts.high],
        backgroundColor: ['#22c55e', '#f59e0b', '#ef4444'],
        borderWidth: 0,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true, position: 'bottom', labels: { font: { size: 11 } } } }
    }
  });
}

function renderTrendCharts() {
  const days = generateMockHistory(6);
  const labels = days.map(h => formatDateShort(h.date));

  const commonOpts = {
    responsive: true,
    plugins: { legend: { display: true, labels: { font: { size: 11 } } } },
    scales: {
      x: { grid: { display: false } },
      y: { grid: { color: '#f1f5f9' } }
    }
  };

  destroyDashChart('trendEmotionChart');
  dashCharts['trendEmotionChart'] = new Chart(document.getElementById('trendEmotionChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Cảm xúc TB',
        data: days.map(d => +(d.emotion).toFixed(1)),
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99,102,241,0.08)',
        fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#6366f1'
      }]
    },
    options: { ...commonOpts, scales: { ...commonOpts.scales, y: { min: 0, max: 5 } } }
  });

  destroyDashChart('trendSleepSocialChart');
  dashCharts['trendSleepSocialChart'] = new Chart(document.getElementById('trendSleepSocialChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Giấc ngủ TB (h)',
          data: days.map(d => +d.sleepHours),
          borderColor: '#22c55e', fill: false, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#22c55e'
        },
        {
          label: 'Mạng XH TB (h)',
          data: days.map(d => +d.socialHours),
          borderColor: '#8b5cf6', fill: false, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#8b5cf6'
        }
      ]
    },
    options: commonOpts
  });

  destroyDashChart('trendStressChart');
  dashCharts['trendStressChart'] = new Chart(document.getElementById('trendStressChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Stress TB',
          data: days.map(d => d.stressLevel),
          borderColor: '#ef4444', fill: false, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#ef4444'
        },
        {
          label: 'Áp lực học TB',
          data: days.map(d => d.studyPressure),
          borderColor: '#f59e0b', fill: false, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#f59e0b'
        }
      ]
    },
    options: { ...commonOpts, scales: { ...commonOpts.scales, y: { min: 0, max: 10 } } }
  });
}

function renderSurveyChart() {
  const who5Data = [5, 12, 18, 24, 19, 11, 7]; // mock distribution
  const who5Labels = ['0-14','15-24','25-34','35-44','45-54','55-64','65-100'];

  destroyDashChart('who5Chart');
  dashCharts['who5Chart'] = new Chart(document.getElementById('who5Chart'), {
    type: 'bar',
    data: {
      labels: who5Labels,
      datasets: [{
        label: 'Số học sinh',
        data: who5Data,
        backgroundColor: who5Labels.map((_, i) => {
          if (i <= 1) return '#fecaca';
          if (i <= 3) return '#fed7aa';
          return '#bbf7d0';
        }),
        borderRadius: 8,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        annotation: {
          annotations: {
            threshold: { type: 'line', xMin: 2.5, xMax: 2.5, borderColor: '#ef4444', borderWidth: 2, borderDash: [4,4] }
          }
        }
      },
      scales: {
        x: { grid: { display: false }, title: { display: true, text: 'Điểm WHO-5' } },
        y: { grid: { color: '#f1f5f9' }, title: { display: true, text: 'Số học sinh' } }
      }
    }
  });
}

function destroyDashChart(id) {
  if (dashCharts[id]) { dashCharts[id].destroy(); delete dashCharts[id]; }
}

function openStudentModal(id) {
  const s = MOCK_STUDENTS.find(x => x.id === id);
  if (!s) return;

  const em = EMOTION_MAP[s.emotion] || EMOTION_MAP[3];
  const mhiClass = s.mhi >= 70 ? 'high' : s.mhi >= 40 ? 'mid' : 'low';
  const qual = QUALITY_MAP[s.sleepQuality] || '-';
  const tips = getAISuggestions(s);
  const alerts = getRuleAlerts(s);

  const content = document.getElementById('modalContent');
  content.innerHTML = `
    <div class="modal-student-name">${s.name}</div>
    <div class="modal-student-meta">Mã: ${s.id} • Lớp: ${s.class} • Check-in: ${s.lastCheckin}</div>

    <div style="display:flex;gap:16px;align-items:center;margin-bottom:16px;">
      <div style="text-align:center;">
        <div style="font-size:2.5rem;font-weight:700;color:${s.mhi >= 70 ? '#22c55e' : s.mhi >= 40 ? '#f59e0b' : '#ef4444'}">${s.mhi}</div>
        <div style="font-size:0.78rem;color:#64748b;">Chỉ số MHI</div>
      </div>
      <div style="flex:1;">
        <span class="mhi-badge ${mhiClass}" style="font-size:0.88rem;padding:6px 14px;">${s.mhi >= 70 ? '✅ Trạng thái tốt' : s.mhi >= 40 ? '⚠️ Cần chú ý' : '🔴 Cần hỗ trợ'}</span>
      </div>
    </div>

    <div class="modal-section-title">Dữ liệu check-in gần nhất</div>
    <div class="modal-row"><span>Cảm xúc</span><span>${em.emoji} ${em.label}</span></div>
    <div class="modal-row"><span>Số giờ ngủ</span><span>${s.sleepHours}h</span></div>
    <div class="modal-row"><span>Chất lượng ngủ</span><span>${qual}</span></div>
    <div class="modal-row"><span>Mạng xã hội</span><span>${s.socialHours}h</span></div>
    <div class="modal-row"><span>Áp lực học tập</span><span>${s.studyPressure}/10</span></div>
    <div class="modal-row"><span>Mức stress</span><span>${s.stressLevel}/10</span></div>

    ${alerts.length > 0 ? `
    <div class="modal-section-title">Dấu hiệu cần quan tâm</div>
    ${alerts.map(a => `<div style="background:#fef2f2;border-radius:8px;padding:10px 12px;font-size:0.85rem;margin-bottom:6px;color:#991b1b;">${a.msg}</div>`).join('')}
    ` : ''}

    <div class="modal-section-title">Gợi ý hỗ trợ</div>
    ${tips.map(t => `<div style="background:#f8fafc;border-radius:8px;padding:10px 12px;font-size:0.85rem;margin-bottom:6px;">${t.icon} ${t.text}</div>`).join('')}

    <div style="margin-top:16px;padding:12px;background:#fffbeb;border-radius:8px;font-size:0.82rem;color:#713f12;">
      ⚠️ Thông tin chỉ mang tính tham khảo. Cần gặp gỡ trực tiếp để đánh giá chính xác hơn.
    </div>
  `;

  document.getElementById('studentModal').classList.add('open');
}

function closeStudentModal() {
  document.getElementById('studentModal').classList.remove('open');
}

function closeModal(e) {
  if (e.target === document.getElementById('studentModal')) closeStudentModal();
}
