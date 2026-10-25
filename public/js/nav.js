/* ===== nav.js – Smart navbar cho trang landing ===== */
(function () {
  const tok  = localStorage.getItem('mt_token');
  const user = (() => { try { return JSON.parse(localStorage.getItem('mt_user')); } catch { return null; } })();
  const isLoggedIn = tok && user;

  const navRight = document.getElementById('nav-right');
  if (!navRight) return;

  if (isLoggedIn) {
    const dest = user.role === 'teacher' ? 'dashboard.html' : 'checkin.html';
    navRight.innerHTML = `
      <a href="${dest}" class="btn-nav" style="background:#22c55e">
        ${user.role === 'teacher' ? '🏫' : '✅'} Vào ứng dụng
      </a>
      <button onclick="logoutLanding()" class="btn-nav" style="background:#ef4444; margin-left:8px; border:none; cursor:pointer; font-family:'Be Vietnam Pro',sans-serif">
        Đăng xuất
      </button>
    `;
    // Cũng cập nhật hero button nếu có
    const heroBtn = document.getElementById('hero-cta');
    if (heroBtn) {
      heroBtn.href = dest;
      heroBtn.textContent = (user.role === 'teacher' ? '🏫 Vào Dashboard' : '✅ Check-in ngay') + ' →';
    }
  } else {
    navRight.innerHTML = `<a href="login.html" class="btn-nav">Đăng nhập</a>`;
  }
})();

function logoutLanding() {
  localStorage.removeItem('mt_token');
  localStorage.removeItem('mt_user');
  window.location.reload();
}
