const state = { employees: [], selected: null, view: 'employees', staticData: null };

const $ = (selector) => document.querySelector(selector);

async function request(url, options) {
  try {
    const response = await fetch(url, options);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Не удалось выполнить запрос');
    return payload;
  } catch (error) {
    if (!url.startsWith('/api/')) throw error;
    return staticRequest(url, options);
  }
}

async function loadStaticData() {
  if (!state.staticData) state.staticData = await (await fetch('/data.json')).json();
  return state.staticData;
}

async function staticRequest(url, options = {}) {
  const data = await loadStaticData();
  const employeeMatch = url.match(/^\/api\/employees\/([^/]+)/);
  if (url === '/api/employees') return { employees: data.employees };
  if (url === '/api/hr/overview') return data.hr_overview;
  if (employeeMatch) {
    const employeeId = employeeMatch[1];
    const profile = JSON.parse(JSON.stringify(data.profiles[employeeId]));
    if (options.method === 'POST') {
      const eventId = JSON.parse(options.body || '{}').event_id;
      profile.recommendations = profile.recommendations.filter((item) => item.event_id !== eventId);
      profile.history.unshift({ event_title: 'Активность отмечена в демо-режиме', status: 'completed', date: new Date().toISOString().slice(0, 10) });
    }
    return profile;
  }
  throw new Error('Не удалось выполнить запрос');
}

function showError(error) {
  const box = $('#error');
  box.textContent = error.message || String(error);
  box.hidden = false;
}

function setView(view) {
  state.view = view;
  $('#employee-view').classList.toggle('active', view === 'employees');
  $('#hr-view').classList.toggle('active', view === 'hr');
  $('.sidebar').hidden = view === 'hr';
  $('#profile').hidden = view !== 'employees' || !state.selected;
  $('#hr-overview').hidden = view !== 'hr';
}

function renderHr(payload) {
  const summary = payload.summary;
  $('#loading').hidden = true;
  $('#hr-overview').innerHTML = `<div class="profile-head"><div><div class="kicker">HR-ОБЗОР</div><h1>Состояние развития</h1><div class="subtitle">Объяснимая сводка по карьерным траекториям команды</div></div></div>
    <div class="metric-grid"><div class="metric"><span>Сотрудники</span><strong>${summary.employees}</strong></div><div class="metric"><span>Средний прогресс</span><strong>${summary.average_progress_pct}%</strong></div><div class="metric"><span>Есть критический разрыв</span><strong>${summary.employees_with_critical_gaps}</strong></div></div>
    <div class="grid"><section class="panel"><div class="panel-title"><h2>Фокус внимания</h2><span class="panel-caption">по критическим разрывам</span></div>${payload.at_risk.map((row) => `<div class="risk-row"><div><strong>${row.full_name}</strong><div class="panel-caption">${row.department} · ${row.role}</div></div><div class="risk-progress">${row.progress_pct}%<small>${row.critical_gap_count} крит.</small></div></div>`).join('')}</section>
    <section class="panel"><div class="panel-title"><h2>По подразделениям</h2><span class="panel-caption">средний прогресс</span></div>${payload.departments.map((row) => `<div class="department-row"><span>${row.department}</span><strong>${row.average_progress_pct}%</strong><small>${row.employees} чел. · ${row.critical_gaps} крит. разрывов</small></div>`).join('')}</section></div>`;
}

async function showHr() {
  setView('hr');
  try { renderHr(await request('/api/hr/overview')); }
  catch (error) { showError(error); }
}

function renderEmployees() {
  const query = ($('#search').value || '').toLowerCase();
  $('#employees').innerHTML = state.employees
    .filter((item) => `${item.full_name} ${item.role} ${item.grade}`.toLowerCase().includes(query))
    .map((item) => `<button class="employee ${state.selected === item.employee_id ? 'active' : ''}" data-id="${item.employee_id}">
      <span class="employee-name">${item.full_name}</span>
      <span class="employee-meta">${item.role} · ${item.grade}</span>
    </button>`).join('');
  document.querySelectorAll('.employee').forEach((button) => button.addEventListener('click', () => selectEmployee(button.dataset.id)));
}

function renderProfile(payload) {
  const person = payload.employee;
  const trajectory = payload.trajectory;
  const gaps = payload.gaps;
  $('#loading').hidden = true;
  $('#profile').hidden = false;
  $('#profile').innerHTML = `<div class="profile-head">
    <div><div class="kicker">ПРОФИЛЬ СОТРУДНИКА</div><h1>${person.full_name}</h1>
      <div class="subtitle">${person.role} · ${person.grade} · ${person.department} · ${person.tenure_months} мес. в компании</div></div>
    <div class="goal"><div class="goal-label">Следующая цель</div><div class="goal-value">${trajectory.target_role}<br>${trajectory.target_grade}</div></div>
  </div>
  <div class="grid"><div>
    <section class="panel"><div class="panel-title"><h2>Траектория</h2><span class="panel-caption">${trajectory.progress_pct}% требований цели закрыто</span></div>
      <div class="progress-track"><div class="progress-fill" style="width:${trajectory.progress_pct}%"></div></div>
      <div class="progress-row"><span>${person.grade}</span><strong>${trajectory.target_grade}</strong></div>
      <div class="panel-title"><h2>Зоны развития</h2><span class="panel-caption">${gaps.length} навыков с разрывом</span></div>
      <div class="gap-list">${gaps.slice(0, 8).map((gap) => `<div class="gap-row"><span class="gap-name">${gap.skill_name}${gap.critical ? ' <b>· critical</b>' : ''}</span><span class="gap-value">${gap.current_level} / ${gap.required_level}</span><div class="gap-bar"><span style="width:${Math.min(100, gap.current_level / gap.required_level * 100)}%"></span></div></div>`).join('')}</div>
    </section>
    <section class="panel"><div class="panel-title"><h2>История участия</h2><span class="panel-caption">последние активности</span></div>
      ${payload.history.map((row) => `<div class="history-row"><span>${row.event_title}</span><span class="history-status">${row.status} · ${row.date}</span></div>`).join('') || '<div class="panel-caption">История пока отсутствует</div>'}
    </section>
  </div><div>
    <section class="panel"><div class="panel-title"><h2>Следующие шаги</h2><span class="panel-caption">объяснимый подбор</span></div>
      ${payload.recommendations.map((item) => `<article class="recommendation"><div class="recommendation-head"><div class="recommendation-title">${item.title}</div><div class="recommendation-score">${Math.round(item.score * 100)}%</div></div>
        <div class="recommendation-meta">${item.type} · ${item.format} · ${item.duration_hours} ч</div>
        <div class="reasons">${item.reasons.map((reason) => `<span class="reason">${reason}</span>`).join('')}</div>
        <div class="recommendation-description">${item.description}</div>
        <div style="margin-top:12px"><button class="complete" data-event="${item.event_id}">Отметить выполненным</button></div>
      </article>`).join('') || '<div class="panel-caption">Подходящих следующих шагов не найдено.</div>'}
    </section>
  </div></div>`;
  document.querySelectorAll('.complete').forEach((button) => button.addEventListener('click', () => completeActivity(button.dataset.event, button)));
}

async function selectEmployee(employeeId) {
  state.selected = employeeId;
  renderEmployees();
  $('#error').hidden = true;
  $('#loading').hidden = false;
  $('#profile').hidden = true;
  try { renderProfile(await request(`/api/employees/${employeeId}`)); }
  catch (error) { showError(error); $('#loading').hidden = true; }
}

async function completeActivity(eventId, button) {
  button.disabled = true;
  try { renderProfile(await request(`/api/employees/${state.selected}/activities/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_id: eventId }) })); }
  catch (error) { showError(error); button.disabled = false; }
}

async function init() {
  try {
    state.employees = (await request('/api/employees')).employees;
    renderEmployees();
    $('#search').addEventListener('input', renderEmployees);
    $('#employee-view').addEventListener('click', () => setView('employees'));
    $('#hr-view').addEventListener('click', showHr);
    if (state.employees.length) await selectEmployee('E0002');
  } catch (error) { $('#loading').hidden = true; showError(error); }
}

init();
