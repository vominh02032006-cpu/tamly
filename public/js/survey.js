/* ===== survey.js ===== */

const WHO5_QS = [
  'Tôi cảm thấy vui vẻ và tinh thần thoải mái',
  'Tôi cảm thấy bình tĩnh và thư giãn',
  'Tôi cảm thấy tích cực và năng động',
  'Tôi ngủ ngon giấc và cảm thấy sảng khoái khi thức dậy',
  'Cuộc sống hằng ngày của tôi chứa đựng nhiều điều thú vị'
];
const PSS_QS = [
  'Bạn cảm thấy bị quá tải bởi những điều ngoài tầm kiểm soát?',
  'Bạn khó kiểm soát những vấn đề quan trọng trong cuộc sống?',
  'Bạn cảm thấy căng thẳng và lo âu?',
  'Bạn cảm thấy mọi thứ đang chồng chất quá nhiều?',
  'Bạn có thể tự điều phối mọi thứ trong cuộc sống? ↩',
  'Bạn cảm thấy mình kiểm soát được mọi thứ? ↩',
  'Bạn quản lý được sự tức giận và khó chịu của mình? ↩',
  'Bạn cảm thấy căng thẳng đến mức không thể tập trung?',
  'Bạn lo lắng về những điều không thể kiểm soát?',
  'Bạn cảm thấy bản thân bị chùng xuống bởi khó khăn?'
];

let who5A = new Array(5).fill(null);
let pssA  = new Array(10).fill(null);

document.addEventListener('DOMContentLoaded', () => {
  requireAuth('student');
  renderQs('who5-questions', WHO5_QS, 6, 'who5', who5A);
  renderQs('pss-questions',  PSS_QS,  5, 'pss',  pssA);
});

function renderQs(containerId, questions, maxOpt, prefix, answers) {
  const el = document.getElementById(containerId);
  if (!el) return;

  // Nhãn cho WHO-5 (0-5)
  const who5Labels = ['Không bao giờ','Hiếm khi','Đôi khi','Khá thường','Thường xuyên','Luôn luôn'];
  // Nhãn cho PSS (0-4)
  const pssLabels  = ['Không bao giờ','Hiếm khi','Đôi khi','Khá thường','Rất thường'];

  el.innerHTML = questions.map((q, qi) => `
    <div class="sq" id="${prefix}-q-${qi}">
      <div class="sq-text">${qi+1}. ${q}</div>
      <div class="sq-opts">
        ${Array.from({length:maxOpt}, (_, oi) => {
          const label = maxOpt === 6 ? who5Labels[oi] : pssLabels[oi];
          return `<div class="sq-opt" onclick="pick('${prefix}',${qi},${oi},${maxOpt})" id="${prefix}-${qi}-${oi}">
            ${oi}<span class="sq-label">${label}</span>
          </div>`;
        }).join('')}
      </div>
    </div>
  `).join('');
}

function pick(prefix, qi, val, maxOpt) {
  for (let i=0;i<maxOpt;i++) {
    document.getElementById(`${prefix}-${qi}-${i}`)?.classList.toggle('sel', i===val);
  }
  if (prefix === 'who5') { who5A[qi]=val; checkDone('who5-btn', who5A); }
  else                   { pssA[qi]=val;  checkDone('pss-btn',  pssA);  }
}

function checkDone(btnId, answers) {
  // Support both naming conventions
  const btn = document.getElementById(btnId) || document.getElementById(btnId.replace('-btn', '-next'));
  if (btn) btn.disabled = answers.some(a => a === null);
}

function goSurvey(panel) {
  document.querySelectorAll('.ci-panel').forEach(p=>p.classList.remove('active'));
  document.getElementById(panel+'-panel')?.classList.add('active');
  window.scrollTo({top:0,behavior:'smooth'});
}

async function submitSurvey() {
  const btn = document.getElementById('pss-btn') || document.getElementById('pss-next');
  if (btn) { btn.disabled=true; btn.textContent='⏳ Đang gửi…'; }

  try {
    const r = await api('POST', '/api/survey', { who5Answers: who5A, pssAnswers: pssA });
    renderResults(r.who5Score, r.pssScore);
    goSurvey('result');
  } catch(e) {
    showToast(e.message, 'error');
    if (btn) { btn.disabled=false; btn.textContent='Gửi kết quả ✅'; }
  }
}

function renderResults(who5, pss) {
  const el = document.getElementById('survey-results');
  if (!el) return;

  let w5cls, w5lbl, w5desc;
  if (who5>=68)      { w5cls='good'; w5lbl='Tốt';        w5desc='Điểm WHO-5 cho thấy bạn đang có trạng thái tinh thần tốt. Tiếp tục duy trì nhé!'; }
  else if (who5>=52) { w5cls='mid';  w5lbl='Trung bình'; w5desc='Điểm WHO-5 ở mức trung bình. Nên chú ý thêm đến các yếu tố chăm sóc bản thân.'; }
  else               { w5cls='bad';  w5lbl='Cần chú ý';  w5desc='Điểm WHO-5 dưới ngưỡng khuyến cáo (<52). Nên trao đổi với cán bộ tư vấn học đường.'; }

  let pcls, plbl, pdesc;
  if (pss<=13)      { pcls='good'; plbl='Thấp';        pdesc='Mức stress thấp. Bạn đang quản lý tốt các căng thẳng trong cuộc sống.'; }
  else if (pss<=26) { pcls='mid';  plbl='Trung bình'; pdesc='Mức stress trung bình. Hãy chú ý đến việc nghỉ ngơi và thư giãn đầy đủ.'; }
  else              { pcls='bad';  plbl='Cao';         pdesc='Mức stress cao. Nên trao đổi với giáo viên tư vấn hoặc người thân để được hỗ trợ.'; }

  el.innerHTML = `
    <div class="sr-card">
      <div class="sr-title">🌿 WHO-5 Well-being Index</div>
      <div class="sr-score ${w5cls}">${who5}/100 – ${w5lbl}</div>
      <div class="sr-bar"><div class="sr-fill" style="width:${who5}%;background:${w5cls==='good'?'#22c55e':w5cls==='mid'?'#f59e0b':'#ef4444'}"></div></div>
      <div class="sr-desc">${w5desc}</div>
    </div>
    <div class="sr-card">
      <div class="sr-title">🧘 Perceived Stress Scale (PSS-10)</div>
      <div class="sr-score ${pcls}">${pss}/40 – Stress ${plbl}</div>
      <div class="sr-bar"><div class="sr-fill" style="width:${(pss/40)*100}%;background:${pcls==='good'?'#22c55e':pcls==='mid'?'#f59e0b':'#ef4444'}"></div></div>
      <div class="sr-desc">${pdesc}</div>
    </div>
  `;
}
