/* ===== sidebar.js – tự inject sidebar, không cần gọi buildSidebar() ===== */

const SIDEBAR_PAGES = [
  { id:'overview', icon:'📊', label:'Tổng quan',  href:'dash-overview.html' },
  { id:'students', icon:'🎒', label:'Học sinh',    href:'dash-students.html' },
  { id:'alerts',   icon:'🔔', label:'Cảnh báo',    href:'dash-alerts.html',  badge:true },
  { id:'trends',   icon:'📈', label:'Xu hướng',    href:'dash-trends.html'  },
  { id:'surveys',  icon:'📋', label:'Khảo sát HS', href:'dash-surveys.html' },
  { id:'manage',   icon:'⚙️', label:'Quản lý HS',  href:'dash-manage.html'  },
  { id:'profile',  icon:'👤', label:'Tài khoản',   href:'profile.html'      },
];

// Nhận activePage từ attribute data-page trên body
// VD: <body data-page="students">
function buildSidebar(activePage) {
  const mount = document.getElementById('sidebar-mount');
  if (!mount) return;

  // Nếu activePage không truyền, tự detect từ URL
  if (!activePage) {
    const page = location.pathname.split('/').pop().replace('.html','');
    activePage = page.replace('dash-','');
  }

  const navHtml = SIDEBAR_PAGES.map(p => `
    <a class="sn ${p.id === activePage ? 'active' : ''}" href="${p.href}">
      <span>${p.icon}</span> ${p.label}
      ${p.badge ? `<span class="sbadge" id="alertBadge"></span>` : ''}
    </a>
  `).join('');

  mount.innerHTML = `
    <aside class="sidebar">
      <div class="sb-logo">🧠 MoodTok</div>
      <nav class="sb-nav">${navHtml}</nav>
      <div class="sb-foot">
        <div class="sb-user">
          <div class="sb-av">👨‍🏫</div>
          <div>
            <div class="sb-name" id="sidebarName">Giáo viên</div>
            <div class="sb-role">Cán bộ tư vấn</div>
          </div>
        </div>
        <button class="btn-logout-sb" onclick="logout()">Đăng xuất</button>
      </div>
    </aside>`;
}

// Chạy ngay khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', async () => {
  // Auth check
  const user = requireAuth('teacher');
  if (!user) return;

  // Build sidebar ngay
  buildSidebar();

  // Điền tên
  const sbName = document.getElementById('sidebarName');
  if (sbName) sbName.textContent = user.name;

  // Ngày tháng
  const dashDate = document.getElementById('dashDate');
  if (dashDate) dashDate.textContent = new Date().toLocaleDateString('vi-VN', {
    weekday:'long', year:'numeric', month:'long', day:'numeric'
  });

  // Badge cảnh báo
  try {
    const ov = await api('GET', '/api/dashboard/overview');
    const badge = document.getElementById('alertBadge');
    if (badge) badge.textContent = ov.alertsToday > 0 ? ov.alertsToday : '';
  } catch {}
});
