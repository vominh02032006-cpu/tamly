/* ===== survey.js ===== */

const WHO5_QUESTIONS = [
  'Tôi cảm thấy vui vẻ và tinh thần thoải mái',
  'Tôi cảm thấy bình tĩnh và thư giãn',
  'Tôi cảm thấy tích cực và năng động',
  'Tôi ngủ ngon giấc và cảm thấy sảng khoái sau khi thức dậy',
  'Cuộc sống hằng ngày của tôi chứa đựng nhiều điều thú vị'
];

const WHO5_OPTS = ['0 – Không bao giờ', '1', '2', '3', '4', '5 – Luôn luôn'];

const PSS_QUESTIONS = [
  'Bạn có thường cảm thấy bị quá tải bởi những điều xảy ra ngoài tầm kiểm soát?',
  'Bạn có thường cảm thấy khó khăn trong việc kiểm soát những vấn đề quan trọng trong cuộc sống?',
  'Bạn có thường cảm thấy căng thẳng và lo âu?',
  'Bạn có thường xuyên cảm thấy mọi thứ đang chồng chất quá nhiều?',
  'Bạn có thể tự điều phối mọi thứ trong cuộc sống (câu hỏi chiều ngược)? ',
  'Bạn có thường xuyên cảm thấy mình kiểm soát được mọi thứ (chiều ngược)?',
  'Bạn có thể quản lý được sự tức giận và khó chịu của mình (chiều ngược)?',
  'Bạn có thường cảm thấy căng thẳng đến mức không thể tập trung?',
  'Bạn có thường lo lắng về những điều mà mình không thể kiểm soát?',
  'Bạn có cảm thấy bản thân đang bị chùng xuống bởi những khó khăn?'
];

const PSS_OPTS = ['0 – Không bao giờ', '1', '2', '3', '4 – Rất thường xuyên'];

let who5Answers = new Array(WHO5_QUESTIONS.length).fill(null);
let pssAnswers = new Array(PSS_QUESTIONS.length).fill(null);

document.addEventListener('DOMContentLoaded', function() {
  requireAuth();
  renderWHO5();
  renderPSS();
});

function renderWHO5() {
  const container = document.getElementById('who5-questions');
  if (!container) return;

  container.innerHTML = WHO5_QUESTIONS.map((q, qi) => `
    <div class="survey-q" id="who5-q-${qi}">
      <div class="survey-q-text">${qi + 1}. ${q}</div>
      <div class="survey-q-options">
        ${WHO5_OPTS.map((opt, oi) => `
          <div class="survey-q-opt" onclick="selectWHO5(${qi}, ${oi})" id="who5-${qi}-${oi}">
            ${opt}
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function renderPSS() {
  const container = document.getElementById('pss-questions');
  if (!container) return;

  container.innerHTML = PSS_QUESTIONS.map((q, qi) => `
    <div class="survey-q" id="pss-q-${qi}">
      <div class="survey-q-text">${qi + 1}. ${q}</div>
      <div class="survey-q-options">
        ${PSS_OPTS.map((opt, oi) => `
          <div class="survey-q-opt" onclick="selectPSS(${qi}, ${oi})" id="pss-${qi}-${oi}">
            ${opt}
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function selectWHO5(qi, val) {
  who5Answers[qi] = val;
  // Update UI
  for (let i = 0; i < WHO5_OPTS.length; i++) {
    const el = document.getElementById(`who5-${qi}-${i}`);
    if (el) el.classList.toggle('selected', i === val);
  }
  checkWHO5Complete();
}

function selectPSS(qi, val) {
  pssAnswers[qi] = val;
  for (let i = 0; i < PSS_OPTS.length; i++) {
    const el = document.getElementById(`pss-${qi}-${i}`);
    if (el) el.classList.toggle('selected', i === val);
  }
  checkPSSComplete();
}

function checkWHO5Complete() {
  const complete = who5Answers.every(a => a !== null);
  const btn = document.getElementById('who5-next');
  if (btn) btn.disabled = !complete;
}

function checkPSSComplete() {
  const complete = pssAnswers.every(a => a !== null);
  const btn = document.getElementById('pss-next');
  if (btn) btn.disabled = !complete;
}

function goSurvey(panel) {
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(panel + '-panel');
  if (target) target.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function submitSurvey() {
  // Calculate WHO-5 score (0-25, multiply by 4 = 0-100)
  const who5Raw = who5Answers.reduce((sum, a) => sum + (a || 0), 0);
  const who5Score = who5Raw * 4; // 0-100

  // Calculate PSS score (items 5,6,7 are reversed for PSS-10)
  const reversedItems = [4, 5, 6]; // 0-indexed
  let pssScore = 0;
  pssAnswers.forEach((a, i) => {
    if (reversedItems.includes(i)) {
      pssScore += (4 - (a || 0));
    } else {
      pssScore += (a || 0);
    }
  });

  // Save
  const surveyResult = {
    date: new Date().toISOString(),
    who5Raw, who5Score, pssScore
  };
  localStorage.setItem('moodtok_survey', JSON.stringify(surveyResult));

  renderSurveyResults(who5Score, pssScore);
  goSurvey('result');
}

function renderSurveyResults(who5Score, pssScore) {
  const el = document.getElementById('surveyResults');
  if (!el) return;

  // WHO-5 interpretation
  let who5Class, who5Label, who5Desc;
  if (who5Score >= 68) {
    who5Class = 'good'; who5Label = 'Tốt';
    who5Desc = 'Điểm WHO-5 của bạn cho thấy bạn đang có trạng thái tinh thần tốt. Tiếp tục duy trì các thói quen lành mạnh nhé!';
  } else if (who5Score >= 52) {
    who5Class = 'mid'; who5Label = 'Trung bình';
    who5Desc = 'Điểm WHO-5 ở mức trung bình. Theo WHO, điểm dưới 52 có thể cần được chú ý thêm.';
  } else {
    who5Class = 'bad'; who5Label = 'Cần chú ý';
    who5Desc = 'Điểm WHO-5 thấp hơn ngưỡng khuyến cáo (<52). Nên trao đổi với cán bộ tư vấn học đường.';
  }

  // PSS interpretation (PSS-10: 0-40)
  let pssClass, pssLabel, pssDesc;
  if (pssScore <= 13) {
    pssClass = 'good'; pssLabel = 'Thấp';
    pssDesc = 'Mức stress của bạn ở mức thấp. Bạn đang quản lý tốt các căng thẳng trong cuộc sống.';
  } else if (pssScore <= 26) {
    pssClass = 'mid'; pssLabel = 'Trung bình';
    pssDesc = 'Mức stress ở mức trung bình. Hãy chú ý đến việc nghỉ ngơi và thư giãn đầy đủ.';
  } else {
    pssClass = 'bad'; pssLabel = 'Cao';
    pssDesc = 'Mức stress ở mức cao. Bạn nên trao đổi với giáo viên tư vấn hoặc người thân để được hỗ trợ.';
  }

  el.innerHTML = `
    <div class="survey-result-card">
      <div class="survey-result-title">🌿 WHO-5 Well-being Index</div>
      <div class="survey-result-score ${who5Class}">${who5Score}/100 – ${who5Label}</div>
      <div style="height:8px;background:#e5e7eb;border-radius:99px;margin-bottom:8px;overflow:hidden;">
        <div style="height:100%;width:${who5Score}%;background:${who5Class === 'good' ? '#22c55e' : who5Class === 'mid' ? '#f59e0b' : '#ef4444'};border-radius:99px;transition:width 1s ease;"></div>
      </div>
      <div class="survey-result-desc">${who5Desc}</div>
    </div>

    <div class="survey-result-card">
      <div class="survey-result-title">🧘 Perceived Stress Scale (PSS-10)</div>
      <div class="survey-result-score ${pssClass}">${pssScore}/40 – Stress ${pssLabel}</div>
      <div style="height:8px;background:#e5e7eb;border-radius:99px;margin-bottom:8px;overflow:hidden;">
        <div style="height:100%;width:${(pssScore/40)*100}%;background:${pssClass === 'good' ? '#22c55e' : pssClass === 'mid' ? '#f59e0b' : '#ef4444'};border-radius:99px;transition:width 1s ease;"></div>
      </div>
      <div class="survey-result-desc">${pssDesc}</div>
    </div>
  `;
}
