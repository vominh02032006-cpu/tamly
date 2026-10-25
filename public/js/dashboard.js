/* ===== dashboard.js ===== */

let allStudents  = [];
let dashCharts   = {};
let refreshTimer = null;
let currentSection = 'overview';

document.addEventListener('DOMContentLoaded', async () => {
  const user = requireAuth('teacher');
  if (!user) return;

  // Tên giáo viên
  const sbName = document.getElementById('sidebarName');
  if (sbName) sbName.textContent = user.name;
  const dashDate = document.getElementById('dashDate');
  if (dashDate) dashDate.textContent = fmtDateFull();

  await loadSection('overview');
  startAutoRefresh();
});

// ── Auto refresh mỗi 30 giây ─────────────────────────────────────
function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    loadSection(currentSection);
  }, 30000);
}

// ── Chuyển section ────────────────────────────────────────────────
async function showSec(name, el) {
  event?.preventDefault();
  currentSection = name;
  document.querySelectorAll('.sn').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.dash-sec').forEach(s => s.classList.remove('active'));
  if (el) el.classList.add('active');
  document.getElementById('sec-' + name)?.classList.add('active');
  const titles = {
    overview: 'Tổng quan',
    students: 'Danh sách học sinh',
    alerts:   'Cảnh báo sớm',
    trends:   'Xu hướng 7 ngày',
    manage:   'Quản lý học sinh'
  };
  const t = document.getElementById('secTitle');
  if (t) t.textContent = titles[name] || name;
  await loadSection(name);
}

async function loadSection(name) {
  if (name === 'overview') await loadOverview();
  if (name === 'students') await loadStudents();
  if (name === 'alerts')   await loadAlerts();
  if (name === 'trends')   await loadTrends();
}

// ══════════════════════════════════════════════════════════════════
// TỔNG QUAN
// ══════════════════════════════════════════════════════════════════
async function loadOverview() {
  try {
    const ov = await api('GET', '/api/dashboard/overview');
    const sc = document.getElementById('statCards');
    sc.innerHTML = `
      <div class="sc">
        <div class="sc-icon blue">🎒</div>
        <div><div class="sc-num">${ov.totalStudents}</div><div class="sc-lbl">Học sinh</div></div>
      </div>
      <div class="sc">
        <div class="sc-icon green">✅</div>
        <div>
          <div class="sc-num">${ov.checkinToday}</div>
          <div class="sc-lbl">Check-in hôm nay</div>
          <div style="font-size:.72rem;color:var(--muted)">${ov.checkinRate}% tổng số</div>
        </div>
      </div>
      <div class="sc" style="cursor:pointer" onclick="showSec('alerts',document.querySelector('[data-sec=alerts]'))">
        <div class="sc-icon yellow">⚠️</div>
        <div><div class="sc-num" style="color:${ov.alertsToday>0?'#ef4444':'inherit'}">${ov.alertsToday}</div><div class="sc-lbl">Cần quan tâm</div></div>
      </div>
      <div class="sc">
        <div class="sc-icon purple">💚</div>
        <div>
          <div class="sc-num" style="color:${ov.avgMHI>=70?'#22c55e':ov.avgMHI>=40?'#f59e0b':'#ef4444'}">${ov.avgMHI ?? '–'}</div>
          <div class="sc-lbl">MHI trung bình</div>
        </div>
      </div>
      <div class="sc">
        <div class="sc-icon blue2">🕐</div>
        <div>
          <div class="sc-num" style="font-size:1rem">${new Date().toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}</div>
          <div class="sc-lbl">Cập nhật lúc</div>
        </div>
      </div>
    `;

    // Cập nhật badge cảnh báo sidebar
    const badge = document.getElementById('alertBadge');
    if (badge) badge.textContent = ov.alertsToday > 0 ? ov.alertsToday : '';

    if (ov.checkinToday === 0) {
      document.getElementById('overviewEmpty').style.display = 'block';
      document.getElementById('overviewCharts').style.display = 'none';
    } else {
      document.getElementById('overviewEmpty').style.display = 'none';
      document.getElementById('overviewCharts').style.display = 'block';
      await loadOverviewCharts();
    }
  } catch(e) { showToast('Lỗi tải tổng quan: ' + e.message, 'error'); }
}

async function loadOverviewCharts() {
  const students  = await api('GET', '/api/dashboard/students');
  const todayStr  = new Date().toDateString();
  const todayData = students
    .filter(s => s.lastCheckin && new Date(s.lastCheckin).toDateString() === todayStr)
    .map(s => s.latestData).filter(Boolean);

  if (!todayData.length) return;

  // Phân phối cảm xúc hôm nay
  const emoCounts = [0,0,0,0,0,0];
  todayData.forEach(d => { if (d.emotion >= 0 && d.emotion <= 5) emoCounts[d.emotion]++; });

  destroyDC('emoDist');
  dashCharts['emoDist'] = new Chart(document.getElementById('emoDist'), {
    type: 'bar',
    data: {
      labels: ['😞 Tuyệt vọng','😰 Lo lắng','😔 Buồn','😐 Bình thường','😊 Tích cực','😄 Rất tích cực'],
      datasets: [{ data: emoCounts, backgroundColor:['#991b1b','#ef4444','#f97316','#f59e0b','#84cc16','#22c55e'], borderRadius:6 }]
    },
    options: {
      responsive: true, plugins:{ legend:{display:false} },
      scales:{ x:{grid:{display:false}}, y:{grid:{color:'#f1f5f9'},ticks:{stepSize:1}} }
    }
  });

  // Phân phối stress
  let low=0, mid=0, high=0;
  todayData.forEach(d => {
    if (d.stressLevel <= 3) low++;
    else if (d.stressLevel <= 6) mid++;
    else high++;
  });

  destroyDC('stressDist');
  dashCharts['stressDist'] = new Chart(document.getElementById('stressDist'), {
    type: 'doughnut',
    data: { labels:['Thấp (0-3)','Trung bình (4-6)','Cao (7-10)'], datasets:[{ data:[low,mid,high], backgroundColor:['#22c55e','#f59e0b','#ef4444'], borderWidth:0 }] },
    options: { responsive:true, plugins:{legend:{display:true,position:'bottom',labels:{font:{size:11}}}}, cutout:'65%' }
  });
}

// ══════════════════════════════════════════════════════════════════
// HỌC SINH
// ══════════════════════════════════════════════════════════════════
async function loadStudents() {
  try {
    allStudents = await api('GET', '/api/dashboard/students');
    renderStudentTable(allStudents);
  } catch(e) { showToast('Lỗi tải danh sách: ' + e.message, 'error'); }
}

function renderStudentTable(students) {
  const empty = document.getElementById('students-empty');
  const wrap  = document.getElementById('students-tbl-wrap');

  if (!students.length) {
    empty.style.display = 'block'; wrap.style.display = 'none'; return;
  }
  empty.style.display = 'none'; wrap.style.display = 'block';

  const tbody = document.getElementById('stuTbody');
  const today = new Date().toDateString();

  tbody.innerHTML = students.map(s => {
    const d       = s.latestData;
    const em      = d ? (EMOTION_MAP[d.emotion] || EMOTION_MAP[3]) : null;
    const mhiCls  = d ? (d.mhi>=70?'high':d.mhi>=40?'mid':'low') : '';
    const isToday = s.lastCheckin && new Date(s.lastCheckin).toDateString() === today;

    let stKey = 'ok';
    if (d?.alerts?.length > 0) stKey = d.alerts.some(a=>a.level==='danger') ? 'danger' : 'warn';
    const stMap = { ok:['✅ Ổn định','ok'], warn:['⚠️ Chú ý','warn'], danger:['🔴 Khẩn cấp','alert'] };
    const [stLbl, stCls] = stMap[stKey];

    return `<tr>
      <td><code style="background:#f1f5f9;padding:2px 7px;border-radius:5px">${s.username}</code></td>
      <td><strong>${s.name}</strong><br><small style="color:var(--muted)">Lớp ${s.class||'–'}</small></td>
      <td>${s.totalCheckins} lần</td>
      <td>${s.lastCheckin
            ? (isToday ? '<span class="today-tag">Hôm nay</span>' : fmtDate(s.lastCheckin))
            : '<span class="no-checkin">Chưa check-in</span>'}</td>
      <td>${em ? `${em.emoji} ${em.label}` : '–'}</td>
      <td>${d ? d.sleepHours+'h' : '–'}</td>
      <td>${d ? d.stressLevel+'/10' : '–'}</td>
      <td>${d ? `<span class="mhi-badge ${mhiCls}">${d.mhi}</span>` : '–'}</td>
      <td>${d ? `<span class="status-badge ${stCls}">${stLbl}</span>` : '–'}</td>
      <td><button class="btn-detail" onclick="openStudent('${s.id}')">Xem chi tiết</button></td>
    </tr>`;
  }).join('');
}

function filterStudents(q) {
  const lq = q.toLowerCase();
  renderStudentTable(allStudents.filter(s =>
    s.name.toLowerCase().includes(lq) ||
    s.username.toLowerCase().includes(lq) ||
    (s.class||'').toLowerCase().includes(lq)
  ));
}

// Xuất CSV
function exportStudentsCSV() {
  if (!allStudents.length) { showToast('Không có dữ liệu để xuất', 'error'); return; }
  const rows = [['Mã HS','Họ tên','Lớp','Số check-in','Check-in gần nhất','Cảm xúc','Giờ ngủ','Stress','MHI']];
  const today = new Date().toDateString();
  allStudents.forEach(s => {
    const d  = s.latestData;
    const em = d ? (EMOTION_MAP[d.emotion]?.label || d.emotion) : '';
    rows.push([
      s.username, s.name, s.class||'', s.totalCheckins,
      s.lastCheckin ? fmtDate(s.lastCheckin) : 'Chưa check-in',
      em, d ? d.sleepHours+'h' : '', d ? d.stressLevel+'/10' : '', d ? d.mhi : ''
    ]);
  });
  const csv  = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff'+csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href = url;
  a.download = `moodtok_hocsinh_${new Date().toLocaleDateString('vi-VN').replace(/\//g,'-')}.csv`;
  a.click(); URL.revokeObjectURL(url);
  showToast('Đã xuất CSV thành công!', 'success');
}

// ══════════════════════════════════════════════════════════════════
// CẢNH BÁO
// ══════════════════════════════════════════════════════════════════
async function loadAlerts() {
  try {
    const alerts = await api('GET', '/api/dashboard/alerts');
    const badge  = document.getElementById('alertBadge');
    if (badge) badge.textContent = alerts.length > 0 ? alerts.length : '';

    const empty = document.getElementById('alertsEmpty');
    const list  = document.getElementById('alertsList');

    if (!alerts.length) {
      if (empty) empty.style.display = 'block';
      if (list)  list.innerHTML = '';
      return;
    }
    if (empty) empty.style.display = 'none';

    list.innerHTML = alerts.map(c => {
      const isDanger   = c.alerts.some(a => a.level === 'danger');
      const reasonsHtml = c.alerts.map(a =>
        `<span class="ar ${a.level}">${a.level==='danger'?'🔴':'🟡'} ${a.msg}</span>`
      ).join('');

      return `<div class="alert-card ${isDanger ? '' : 'warn'}">
        <div class="ac-icon">${isDanger ? '🔴' : '⚠️'}</div>
        <div class="ac-body">
          <div class="ac-name">${c.studentName}
            <span class="ac-class"> · ${c.class||''} · MHI: <strong style="color:${mhiColor(c.mhi)}">${c.mhi}/100</strong></span>
          </div>
          <div class="ac-date">Check-in: ${fmtDate(c.date)}</div>
          <div class="ac-reasons">${reasonsHtml}</div>
          ${c.shareText ? `<div class="ac-share">💬 "${c.shareText.slice(0,120)}${c.shareText.length>120?'...':''}"</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <button class="btn-detail" onclick="openStudent('${c.studentId}')">Chi tiết</button>
        </div>
      </div>`;
    }).join('');
  } catch(e) { showToast('Lỗi tải cảnh báo: ' + e.message, 'error'); }
}

// ══════════════════════════════════════════════════════════════════
// XU HƯỚNG
// ══════════════════════════════════════════════════════════════════
async function loadTrends() {
  try {
    const trends  = await api('GET', '/api/dashboard/trends');
    const hasData = trends.some(t => t.count > 0);
    const empty   = document.getElementById('trendsEmpty');
    const chartsEl = document.getElementById('trendsCharts');

    if (!hasData) {
      if (empty)    empty.style.display = 'block';
      if (chartsEl) chartsEl.style.display = 'none';
      return;
    }
    if (empty)    empty.style.display = 'none';
    if (chartsEl) chartsEl.style.display = 'block';

    const labels = trends.map(t => t.date);
    const lineOpts = {
      responsive: true,
      plugins: { legend: { display: true, labels: { font: { size: 11 } } } },
      scales: { x: { grid: { display: false } }, y: { grid: { color: '#f1f5f9' } } }
    };

    // MHI trung bình
    destroyDC('mhiTrend');
    dashCharts['mhiTrend'] = new Chart(document.getElementById('mhiTrend'), {
      type: 'line',
      data: { labels, datasets: [{
        label: 'MHI TB', data: trends.map(t => t.avgMHI),
        borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,.1)',
        fill: true, tension: 0.4, pointRadius: 5, pointBackgroundColor: '#6366f1', spanGaps: true
      }, {
        label: 'Số check-in', data: trends.map(t => t.count),
        borderColor: '#94a3b8', borderDash: [4,4],
        fill: false, tension: 0.4, pointRadius: 3, yAxisID: 'y2', spanGaps: true
      }] },
      options: { ...lineOpts,
        scales: { ...lineOpts.scales, y: { ...lineOpts.scales.y, min:0, max:100, title:{display:true,text:'MHI'} }, y2: { position:'right', grid:{display:false}, title:{display:true,text:'Số HS'} } }
      }
    });

    // Giấc ngủ & MXH
    destroyDC('sleepSocialTrend');
    dashCharts['sleepSocialTrend'] = new Chart(document.getElementById('sleepSocialTrend'), {
      type: 'line',
      data: { labels, datasets: [
        { label:'Ngủ TB (h)', data:trends.map(t=>t.avgSleep), borderColor:'#22c55e', fill:false, tension:0.4, pointRadius:4, spanGaps:true },
        { label:'MXH TB (h)', data:trends.map(t=>t.avgSocial), borderColor:'#8b5cf6', fill:false, tension:0.4, pointRadius:4, spanGaps:true }
      ] },
      options: lineOpts
    });

    // Stress & Áp lực
    destroyDC('stressTrend');
    dashCharts['stressTrend'] = new Chart(document.getElementById('stressTrend'), {
      type: 'line',
      data: { labels, datasets: [
        { label:'Stress TB', data:trends.map(t=>t.avgStress), borderColor:'#ef4444', fill:false, tension:0.4, pointRadius:4, spanGaps:true },
        { label:'Áp lực TB', data:trends.map(t=>t.avgPressure), borderColor:'#f59e0b', fill:false, tension:0.4, pointRadius:4, spanGaps:true }
      ] },
      options: { ...lineOpts, scales: { ...lineOpts.scales, y: { ...lineOpts.scales.y, min:0, max:10 } } }
    });

    // Cảm xúc TB
    destroyDC('emotionTrend');
    const emoCanvas = document.getElementById('emotionTrend');
    if (emoCanvas) {
      dashCharts['emotionTrend'] = new Chart(emoCanvas, {
        type: 'line',
        data: { labels, datasets: [{
          label:'Cảm xúc TB', data:trends.map(t=>t.avgEmotion),
          borderColor:'#6366f1', backgroundColor:'rgba(99,102,241,.08)',
          fill:true, tension:0.4, pointRadius:4, spanGaps:true
        }] },
        options: { ...lineOpts, scales:{ ...lineOpts.scales, y:{ min:0, max:5, ticks:{ callback: v => ['😞','😰','😔','😐','😊','😄'][v]||v } } } }
      });
    }

  } catch(e) { showToast('Lỗi tải xu hướng: ' + e.message, 'error'); }
}

// ══════════════════════════════════════════════════════════════════
// QUẢN LÝ HỌC SINH
// ══════════════════════════════════════════════════════════════════
async function createStudent() {
  const username = document.getElementById('new-username').value.trim();
  const name     = document.getElementById('new-name').value.trim();
  const cls      = document.getElementById('new-class').value.trim();
  const resEl    = document.getElementById('createResult');

  if (!username || !name || !cls) {
    showToast('Vui lòng điền đầy đủ thông tin!', 'error'); return;
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    showToast('Tên đăng nhập chỉ dùng chữ không dấu, số và _', 'error'); return;
  }

  const btn = document.querySelector('#sec-manage .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Đang tạo…'; }

  try {
    const r = await api('POST', '/api/auth/create-student', { username, name, studentClass: cls });
    if (resEl) {
      resEl.style.display = 'block';
      resEl.style.cssText += ';background:#dcfce7;color:#166534;border-radius:10px;padding:12px;font-size:.85rem;line-height:1.7';
      resEl.innerHTML = `✅ <strong>Tạo tài khoản thành công!</strong><br>
        Mã đăng nhập: <strong>${r.student.username}</strong><br>
        Mật khẩu mặc định: <strong>${r.student.defaultPassword}</strong><br>
        <small>Học sinh cần đổi mật khẩu sau khi đăng nhập lần đầu.</small>`;
    }
    document.getElementById('new-username').value = '';
    document.getElementById('new-name').value = '';
    document.getElementById('new-class').value = '';
    showToast('Tạo tài khoản thành công!', 'success');
  } catch(e) {
    if (resEl) {
      resEl.style.display = 'block';
      resEl.style.cssText += ';background:#fee2e2;color:#991b1b;border-radius:10px;padding:12px;font-size:.85rem';
      resEl.textContent = '❌ ' + e.message;
    }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Tạo tài khoản'; }
  }
}

// ══════════════════════════════════════════════════════════════════
// MODAL CHI TIẾT HỌC SINH
// ══════════════════════════════════════════════════════════════════
async function openStudent(id) {
  const modal   = document.getElementById('stuModal');
  const content = document.getElementById('modalContent');
  if (!modal || !content) return;

  content.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">⏳ Đang tải…</div>';
  modal.classList.add('open');

  try {
    const data    = await api('GET', `/api/dashboard/student/${id}`);
    const s       = data.student;
    const history = data.checkins;
    const latest  = history[0];

    if (!latest) {
      content.innerHTML = `
        <div class="modal-name">${s.name}</div>
        <div class="modal-meta">${s.username} · Lớp ${s.class||'–'}</div>
        <div style="text-align:center;padding:32px;color:var(--muted)">
          <div style="font-size:2.5rem;margin-bottom:12px">📭</div>
          <p>Học sinh chưa có dữ liệu check-in.</p>
        </div>`;
      return;
    }

    const bd      = getBreakdown(latest);
    const em      = EMOTION_MAP[latest.emotion] || EMOTION_MAP[3];
    const st      = mhiStatus(latest.mhi);
    const color   = mhiColor(latest.mhi);
    const mhiCls  = latest.mhi>=70?'high':latest.mhi>=40?'mid':'low';

    // Render AI analysis
    let aiHtml = '';
    if (latest.aiAnalysis) {
      try {
        const p = JSON.parse(latest.aiAnalysis.replace(/```json|```/g,'').trim());
        aiHtml = (p.tips||[]).map(t =>
          `<div style="background:#f8fafc;border-radius:8px;padding:9px 12px;font-size:.84rem;margin-bottom:6px">${t.icon||'💡'} ${t.text}</div>`
        ).join('');
      } catch {
        aiHtml = `<div style="background:#f8fafc;border-radius:8px;padding:9px 12px;font-size:.84rem">${latest.aiAnalysis.replace(/\n/g,'<br>')}</div>`;
      }
    } else {
      aiHtml = '<div style="color:#94a3b8;font-size:.84rem">Chưa có phân tích AI (học sinh chưa chia sẻ hoặc AI chưa bật).</div>';
    }

    const alertsHtml = latest.alerts?.length
      ? latest.alerts.map(a => `<span class="ar ${a.level}">${a.level==='danger'?'🔴':'🟡'} ${a.msg}</span>`).join('')
      : '<span style="color:#22c55e;font-size:.84rem">✅ Không có cảnh báo</span>';

    // Lịch sử gần nhất (5 lần)
    const histRows = history.slice(0,5).map(h => {
      const hEm  = EMOTION_MAP[h.emotion]||EMOTION_MAP[3];
      const hCls = h.mhi>=70?'high':h.mhi>=40?'mid':'low';
      return `<tr>
        <td>${fmtDate(h.date)}</td>
        <td>${hEm.emoji}</td>
        <td>${h.sleepHours}h</td>
        <td>${h.stressLevel}/10</td>
        <td><span class="mhi-badge ${hCls}" style="font-size:.75rem">${h.mhi}</span></td>
      </tr>`;
    }).join('');

    content.innerHTML = `
      <div class="modal-name">${s.name}</div>
      <div class="modal-meta">${s.username} · Lớp ${s.class||'–'} · Tổng <strong>${history.length}</strong> check-in</div>

      <!-- MHI Ring nhỏ -->
      <div style="display:flex;gap:16px;align-items:center;margin:16px 0;background:#f8fafc;border-radius:14px;padding:14px">
        <div style="text-align:center;min-width:60px">
          <div style="font-size:2.2rem;font-weight:800;color:${color};line-height:1">${latest.mhi}</div>
          <div style="font-size:.7rem;color:var(--muted)">MHI</div>
        </div>
        <div style="flex:1">
          <span class="mhi-badge ${mhiCls}" style="font-size:.85rem;padding:5px 14px">${st.label}</span>
          <div style="font-size:.83rem;color:var(--muted);margin-top:6px">Check-in gần nhất: ${fmtDate(latest.date)}</div>
        </div>
      </div>

      <!-- Điểm thành phần -->
      <div class="modal-sec">📊 Điểm thành phần</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">
        ${bd.map(b => `
          <div style="background:#f8fafc;border-radius:10px;padding:10px;text-align:center">
            <div style="font-size:1.1rem">${b.icon}</div>
            <div style="font-size:.7rem;color:var(--muted);margin:2px 0">${b.label}</div>
            <div style="font-size:1.1rem;font-weight:800;color:${b.score>=75?'#22c55e':b.score>=50?'#f59e0b':'#ef4444'}">${b.score}</div>
          </div>`).join('')}
      </div>

      <!-- Dữ liệu chi tiết -->
      <div class="modal-sec">📋 Dữ liệu gần nhất</div>
      <div class="modal-row"><span>${em.emoji} Cảm xúc</span><span>${em.label}</span></div>
      <div class="modal-row"><span>😴 Giấc ngủ</span><span>${latest.sleepHours}h · ${QUALITY_MAP[latest.sleepQuality]||'–'}</span></div>
      <div class="modal-row"><span>📱 Mạng xã hội</span><span>${latest.socialHours}h</span></div>
      <div class="modal-row"><span>📚 Áp lực học tập</span><span>Mức ${latest.studyPressure}/4</span></div>
      <div class="modal-row"><span>🧘 Stress</span><span>${latest.stressLevel}/10</span></div>

      <!-- Cảnh báo -->
      <div class="modal-sec">⚠️ Cảnh báo</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">${alertsHtml}</div>

      <!-- Chia sẻ của học sinh -->
      ${latest.shareText ? `
        <div class="modal-sec">💬 Chia sẻ của học sinh</div>
        <div class="modal-share">"${latest.shareText}"</div>` : ''}

      <!-- Phân tích AI -->
      <div class="modal-sec">🤖 Phân tích AI</div>
      <div>${aiHtml}</div>

      <!-- Lịch sử 5 lần gần nhất -->
      <div class="modal-sec">📅 5 lần check-in gần nhất</div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:.82rem">
          <thead><tr style="background:#f8fafc">
            <th style="padding:7px 10px;text-align:left;border-bottom:1px solid var(--border)">Ngày</th>
            <th style="padding:7px 10px;text-align:left;border-bottom:1px solid var(--border)">Cảm xúc</th>
            <th style="padding:7px 10px;text-align:left;border-bottom:1px solid var(--border)">Ngủ</th>
            <th style="padding:7px 10px;text-align:left;border-bottom:1px solid var(--border)">Stress</th>
            <th style="padding:7px 10px;text-align:left;border-bottom:1px solid var(--border)">MHI</th>
          </tr></thead>
          <tbody>${histRows}</tbody>
        </table>
      </div>

      <div style="background:#fffbeb;border-radius:8px;padding:10px 12px;font-size:.79rem;color:#78350f;margin-top:14px">
        ⚠️ Thông tin chỉ mang tính tham khảo. Cần gặp gỡ trực tiếp để đánh giá chính xác.
      </div>
    `;
  } catch(e) {
    content.innerHTML = `<div style="text-align:center;padding:32px;color:var(--red)">❌ ${e.message}</div>`;
  }
}

function closeModal(e) {
  if (e.target === document.getElementById('stuModal'))
    document.getElementById('stuModal').classList.remove('open');
}

function destroyDC(id) {
  if (dashCharts[id]) { dashCharts[id].destroy(); delete dashCharts[id]; }
}
