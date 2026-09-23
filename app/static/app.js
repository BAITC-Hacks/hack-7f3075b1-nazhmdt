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
  const p = state.profile; const person = p.employee; const g = game();
  shell(`${header(`Добрый день, ${person.full_name.split(' ')[0]} 👋`, 'Всё важное для вашего развития — в одном месте.')}
    <section class="balance-card"><div><span class="card-label">Мои Coins</span><strong>${g.coins_balance.toLocaleString('ru-RU')}</strong><span class="card-note">+${g.weekly_coins} за эту неделю · серия ${g.streak_days} дн.</span></div><div class="coin">●</div></section>
    <div class="section-head section-gap"><h2>Новости компании</h2><span class="muted">Внутренние обновления</span></div><div class="news-list">${news.map((item, i) => `<button class="news-card" data-action="news" data-id="${i}"><span>${item[0]} · ${item[2]}</span><strong>${item[1]}</strong><small>Открыть новость →</small></button>`).join('')}</div>
    <section class="white-card company-note"><div class="muted">Внутри Halyk Career</div><h2>Развивайтесь в своём темпе</h2><p>Новости, возможности и новые программы появляются здесь первыми.</p><button class="outline-button" data-view="development">Перейти к развитию</button></section>`);
}

function renderDevelopment() {
  const p = state.profile; const g = game(); const tasks = p.recommendations.map((item) => `<article class="task-card"><div class="task-type">${item.type} · ${item.duration_hours} ч</div><h3>${item.title}</h3><p>${item.reasons.join(' · ') || item.description}</p><div class="task-footer"><span class="task-reward">+${item.reward_coins || 60} Coins</span><button class="small-button" data-action="open-event" data-id="${item.event_id}">Открыть</button></div></article>`).join('');
  shell(`${header('Развитие', 'Ваши задания, курсы и путь к следующему уровню.')}
    <section class="career-card"><div class="section-head"><div><div class="muted">Прогресс маршрута</div><h2>${p.trajectory.target_role}</h2></div><strong class="green-text">${p.trajectory.progress_pct}%</strong></div><div class="progress-track"><div class="progress-fill" style="width:${p.trajectory.progress_pct}%"></div></div><div class="progress-caption"><span>${p.employee.grade}</span><span>${p.trajectory.target_grade}</span></div></section>
    <div class="stats-strip"><div><strong>3</strong><span>теста за неделю</span></div><div><strong>1</strong><span>курс за месяц</span></div><div><strong>${g.streak_days}</strong><span>дней подряд</span></div></div>
    <div class="section-head section-gap"><h2>Персональные задания</h2><span class="muted">ИИ-подбор</span></div><div class="task-list">${tasks || '<div class="empty-card">Все задания выполнены. Скоро появятся новые.</div>'}</div>
    <div class="section-head section-gap"><h2>Курсы и тесты</h2><span class="muted">демо-каталог</span></div><div class="task-list">${demoCourses.map((item) => `<article class="task-card"><div class="task-type">${item.type} · ${item.detail}</div><h3>${item.title}</h3><p>Рекомендовано для вашего карьерного маршрута.</p><div class="task-footer"><span class="task-reward">+${item.reward} Coins</span><button class="small-button" data-action="open-demo" data-id="${item.id}">${state.completedDemo.has(item.id) ? 'Пройдено' : 'Открыть'}</button></div></article>`).join('')}</div>`);
}

function renderDemoDetail(item) {
  const isTest = item.type === 'Тест';
  shell(`<button class="back-button" data-view="development">← Вернуться к развитию</button><div class="detail-hero"><div class="task-type">${item.type} · ${item.detail}</div><h1>${item.title}</h1><p>Гипотетический ${isTest ? 'тест' : 'курс'} для демонстрации пользовательского сценария Career Quest.</p></div>${isTest ? `<section class="white-card quiz-card"><div class="muted">Вопрос 1 из 12</div><h2>Какой подход лучше помогает команде развивать навык?</h2><div class="answer-list"><button data-action="answer" data-id="wrong">Сделать один большой тренинг в конце года</button><button data-action="answer" data-id="right">Дать короткую практику и быструю обратную связь</button><button data-action="answer" data-id="wrong">Не измерять результат</button></div><div id="quiz-result" class="quiz-result" hidden></div></section>` : `<section class="white-card course-content"><div class="module done"><span>✓</span><div><strong>Модуль 1. Зачем это нужно</strong><small>Завершён · 8 минут</small></div></div><div class="module"><span>2</span><div><strong>Модуль 2. Практика на рабочем кейсе</strong><small>15 минут · доступен сейчас</small></div></div><div class="module"><span>3</span><div><strong>Модуль 3. Проверка знаний</strong><small>10 минут</small></div></div><button class="primary-button" data-action="finish-demo" data-id="${item.id}">${state.completedDemo.has(item.id) ? 'Курс пройден' : 'Завершить модуль'}</button></section>`}`);
}

function renderEventDetail(eventId) {
  const item = state.profile.recommendations.find((candidate) => candidate.event_id === eventId); if (!item) return renderDevelopment();
  shell(`<button class="back-button" data-view="development">← Вернуться к развитию</button><div class="detail-hero"><div class="task-type">Персональное задание · ${item.duration_hours} ч</div><h1>${item.title}</h1><p>${item.description}</p></div><section class="white-card course-content"><div class="detail-line"><span>Почему это вам подходит</span><strong>${item.reasons[0] || 'Закрывает один из навыковых разрывов'}</strong></div><div class="detail-line"><span>Награда</span><strong class="gold-text">+${item.reward_coins || 60} Coins</strong></div><button class="primary-button" data-action="complete-event" data-id="${item.event_id}">Отметить выполненным</button></section>`);
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
    <section class="settings-card"><div class="section-head"><h2>Настройки аккаунта</h2><span class="muted">личный кабинет</span></div><button class="setting-row" data-action="language" data-id="0"><span><b>Язык приложения</b><small>Русский</small></span><strong>›</strong></button><button class="setting-row" data-action="theme"><span><b>Тема приложения</b><small>Системная · светлая</small></span><strong>›</strong></button><button class="setting-row" data-action="phone"><span><b>Номер телефона</b><small>+7 (707) ***-42-86</small></span><strong>›</strong></button><button class="setting-row" data-action="notifications"><span><b>Уведомления</b><small>Включены для заданий и новостей</small></span><strong>›</strong></button></section>
    <button class="outline-button logout" data-action="logout">Выйти из кабинета</button>`);
}

function renderView() { if (state.view === 'demo-detail') return renderDemoDetail(state.detail); if (state.view === 'event-detail') return renderEventDetail(state.detail); ({ home: renderHome, development: renderDevelopment, coins: renderCoins, profile: renderProfile }[state.view] || renderHome)(); }

async function completeActivity(eventId) { try { state.profile = await request(`/api/employees/${state.employeeId}/activities/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_id: eventId }) }); state.coinsAdjustment += 60; toast('Задание выполнено — Coins начислены'); renderView(); } catch (error) { showError(error); } }
function handleAction(action, id) { if (action === 'complete-event') completeActivity(id); if (action === 'open-event') { state.detail = id; state.view = 'event-detail'; renderView(); } if (action === 'open-demo') { state.detail = demoCourses.find((course) => course.id === id); state.view = 'demo-detail'; renderView(); } if (action === 'finish-demo') { const item = demoCourses.find((course) => course.id === id); state.completedDemo.add(id); state.coinsAdjustment += item.reward; toast(`${item.type} завершён — +${item.reward} Coins`); renderView(); } if (action === 'answer') { const result = $('#quiz-result'); result.hidden = false; result.className = `quiz-result ${id === 'right' ? 'correct' : 'incorrect'}`; result.textContent = id === 'right' ? 'Верно! Ответ засчитан. Нажмите «Завершить тест».' : 'Попробуйте ещё раз — подумайте о короткой практике и обратной связи.'; if (id === 'right') result.innerHTML += '<br><button class="small-button" data-action="finish-demo" data-id="course-2">Завершить тест · +60 Coins</button>'; bindActions(); } if (action === 'redeem') { const item = shop[Number(id)]; if (game().coins_balance < item[2]) toast('Пока недостаточно Coins'); else { state.coinsAdjustment -= item[2]; toast(`Заявка оформлена: ${item[0]}`); renderCoins(); } } if (action === 'news') toast(`${news[Number(id)][0]}: материал открыт в демо-режиме`); if (action === 'theme') { document.body.classList.toggle('dark-mode'); toast(document.body.classList.contains('dark-mode') ? 'Тёмная тема включена' : 'Светлая тема включена'); } if (action === 'language') { const languages = ['Русский', 'Қазақша', 'English']; const next = languages[(Number(id) + 1) % languages.length]; toast(`Язык приложения: ${next}`); } if (action === 'phone') toast('Номер подтверждён при регистрации: +7 (707) ***-42-86'); if (action === 'notifications') toast('Настройки уведомлений открыты в демо-режиме'); if (action === 'logout') { state.employeeId = null; state.profile = null; $('#app').hidden = true; $('#login').hidden = false; } }
function setView(view) { state.view = view; document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === view)); renderView(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
async function login() { const code = $('#employee-code').value.trim().toUpperCase(); try { const data = await request('/api/employees'); if (!data.employees.some((item) => item.employee_id === code)) throw new Error('Проверьте код сотрудника'); state.employeeId = code; state.profile = await request(`/api/employees/${code}`); $('#login').hidden = true; $('#app').hidden = false; renderView(); } catch (error) { showError(error); } }

$('#login-button').addEventListener('click', login); $('#employee-code').addEventListener('keydown', (event) => { if (event.key === 'Enter') login(); }); document.querySelectorAll('.nav-item').forEach((item) => item.addEventListener('click', () => setView(item.dataset.view)));
