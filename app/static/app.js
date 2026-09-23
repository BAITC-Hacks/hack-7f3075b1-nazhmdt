const state = { employeeId: null, profile: null, view: 'home', staticData: null, completedDemo: new Set(), coinsAdjustment: 0 };
const $ = (selector) => document.querySelector(selector);
const demoCourses = [
  { id: 'course-1', type: 'Курс', title: 'Основы системного мышления', detail: '4 модуля · 2 недели', reward: 120 },
  { id: 'course-2', type: 'Тест', title: 'Проверьте знания по продукту', detail: '12 вопросов · 10 минут', reward: 60 },
  { id: 'course-3', type: 'Практика', title: 'Обратная связь коллеге', detail: '1 действие · до пятницы', reward: 40 },
];
const news = [
  ['Новое направление', 'Halyk запускает внутреннюю школу продуктового мышления', 'Сегодня'],
  ['Команда недели', 'Познакомьтесь с командой цифровых каналов', '2 дня назад'],
  ['Возможность', 'Открыты позиции в смежных командах для внутренних переходов', '5 дней назад'],
];
const shop = [
  ['Кофе с руководителем', 'Персональная встреча на 30 минут', 250],
  ['День без встреч', 'Один рабочий день с фокусом', 600],
  ['Мерч Halyk Career', 'Термокружка или блокнот', 900],
];

async function request(url, options) {
  try {
    const response = await fetch(url, options); const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Не удалось выполнить запрос'); return payload;
  } catch (error) {
    if (!url.startsWith('/api/')) throw error;
    if (!state.staticData) state.staticData = await (await fetch('/data.json')).json();
    const match = url.match(/^\/api\/employees\/([^/]+)/);
    if (url === '/api/employees') return { employees: state.staticData.employees };
    if (!match) throw error;
    const profile = JSON.parse(JSON.stringify(state.staticData.profiles[match[1]]));
    if (options?.method === 'POST') profile.recommendations = profile.recommendations.filter((item) => item.event_id !== JSON.parse(options.body).event_id);
    return profile;
  }
}

function showError(error) { const box = $('#error'); box.textContent = error.message || String(error); box.hidden = false; }
function toast(message) { const box = $('#error'); box.textContent = message; box.className = 'toast'; box.hidden = false; setTimeout(() => { box.hidden = true; box.className = 'error'; }, 2600); }
function game() { const base = state.profile.gamification || { coins_balance: 1280, weekly_coins: 120, streak_days: 3, achievements: ['Первый шаг'] }; return { ...base, coins_balance: base.coins_balance + state.coinsAdjustment }; }
function bindActions() {
  document.querySelectorAll('[data-view]').forEach((button) => button.onclick = () => setView(button.dataset.view));
  document.querySelectorAll('[data-action]').forEach((button) => button.onclick = () => handleAction(button.dataset.action, button.dataset.id));
}

function shell(content) { $('#loading').hidden = true; $('#employee-home').hidden = false; $('#hr-overview').hidden = true; $('#employee-home').innerHTML = content; bindActions(); }
function header(title, subtitle = '') { return `<div class="page-heading"><div><div class="muted">Личный кабинет</div><h1>${title}</h1>${subtitle ? `<p>${subtitle}</p>` : ''}</div><div class="avatar">${state.profile.employee.full_name.slice(0, 1)}</div></div>`; }

function renderHome() {
  const p = state.profile; const person = p.employee; const t = p.trajectory; const g = game();
  const task = p.recommendations[0];
  shell(`${header(`Добрый день, ${person.full_name.split(' ')[0]} 👋`, 'Всё важное для вашего развития — в одном месте.')}
    <section class="balance-card"><div><span class="card-label">Мои Coins</span><strong>${g.coins_balance.toLocaleString('ru-RU')}</strong><span class="card-note">+${g.weekly_coins} за эту неделю · серия ${g.streak_days} дн.</span></div><div class="coin">●</div></section>
    <div class="section-head section-gap"><h2>Новости компании</h2><button class="link-button" data-view="profile">Мой профиль</button></div><div class="news-list">${news.map((item, i) => `<button class="news-card" data-action="news" data-id="${i}"><span>${item[0]} · ${item[2]}</span><strong>${item[1]}</strong></button>`).join('')}</div>
    <section class="career-card"><div class="section-head"><div><div class="muted">Ваш карьерный маршрут</div><h2>${person.role}</h2></div><span class="level-pill">${person.grade}</span></div><div class="route-line"><span class="route-dot done"></span><span class="route-label">${person.grade}</span><span class="route-connector"></span><span class="route-dot current"></span><span class="route-label">${t.target_grade}</span></div><div class="progress-track"><div class="progress-fill" style="width:${t.progress_pct}%"></div></div><div class="progress-caption"><span>${t.progress_pct}% пути пройдено</span><span>Следующий уровень</span></div></section>
    <div class="section-head section-gap"><h2>Следующий шаг</h2><button class="link-button" data-view="development">Все задания</button></div>${task ? `<article class="task-card featured-task"><div class="task-type">Рекомендуется для вашего маршрута</div><h3>${task.title}</h3><p>${task.reasons[0] || task.description}</p><div class="task-footer"><span class="task-reward">+${task.reward_coins || 60} Coins</span><button class="small-button" data-action="complete-event" data-id="${task.event_id}">Начать</button></div></article>` : '<div class="empty-card">Новых заданий пока нет</div>'}`);
}

function renderDevelopment() {
  const p = state.profile; const g = game(); const tasks = p.recommendations.map((item) => `<article class="task-card"><div class="task-type">${item.type} · ${item.duration_hours} ч</div><h3>${item.title}</h3><p>${item.reasons.join(' · ') || item.description}</p><div class="task-footer"><span class="task-reward">+${item.reward_coins || 60} Coins</span><button class="small-button" data-action="complete-event" data-id="${item.event_id}">Выполнить</button></div></article>`).join('');
  shell(`${header('Развитие', 'Ваши задания, курсы и путь к следующему уровню.')}
    <section class="career-card"><div class="section-head"><div><div class="muted">Прогресс маршрута</div><h2>${p.trajectory.target_role}</h2></div><strong class="green-text">${p.trajectory.progress_pct}%</strong></div><div class="progress-track"><div class="progress-fill" style="width:${p.trajectory.progress_pct}%"></div></div><div class="progress-caption"><span>${p.employee.grade}</span><span>${p.trajectory.target_grade}</span></div></section>
    <div class="stats-strip"><div><strong>3</strong><span>теста за неделю</span></div><div><strong>1</strong><span>курс за месяц</span></div><div><strong>${g.streak_days}</strong><span>дней подряд</span></div></div>
    <div class="section-head section-gap"><h2>Персональные задания</h2><span class="muted">ИИ-подбор</span></div><div class="task-list">${tasks || '<div class="empty-card">Все задания выполнены. Скоро появятся новые.</div>'}</div>
    <div class="section-head section-gap"><h2>Курсы и тесты</h2><span class="muted">демо-каталог</span></div><div class="task-list">${demoCourses.map((item) => `<article class="task-card"><div class="task-type">${item.type} · ${item.detail}</div><h3>${item.title}</h3><p>Рекомендовано для вашего карьерного маршрута.</p><div class="task-footer"><span class="task-reward">+${item.reward} Coins</span><button class="small-button" data-action="demo-course" data-id="${item.id}">${state.completedDemo.has(item.id) ? 'Пройдено' : 'Открыть'}</button></div></article>`).join('')}</div>`);
}

function renderCoins() {
  const g = game(); shell(`${header('Coins', 'Внутренняя валюта за развитие и вклад в команду.')}
    <section class="balance-card coins-large"><div><span class="card-label">Доступно сейчас</span><strong>${g.coins_balance.toLocaleString('ru-RU')}</strong><span class="card-note">Coins нельзя купить — их можно только заработать</span></div><div class="coin">●</div></section>
    <div class="section-head section-gap"><h2>История начислений</h2><span class="muted">последние действия</span></div><section class="white-card ledger"><div><span>Прохождение курса</span><b>+120</b></div><div><span>Тест по продукту</span><b>+60</b></div><div><span>Серия активности 7 дней</span><b>+100</b></div><div><span>Задание от команды</span><b>+40</b></div></section>
    <div class="section-head section-gap"><h2>Внутренний магазин</h2><span class="muted">обмен Coins</span></div><div class="shop-list">${shop.map((item, i) => `<article class="shop-card"><div class="shop-icon">✦</div><div><h3>${item[0]}</h3><p>${item[1]}</p></div><button class="small-button" data-action="redeem" data-id="${i}">${item[2]} Coins</button></article>`).join('')}</div>`);
}

function renderProfile() {
  const p = state.profile; const g = game(); const person = p.employee;
  shell(`${header('Мой профиль', 'Данные доступны только вам и HR.')}
    <section class="profile-card"><div class="profile-avatar">${person.full_name.slice(0, 1)}</div><h2>${person.full_name}</h2><p>${person.role} · ${person.grade}</p><span>${person.department}</span></section>
    <section class="halyk-card"><div><span>Halyk Career Card</span><strong>•••• 4286</strong><small>Карта для начисления бонусов</small></div><div class="card-chip">◈</div></section>
    <div class="section-head section-gap"><h2>Моя статистика</h2></div><div class="stats-grid"><div><strong>3</strong><span>теста за неделю</span></div><div><strong>1</strong><span>курс за месяц</span></div><div><strong>${p.trajectory.progress_pct}%</strong><span>до следующего уровня</span></div><div><strong>${g.achievements.length}</strong><span>достижения</span></div></div>
    <section class="white-card degree-card"><div class="section-head"><h2>Уровень специалиста</h2><span class="level-pill">${person.grade}</span></div><div class="degree-line"><span>Новенький</span><span class="degree-active">${person.grade}</span><span>Гуру-мастер</span></div><div class="progress-track"><div class="progress-fill" style="width:${p.trajectory.progress_pct}%"></div></div></section>
    <button class="outline-button logout" data-action="logout">Выйти из кабинета</button>`);
}

function renderView() { ({ home: renderHome, development: renderDevelopment, coins: renderCoins, profile: renderProfile }[state.view] || renderHome)(); }

async function completeActivity(eventId) { try { state.profile = await request(`/api/employees/${state.employeeId}/activities/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_id: eventId }) }); state.coinsAdjustment += 60; toast('Задание выполнено — Coins начислены'); renderView(); } catch (error) { showError(error); } }
function handleAction(action, id) { if (action === 'complete-event') completeActivity(id); if (action === 'demo-course') { state.completedDemo.add(id); const item = demoCourses.find((course) => course.id === id); state.coinsAdjustment += item.reward; toast(`${item.type} завершён — +${item.reward} Coins`); renderView(); } if (action === 'redeem') { const item = shop[Number(id)]; if (game().coins_balance < item[2]) toast('Пока недостаточно Coins'); else { state.coinsAdjustment -= item[2]; toast(`Заявка оформлена: ${item[0]}`); renderCoins(); } } if (action === 'news') toast(`${news[Number(id)][0]}: материал открыт в демо-режиме`); if (action === 'logout') { state.employeeId = null; state.profile = null; $('#app').hidden = true; $('#login').hidden = false; } }
function setView(view) { state.view = view; document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === view)); renderView(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
async function login() { const code = $('#employee-code').value.trim().toUpperCase(); try { const data = await request('/api/employees'); if (!data.employees.some((item) => item.employee_id === code)) throw new Error('Проверьте код сотрудника'); state.employeeId = code; state.profile = await request(`/api/employees/${code}`); $('#login').hidden = true; $('#app').hidden = false; renderView(); } catch (error) { showError(error); } }

$('#login-button').addEventListener('click', login); $('#employee-code').addEventListener('keydown', (event) => { if (event.key === 'Enter') login(); }); document.querySelectorAll('.nav-item').forEach((item) => item.addEventListener('click', () => setView(item.dataset.view)));
