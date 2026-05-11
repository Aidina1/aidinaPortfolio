const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const load = (k, d) => {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : d;
  } catch {
    return d;
  }
};


let pinBuffer = '';
const DEFAULT_PIN = '1234';

function getPin() {
  return load('hm_pin', DEFAULT_PIN);
}

function pinInput(d) {
  if (pinBuffer.length >= 4) return;
  pinBuffer += d;
  updateDots();
  if (pinBuffer.length === 4) setTimeout(checkPin, 200);
}

function pinDel() {
  pinBuffer = pinBuffer.slice(0, -1);
  updateDots();
}

function pinClear() {
  pinBuffer = '';
  updateDots();
  document.getElementById('pin-error').textContent = '';
}

function updateDots() {
  for (let i = 0; i < 4; i++) {
    document.getElementById('d' + i).classList.toggle('filled', i < pinBuffer.length);
  }
}

function checkPin() {
  if (pinBuffer === getPin()) {
    const seenDisclaimer = load('hm_disclaimer', false);
    showScreen(seenDisclaimer ? 'screen-menu' : 'screen-disclaimer');
    pinBuffer = '';
    updateDots();
  } else {
    document.getElementById('pin-error').textContent = 'Incorrect PIN. Try again.';
    pinBuffer = '';
    updateDots();
  }
}

function changePin() {
  const np = prompt('Enter new 4-digit PIN:');
  if (np && /^\d{4}$/.test(np)) {
    save('hm_pin', np);
    toast('PIN updated');
  } else if (np) {
    alert('PIN must be exactly 4 digits.');
  }
}

function lockApp() {
  showScreen('screen-lock');
  pinBuffer = '';
  updateDots();
}


function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');

  if (id === 'screen-disclaimer') save('hm_disclaimer', true);
  if (id === 'screen-add')        buildAddFields();
  if (id === 'screen-history')    renderHistory();
  if (id === 'screen-analyze')    renderChart();
  if (id === 'screen-advice')     renderGauge();
  if (id === 'screen-profile')    loadProfile();
}


function saveProfile() {
  const p = {
    name: document.getElementById('p-name').value.trim(),
    dob:  document.getElementById('p-dob').value,
    hcn:  document.getElementById('p-hcn').value.trim(),
    ind:  document.getElementById('p-indicator').value
  };
  if (!p.name) {
    alert('Please enter your name.');
    return;
  }
  save('hm_profile', p);
  toast('Profile saved!');
}

function loadProfile() {
  const p = load('hm_profile', {});
  if (p.name) document.getElementById('p-name').value = p.name;
  if (p.dob)  document.getElementById('p-dob').value  = p.dob;
  if (p.hcn)  document.getElementById('p-hcn').value  = p.hcn;
  if (p.ind)  document.getElementById('p-indicator').value = p.ind;
}


function getIndicator() {
  return (load('hm_profile', {}).ind) || 'hr';
}

const INDICATORS = {
  bp: {
    label: 'Blood Pressure',
    fields: [
      { id: 'sys', label: 'Systolic (mmHg)',  type: 'number', min: 60,  max: 220 },
      { id: 'dia', label: 'Diastolic (mmHg)', type: 'number', min: 40,  max: 140 }
    ]
  },
  glucose: {
    label: 'Blood Glucose',
    fields: [
      { id: 'glu', label: 'Glucose (mmol/L)', type: 'number', min: 2,   max: 30  }
    ]
  },
  hr: {
    label: 'Heart Rate',
    fields: [
      { id: 'hr',  label: 'Heart Rate (bpm)', type: 'number', min: 30,  max: 220 }
    ]
  }
};

function buildAddFields() {
  const ind  = getIndicator();
  const cfg  = INDICATORS[ind];
  const wrap = document.getElementById('add-fields');

  wrap.innerHTML = cfg.fields.map(f =>
    `<div class="form-group">
       <label>${f.label}</label>
       <input id="rf-${f.id}" type="${f.type}" min="${f.min}" max="${f.max}" placeholder="${f.label}">
     </div>`
  ).join('');

  document.getElementById('r-date').valueAsDate = new Date();
}

function saveRecord() {
  const ind = getIndicator();
  const cfg = INDICATORS[ind];
  const rec = {
    date:  document.getElementById('r-date').value,
    ind,
    notes: document.getElementById('r-notes').value
  };

  let valid = true;
  cfg.fields.forEach(f => {
    const v = parseFloat(document.getElementById('rf-' + f.id).value);
    if (isNaN(v) || v < f.min || v > f.max) {
      alert(`${f.label}: enter a value between ${f.min} and ${f.max}.`);
      valid = false;
    } else {
      rec[f.id] = v;
    }
  });

  if (!valid) return;

  const recs = load('hm_records', []);
  recs.push(rec);
  save('hm_records', recs);
  toast('Record saved!');
  showScreen('screen-menu');
}


function renderHistory() {
  const recs   = load('hm_records', []);
  const order  = document.getElementById('sort-select').value;
  const sorted = [...recs].sort((a, b) =>
    order === 'asc'
      ? a.date.localeCompare(b.date)
      : b.date.localeCompare(a.date)
  );

  const wrap = document.getElementById('history-table-wrap');

  if (!sorted.length) {
    wrap.innerHTML = '<p style="padding:1rem;color:var(--muted)">No records yet.</p>';
    return;
  }

  const ind  = sorted[0].ind;
  const cols = ind === 'bp'
    ? ['Date', 'Systolic', 'Diastolic', 'Notes', '']
    : ind === 'glucose'
      ? ['Date', 'Glucose (mmol/L)', 'Notes', '']
      : ['Date', 'Heart Rate (bpm)', 'Notes', ''];

  const rows = sorted.map(r => {
    const origIdx = recs.indexOf(r);
    const vals = r.ind === 'bp'
      ? `<td>${r.sys}</td><td>${r.dia}</td>`
      : r.ind === 'glucose'
        ? `<td>${r.glu}</td>`
        : `<td>${r.hr}</td>`;

    return `<tr>
      <td>${r.date}</td>
      ${vals}
      <td>${r.notes || '—'}</td>
      <td><button class="btn btn-danger btn-sm" onclick="deleteRecord(${origIdx})">✕</button></td>
    </tr>`;
  }).join('');

  wrap.innerHTML = `
    <table>
      <thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function deleteRecord(i) {
  const recs = load('hm_records', []);
  recs.splice(i, 1);
  save('hm_records', recs);
  renderHistory();
  toast('Record deleted.');
}

function clearHistory() {
  if (!confirm('Delete ALL records? This cannot be undone.')) return;
  save('hm_records', []);
  renderHistory();
  toast('History cleared.');
}


function renderChart() {
  const ind  = getIndicator();
  const recs = load('hm_records', [])
    .filter(r => r.ind === ind)
    .sort((a, b) => a.date.localeCompare(b.date));

  const cvs = document.getElementById('chart-canvas');
  cvs.width = Math.min(window.innerWidth - 48, 640);

  const ctx = cvs.getContext('2d');
  ctx.clearRect(0, 0, cvs.width, cvs.height);

  const W   = cvs.width;
  const H   = cvs.height;
  const PAD = { t: 24, r: 20, b: 40, l: 50 };
  const dw  = W - PAD.l - PAD.r;
  const dh  = H - PAD.t - PAD.b;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#dde2e8';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, W, H);

  if (!recs.length) {
    ctx.fillStyle = '#888';
    ctx.textAlign = 'center';
    ctx.font = '14px Segoe UI';
    ctx.fillText('No records to display.', W / 2, H / 2);
    return;
  }

  const getVal = r =>
    r.ind === 'bp' ? r.sys : r.ind === 'glucose' ? r.glu : r.hr;

  const vals = recs.map(getVal);
  const minV = Math.min(...vals) * 0.92;
  const maxV = Math.max(...vals) * 1.08;
  const xStep = recs.length > 1 ? dw / (recs.length - 1) : dw / 2;

  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = PAD.t + dh - i * (dh / 4);
    ctx.strokeStyle = '#e8ecf0';
    ctx.beginPath();
    ctx.moveTo(PAD.l, y);
    ctx.lineTo(PAD.l + dw, y);
    ctx.stroke();

    ctx.fillStyle = '#888';
    ctx.font = '11px Segoe UI';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(minV + (maxV - minV) * (i / 4)), PAD.l - 6, y + 4);
  }

  ctx.fillStyle = '#888';
  ctx.font = '10px Segoe UI';
  ctx.textAlign = 'center';
  recs.forEach((r, i) => {
    const x = PAD.l + (recs.length > 1 ? i * xStep : dw / 2);
    ctx.fillText(r.date.slice(5), x, H - PAD.b + 14);
  });

  const px = (_, i) => PAD.l + (recs.length > 1 ? i * xStep : dw / 2);
  const py = v => PAD.t + dh - ((v - minV) / (maxV - minV)) * dh;

  ctx.beginPath();
  ctx.strokeStyle = '#4a7fa5';
  ctx.lineWidth = 2.5;
  recs.forEach((r, i) => {
    const x = px(0, i);
    const y = py(getVal(r));
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.stroke();

  recs.forEach((r, i) => {
    ctx.beginPath();
    ctx.arc(px(0, i), py(getVal(r)), 4, 0, Math.PI * 2);
    ctx.fillStyle = '#4a7fa5';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(px(0, i), py(getVal(r)), 2, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
  });

  ctx.fillStyle = '#2d3e50';
  ctx.font = 'bold 13px Segoe UI';
  ctx.textAlign = 'left';
  ctx.fillText(INDICATORS[ind].label, PAD.l, PAD.t - 6);
}


function renderGauge() {
  const ind  = getIndicator();
  const recs = load('hm_records', []).filter(r => r.ind === ind);

  const cvs = document.getElementById('gauge-canvas');
  cvs.width = Math.min(window.innerWidth - 48, 320);

  const ctx = cvs.getContext('2d');
  ctx.clearRect(0, 0, cvs.width, cvs.height);

  const W  = cvs.width;
  const CX = W / 2;
  const CY = 155;
  const R  = Math.min(W * 0.38, 120);

  const zones = [
    { color: '#2ecc71', from: Math.PI,                         to: Math.PI + Math.PI / 3 },
    { color: '#f1c40f', from: Math.PI + Math.PI / 3,           to: Math.PI + 2 * Math.PI / 3 },
    { color: '#e74c3c', from: Math.PI + 2 * Math.PI / 3,       to: 2 * Math.PI }
  ];

  zones.forEach(z => {
    ctx.beginPath();
    ctx.moveTo(CX, CY);
    ctx.arc(CX, CY, R, z.from, z.to);
    ctx.fillStyle = z.color + '33';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(CX, CY, R, z.from, z.to);
    ctx.strokeStyle = z.color;
    ctx.lineWidth = 14;
    ctx.stroke();
  });

  let ratio = 0.5;
  let label  = '—';
  let advice = 'No records yet.';
  let cls    = 'advice-yellow';

  if (recs.length) {
    const last = recs[recs.length - 1];

    if (ind === 'hr') {
      const v = last.hr;
      label = v + ' bpm';
      ratio = Math.min(Math.max((v - 30) / 190, 0), 1);

      if (v < 60 || v > 100) {
        advice = '⚠️ Heart rate outside normal range (60–100 bpm). Consider consulting a healthcare provider.';
        cls = 'advice-red';
      } else if (v >= 60 && v <= 80) {
        advice = '✅ Heart rate is in the normal/optimal range.';
        cls = 'advice-green';
      } else {
        advice = '🟡 Heart rate is normal but slightly elevated. Monitor regularly.';
        cls = 'advice-yellow';
      }

    } else if (ind === 'glucose') {
      const v = last.glu;
      label = v + ' mmol/L';
      ratio = Math.min(Math.max((v - 2) / 18, 0), 1);

      if (v < 4 || v > 7.8) {
        advice = '⚠️ Glucose level outside normal fasting range. Please consult your doctor.';
        cls = 'advice-red';
      } else if (v >= 4 && v <= 5.6) {
        advice = '✅ Blood glucose is in the normal fasting range.';
        cls = 'advice-green';
      } else {
        advice = '🟡 Glucose slightly elevated. Monitor diet and follow up with your healthcare provider.';
        cls = 'advice-yellow';
      }

    } else {
      const v = last.sys;
      label = v + '/' + last.dia + ' mmHg';
      ratio = Math.min(Math.max((v - 60) / 160, 0), 1);

      if (v < 90 || v > 130) {
        advice = '⚠️ Blood pressure outside normal range. Seek medical advice.';
        cls = 'advice-red';
      } else if (v >= 90 && v <= 120) {
        advice = '✅ Blood pressure is in the normal range.';
        cls = 'advice-green';
      } else {
        advice = '🟡 Slightly elevated. Reduce sodium intake and monitor regularly.';
        cls = 'advice-yellow';
      }
    }
  }

  const angle = Math.PI + ratio * Math.PI;
  ctx.beginPath();
  ctx.moveTo(CX, CY);
  ctx.lineTo(CX + Math.cos(angle) * (R - 18), CY + Math.sin(angle) * (R - 18));
  ctx.strokeStyle = '#2d3e50';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(CX, CY, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#2d3e50';
  ctx.fill();

  document.getElementById('gauge-val').textContent = label;
  const adv = document.getElementById('advice-text');
  adv.textContent = advice;
  adv.className = cls;
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}