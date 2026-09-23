const state = { employeeId: null, profile: null, view: 'home', staticData: null };
const $ = (selector) => document.querySelector(selector);

async function request(url, options) {
  try {
    const response = await fetch(url, options);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Не удалось выполнить запрос');
    return payload;
  } catch (error) {
    if (!url.startsWith('/api/')) throw error;
    if (!state.staticData) state.staticData = await (await fetch('/data.json')).json();
    const match = url.match(/^\/api\/employees\/([^/]+)/);
    if (url === '/api/employees') return { employees: state.staticData.employees };
    if (url === '/api/hr/overview') return state.staticData.hr_overview;
    if (!match) throw error;
    const profile = JSON.parse(JSON.stringify(state.staticData.profiles[match[1]]));
    if (options?.method === 'POST') profile.recommendations = profile.recommendations.filter((item) => item.event_id !== JSON.parse(options.body).event_id);
    return profile;
  }
}

function showError(error) { const box = $('#error'); box.textContent = error.message || String(error); box.hidden = false; }

function renderEmployee() {
  const p = state.profile; const person = p.employee; const t = p.trajectory; const game = p.gamification || { coins_balance: 1280, weekly_coins: 120, streak_days: 3 };
  $('#loading').hidden = true; $('#employee-home').hidden = false; $('#hr-overview').hidden = true;
  const tasks = p.recommendations.slice(0, 3).map((item) => `<article class="task-card"><div class="task-type">${item.type} · ${item.duration_hours} ч</div><h3>${item.title}</h3><p>${item.reasons[0] || item.description}</p><div class="task-footer"><span class="task-reward">+${item.reward_coins || 60} Coins</span><button class="small-button complete" data-event="${item.event_id}">Начать</button></div></article>`).join('');
  $('#employee-home').innerHTML = `<div class="greeting"><div><div class="muted">Добрый день</div><h1>${person.full_name.split(' ')[0]} 👋</h1></div><div class="avatar">${person.full_name.slice(0, 1)}</div></div>
    <section class="balance-card"><div><span class="card-label">Мои Coins</span><strong>${game.coins_balance.toLocaleString('ru-RU')}</strong><span class="card-note">+${game.weekly_coins} за эту неделю · серия ${game.streak_days} дн.</span></div><div class="coin">●</div></section>
    <section class="career-card"><div class="section-head"><div><div class="muted">Карьерный маршрут</div><h2>${person.role}</h2></div><span class="level-pill">${person.grade}</span></div><div class="route-line"><span class="route-dot done"></span><span class="route-label">${person.grade}</span><span class="route-connector"></span><span class="route-dot current"></span><span class="route-label">${t.target_grade}</span></div><div class="progress-track"><div class="progress-fill" style="width:${t.progress_pct}%"></div></div><div class="progress-caption"><span>${t.progress_pct}% пути пройдено</span><span>Следующий уровень</span></div></section>
    <div class="section-head tasks-head"><h2>Рекомендуемые шаги</h2><button class="link-button" data-view="development">Все</button></div><div class="task-list">${tasks || '<div class="empty-card">Новых заданий пока нет</div>'}</div>
    <section class="achievements"><div class="section-head"><h2>Мои достижения</h2><span class="muted">${(game.achievements || []).length}</span></div><div class="achievement-list">${(game.achievements || []).map((item) => `<span class="achievement">✦ ${item}</span>`).join('')}</div></section>
    <section class="next-role"><div class="muted">Возможность роста</div><h2>Развитие в смежной области</h2><p>Система видит направления, где ваши навыки уже близки к следующему уровню.</p><button class="outline-button" data-view="development">Посмотреть варианты</button></section>`;
  document.querySelectorAll('.complete').forEach((button) => button.addEventListener('click', () => completeActivity(button.dataset.event, button)));
  document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
}

function renderHr(payload) {
  $('#loading').hidden = true; $('#employee-home').hidden = true; $('#hr-overview').hidden = false;
  $('#hr-overview').innerHTML = `<div class="hr-head"><div><div class="muted">Рабочий контур HR</div><h1>Развитие команды</h1></div><button id="back-employee" class="outline-button">К сотруднику</button></div><div class="metric-grid"><div class="metric"><span>Сотрудники</span><strong>${payload.summary.employees}</strong></div><div class="metric"><span>Средний прогресс</span><strong>${payload.summary.average_progress_pct}%</strong></div><div class="metric"><span>Критические разрывы</span><strong>${payload.summary.employees_with_critical_gaps}</strong></div></div><section class="white-card"><div class="section-head"><h2>Фокус внимания</h2><span class="muted">по каждому сотруднику</span></div>${payload.at_risk.map((row) => `<div class="hr-row"><div><strong>${row.full_name}</strong><span>${row.department} · ${row.role}</span></div><b>${row.progress_pct}%</b></div>`).join('')}</section>`;
  $('#back-employee').addEventListener('click', () => setView('home'));
}

async function completeActivity(eventId, button) { button.disabled = true; try { state.profile = await request(`/api/employees/${state.employeeId}/activities/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_id: eventId }) }); renderEmployee(); } catch (error) { showError(error); button.disabled = false; } }

function setView(view) { state.view = view; document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === view)); if (view === 'home' || view === 'development') renderEmployee(); else if (view === 'coins') { renderEmployee(); document.querySelector('.balance-card').scrollIntoView({ behavior: 'smooth' }); } else { renderEmployee(); document.querySelector('.greeting').scrollIntoView({ behavior: 'smooth' }); } }

async function login() { const code = $('#employee-code').value.trim().toUpperCase(); try { const data = await request('/api/employees'); if (!data.employees.some((item) => item.employee_id === code)) throw new Error('Проверьте код сотрудника'); state.employeeId = code; state.profile = await request(`/api/employees/${code}`); $('#login').hidden = true; $('#app').hidden = false; renderEmployee(); } catch (error) { showError(error); } }

$('#login-button').addEventListener('click', login); $('#employee-code').addEventListener('keydown', (event) => { if (event.key === 'Enter') login(); }); document.querySelectorAll('.nav-item').forEach((item) => item.addEventListener('click', () => setView(item.dataset.view)));
