(() => {
  // --- CONFIGURATION ---
  const scriptURL = 'https://script.google.com/macros/s/AKfycbwEs2oHCnS6ra6b79Lo02vWKxjoEd7e8a0QcXtRpRS5ze0Ws0yQG683UarCtR5DKGLb/exec';

  // DOM Elements
  const qText = document.getElementById('qText'), optionsEl = document.getElementById('options');
  const paginationEl = document.getElementById('pagination'), timerEl = document.getElementById('timer');
  const examArea = document.getElementById('examArea'), resultArea = document.getElementById('resultArea');
  const minsInput = document.getElementById('mins'), startBtn = document.getElementById('startBtn');
  const answerKey = document.getElementById('answerKey');

  let questions = [], currentIndex = 0, answers = [], started = false, timer = null, remainingSeconds = 0;

  // 1. Loading Spinner Logic
  function showSpinner(show) {
    let spinner = document.getElementById('exam-spinner');
    if (!spinner) {
      spinner = document.createElement('div');
      spinner.id = 'exam-spinner';
      spinner.innerHTML = `
        <div class="spinner-overlay">
          <div class="loader"></div>
          <p>Securing your results, please wait...</p>
        </div>`;
      document.body.appendChild(spinner);
    }
    spinner.style.display = show ? 'flex' : 'none';
  }

  async function loadQuestions() {
    try {
      const response = await fetch('questions.json');
      if (!response.ok) throw new Error("File not found");
      return await response.json();
    } catch (err) {
      const embedded = document.getElementById('sample-questions').textContent;
      return JSON.parse(embedded);
    }
  }

  async function init() {
    const name = localStorage.getItem('candidateName') || "Guest Candidate";
    const num = localStorage.getItem('examNumber') || "000";
    document.getElementById('candidateHeader').innerHTML = `Candidate: <strong>${name}</strong> | ID: <strong>${num}</strong>`;
    questions = await loadQuestions();
    answers = Array(questions.length).fill(null);
    buildPagination();
    updateTimerDisplay(parseInt(minsInput.value) * 60);
  }

  function buildPagination() {
    paginationEl.innerHTML = '';
    questions.forEach((_, i) => {
      const btn = document.createElement('button');
      btn.className = 'page-btn unanswered';
      btn.textContent = i + 1;
      btn.onclick = () => { if(started) renderQuestion(i); };
      paginationEl.appendChild(btn);
    });
  }

  function renderQuestion(index) {
    currentIndex = index;
    const q = questions[index];
    qText.innerText = `Q${index + 1}. ${q.question}`;
    optionsEl.innerHTML = '';
    q.choices.forEach((choice, idx) => {
      const opt = document.createElement('div');
      opt.className = `option ${answers[index] === idx ? 'selected' : ''}`;
      opt.innerHTML = `<strong>${String.fromCharCode(65+idx)}.</strong> ${choice}`;
      opt.onclick = () => {
        answers[index] = idx;
        renderQuestion(index);
        updateUI();
      };
      optionsEl.appendChild(opt);
    });
    updateUI();
  }

  function updateUI() {
    const nodes = Array.from(paginationEl.children);
    nodes.forEach((btn, i) => {
      btn.classList.toggle('current', i === currentIndex);
      btn.classList.toggle('answered', answers[i] !== null);
      btn.classList.toggle('unanswered', answers[i] === null);
    });
    const count = answers.filter(a => a !== null).length;
    document.getElementById('progressInfo').innerText = `Answered ${count} of ${questions.length}`;
  }

  function startTimer(duration) {
    remainingSeconds = duration;
    timer = setInterval(() => {
      remainingSeconds--;
      updateTimerDisplay(remainingSeconds);
      if (remainingSeconds <= 0) { clearInterval(timer); endExam(); }
    }, 1000);
  }

  function updateTimerDisplay(sec) {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    const timeStr = `${m}:${s}`;
    timerEl.innerText = timeStr;
    if(document.getElementById('timerAside')) document.getElementById('timerAside').innerText = timeStr;
    if (sec < 300) timerEl.classList.add('red');
  }

  // --- ENHANCED END EXAM WITH GOOGLE SHEETS & SPINNER ---
  async function endExam() {
    started = false;
    clearInterval(timer);
    
    showSpinner(true); // START SPINNER

    // Data Preparation
    const name = localStorage.getItem('candidateName');
    const num = localStorage.getItem('examNumber');
    let correct = 0;
    questions.forEach((q, i) => { if (answers[i] === q.answerIndex) correct++; });
    
    const examData = {
      timestamp: new Date().toLocaleString(),
      name: name,
      examNumber: num,
      score: `${correct} / ${questions.length}`,
      percent: Math.round((correct/questions.length)*100) + "%",
      timeLeft: timerEl.innerText
    };

    // Send to Google Sheets
    try {
      await fetch(scriptURL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(examData)
      });
    } catch (e) {
      console.error("Sheet Sync Failed", e);
    }

    // Original UI Display Logic
    showSpinner(false); // STOP SPINNER
    examArea.classList.add('hidden');
    resultArea.classList.remove('hidden');

    document.getElementById('resName').innerText = name;
    document.getElementById('resNum').innerText = num;
    answerKey.innerHTML = ''; 

    questions.forEach((q, i) => {
      const isCorrect = (answers[i] === q.answerIndex);
      const row = document.createElement('div');
      row.className = 'result-row';
      row.innerHTML = `
        <p><strong>Q${i+1}: ${q.question}</strong></p>
        <p class="small">Your answer: <span style="color:${isCorrect?'green':'red'}">${answers[i] !== null ? q.choices[answers[i]] : 'No Answer'}</span></p>
        <p class="small">Correct: <strong>${q.choices[q.answerIndex]}</strong></p>
        ${q.explanation ? `<p class="small"><em>Note: ${q.explanation}</em></p>` : ''}
        <hr>
      `;
      answerKey.appendChild(row);
    });
    
    document.getElementById('finalScore').innerText = examData.score;
    document.getElementById('scorePercent').innerText = examData.percent;
  }

  startBtn.onclick = () => {
    started = true;
    if(document.getElementById('setupControls')) document.getElementById('setupControls').classList.add('hidden');
    examArea.classList.remove('hidden');
    renderQuestion(0);
    startTimer(parseInt(minsInput.value) * 60);
  };

  document.getElementById('prevBtn').onclick = () => { if(currentIndex > 0) renderQuestion(currentIndex-1); };
  document.getElementById('nextBtn').onclick = () => { if(currentIndex < questions.length-1) renderQuestion(currentIndex+1); };
  document.getElementById('submitBtn').onclick = () => { if(confirm("Submit exam?")) endExam(); };

  init();
})();
