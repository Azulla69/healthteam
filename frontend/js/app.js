// ---------- Состояние приложения ----------
const state = {
  view: 'services',
  user: null,
  isAdmin: false,
  viewAsClient: false,
  products: [],
  orders: [],
  myActiveOrdersCount: 0,
  cart: JSON.parse(localStorage.getItem('cart') || '{}'),
  botUsername: '',
  bonusHistory: [],
  checkoutUseBonus: 0,
  checkoutUseBirthday: false,
  checkoutUseConsultant: false,

  consultantStep: 'intro',
  consultantChat: { messages: [], loading: false, error: false },
  consultantProducts: [],
  consultantSelected: {},
  consultantEligibleIds: [], // товары из последней подборки — для показа чекбокса скидки в корзине
  reviewsData: { items: [], total: 0, avg: 0, page: 1, totalPages: 1 },
  reminderData: { settings: null, items: [] },

  catalogStep: 'sections',
  selectedSection: null,
  selectedSubcategory: null,
  selectedBrand: null,
  searchQuery: '',
  sortBy: 'default',

  // Управление
  manageSection: null, // null | catalog | orders | users | ledger | stats
  manageCatalogView: 'menu', // menu | list
  manageOrdersTab: 'processing', // processing | delivering | completed
  usersData: [],
  ledgerData: { balance: 0, entries: [] },
  statsData: null,
};

const STATUS_LABELS = { processing: 'Принято в обработку', delivering: 'Доставляем', completed: 'Выполнено', cancelled: 'Отменён' };

function effectiveAdmin() { return state.isAdmin && !state.viewAsClient; }
function saveCart() { localStorage.setItem('cart', JSON.stringify(state.cart)); }
function cartCount() { return Object.values(state.cart).reduce((a, b) => a + b, 0); }
function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}
function profileComplete(user) { return !!(user && user.first_name && user.last_name && user.phone); }
function onboardingComplete(user) { return !!(user && user.first_name && user.last_name && user.phone && user.birth_date); }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('ru-RU') : '—'; }

// Держит поле телефона всегда начинающимся с "+7"
function attachPhoneMask(input) {
  if (!input.value) input.value = '+7 ';
  input.addEventListener('focus', () => { if (!input.value) input.value = '+7 '; });
  input.addEventListener('input', () => {
    let digits = input.value.replace(/\D/g, '');
    if (digits.startsWith('7')) digits = digits.slice(1);
    if (digits.startsWith('8')) digits = digits.slice(1);
    input.value = '+7 ' + digits;
  });
}

// Показывает реальное фото товара, если оно загружено, иначе — плейсхолдер с эмодзи
function thumbHtml(imageUrl, className, emoji = '🌿') {
  return imageUrl
    ? `<img src="${imageUrl}" class="${className}" alt="">`
    : `<div class="${className}">${emoji}</div>`;
}

if (tg) { tg.ready(); tg.expand(); }

// ---------- Загрузка данных ----------
async function loadInitialData() {
  try {
    const cfg = await api('/api/config');
    state.botUsername = cfg.botUsername || '';
  } catch (e) { /* не критично */ }
  try {
    if (tg && tg.initData) {
      state.user = await api('/api/profile/me');
      state.isAdmin = !!state.user.isAdmin;
      await refreshMyActiveOrders();

      // Если открыто по реферальной ссылке (t.me/bot?startapp=ID) и ещё не привязан пригласивший
      const startParam = tg.initDataUnsafe && tg.initDataUnsafe.start_param;
      if (startParam && !state.user.referred_by) {
        try {
          await api('/api/profile/referral', { method: 'POST', body: { ref_code: startParam } });
          state.user = await api('/api/profile/me');
        } catch (e) { /* самореферал/некорректный код — игнорируем молча */ }
      }
    }
  } catch (e) { /* гость */ }
  await loadProducts();
  render();

  // Открыто по кнопке "Оценить заказ" из сообщения бота: /?review=123
  const reviewOrderId = new URLSearchParams(window.location.search).get('review');
  if (reviewOrderId && state.user) {
    openReviewForm(Number(reviewOrderId));
  }

  // Открыто по кнопке из чата с ИИ-консультантом в Telegram: /?consultant_ids=1,2,3
  const consultantIdsParam = new URLSearchParams(window.location.search).get('consultant_ids');
  if (consultantIdsParam && state.user) {
    const ids = consultantIdsParam.split(',').map(Number).filter(Boolean);
    const products = ids.map(id => state.products.find(p => p.id === id)).filter(Boolean);
    if (products.length > 0) {
      state.consultantProducts = products;
      state.consultantSelected = {};
      state.consultantStep = 'result';
      state.view = 'consultant';
      render();
    }
  }

  // Открыто по кнопке "Включить напоминания" из сообщения бота: /?reminders=1
  if (new URLSearchParams(window.location.search).get('reminders') && state.user) {
    await loadReminders();
    state.view = 'reminders';
    render();
  }
}

function openOnboardingModal() {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const u = state.user;
  backdrop.innerHTML = `
    <div class="modal-sheet">
      <h3>Добро пожаловать в HealthTeam 👋</h3>
      <p style="font-size:13px;color:var(--ink-soft);margin-top:-6px">Заполните, пожалуйста, свои данные — это займёт минуту и понадобится один раз, дальше при заказах указывать их снова не нужно.</p>
      <div class="field"><label>Имя</label><input id="ob-first-name" value="${u.first_name || ''}" /></div>
      <div class="field"><label>Фамилия</label><input id="ob-last-name" value="${u.last_name || ''}" /></div>
      <div class="field"><label>Телефон</label><input id="ob-phone" type="tel" value="${u.phone || ''}" /></div>
      <div class="field"><label>Дата рождения</label><input id="ob-birth" type="date" value="${u.birth_date || ''}" /></div>
      <button class="btn btn-primary btn-block" id="ob-save">Продолжить</button>
    </div>
  `;
  document.body.appendChild(backdrop);
  attachPhoneMask(backdrop.querySelector('#ob-phone'));
  backdrop.querySelector('#ob-save').onclick = async () => {
    const first_name = document.getElementById('ob-first-name').value.trim();
    const last_name = document.getElementById('ob-last-name').value.trim();
    const phone = document.getElementById('ob-phone').value.trim();
    const birth_date = document.getElementById('ob-birth').value;
    if (!first_name || !last_name || phone.replace(/\D/g, '').length < 11 || !birth_date) {
      toast('Заполните все поля корректно'); return;
    }
    try {
      state.user = await api('/api/profile/me', { method: 'PUT', body: { first_name, last_name, phone, birth_date } });
      backdrop.remove();
      toast('Спасибо! Профиль заполнен');
      render();
    } catch (e) { toast('Не удалось сохранить, попробуйте ещё раз'); }
  };
}

async function loadProducts() { state.products = await api('/api/catalog'); }
async function loadOrders() { state.orders = effectiveAdmin() ? await api('/api/orders') : await api('/api/orders/my'); }
async function refreshMyActiveOrders() {
  if (!state.user) return;
  const mine = await api('/api/orders/my');
  state.myActiveOrdersCount = mine.filter(o => ['processing', 'delivering'].includes(o.status)).length;
}
async function loadUsers() { state.usersData = await api('/api/users'); }
async function loadLedger() { state.ledgerData = await api('/api/ledger'); }
async function loadStats() { state.statsData = await api('/api/stats'); }

// ---------- Рендер ----------
const app = document.getElementById('app');

function render() {
  let html = '';
  if (state.view === 'services') html = renderServices();
  else if (state.view === 'catalog') html = renderCatalog();
  else if (state.view === 'bonusInfo') html = renderBonusInfoPage();
  else if (state.view === 'referral') html = renderReferralPage();
  else if (state.view === 'reviews') html = renderReviewsWall();
  else if (state.view === 'reminders') html = renderReminders();
  else if (state.view === 'consultant') html = renderConsultantStub();
  else if (state.view === 'cart') html = renderCart();
  else if (state.view === 'profile') html = renderProfile();
  else if (state.view === 'manage') html = renderManage();

  app.innerHTML = html + renderTabbar();
  attachEvents();
}

function renderTabbar() {
  const tabs = [
    { id: 'services', label: 'Сервисы', icon: '✨' },
    { id: 'cart', label: 'Корзина', icon: '🛒', badge: cartCount() },
    { id: 'profile', label: 'Профиль', icon: '👤' },
  ];
  if (effectiveAdmin()) tabs.push({ id: 'manage', label: 'Управление', icon: '⚙️' });

  return `
    <div class="tabbar">
      ${tabs.map(t => `
        <button class="tab ${state.view === t.id || (t.id === 'services' && ['catalog', 'bonusInfo', 'referral', 'consultant', 'reviews'].includes(state.view)) ? 'active' : ''}" data-tab="${t.id}" style="position:relative;">
          <span>${t.icon}</span><span>${t.label}</span>
          ${t.badge ? `<span class="dot"></span>` : ''}
        </button>
      `).join('')}
    </div>
  `;
}

// ================= СЕРВИСЫ (главное меню клиента) =================
function renderServices() {
  const tiles = [
    { id: 'catalog', emoji: '🌿', name: 'Каталог', desc: 'БАДы и спортивное питание' },
    { id: 'consultant', emoji: '🧬', name: 'Бот-консультант', desc: 'Откроет диалог в Telegram' },
    { id: 'bonusInfo', emoji: '🎁', name: 'Бонусная система', desc: 'Кэшбек и уровни' },
    { id: 'referral', emoji: '🤝', name: 'Реферальная система', desc: 'Приглашайте друзей' },
    { id: 'reviews', emoji: '⭐', name: 'Отзывы', desc: 'Мнения покупателей' },
    { id: 'reminders', emoji: '⏰', name: 'Напоминания', desc: 'Когда и что принимать' },
  ];
  return `
    <div class="topbar-centered"><h1>HealthTeam</h1></div>
    <div class="manage-menu" style="padding-top:4px">
      ${tiles.map(t => `
        <div class="manage-menu-tile service-tile" data-service="${t.id}">
          <div class="emoji">${t.emoji}</div>
          <div class="name">${t.name}</div>
          <div style="font-size:11px;color:var(--ink-soft)">${t.desc}</div>
        </div>
      `).join('')}
    </div>
  `;
}

// ================= БОТ-КОНСУЛЬТАНТ (живой чат с ИИ) =================
const CONSULTANT_MARKER_RE = /\[\[РЕКОМЕНДАЦИЯ:\s*([^\]]+)\]\]/i;

async function sendConsultantChat() {
  try {
    const payload = state.consultantChat.messages.map(m => ({ role: m.role, content: m.content }));
    const data = await api('/api/consultant/chat', { method: 'POST', body: { messages: payload } });
    let reply = data.reply || '';
    const match = reply.match(CONSULTANT_MARKER_RE);
    let recommendedIds = null;
    if (match) {
      recommendedIds = match[1].split(',').map(s => s.replace(/\D/g, '')).filter(Boolean).map(Number);
      reply = reply.replace(CONSULTANT_MARKER_RE, '').trim();
    } else {
      const lines = reply.trim().split('\n');
      const lastLine = (lines[lines.length - 1] || '').trim();
      if (/^[#\d\s,]+$/.test(lastLine) && /\d/.test(lastLine)) {
        const ids = lastLine.split(',').map(s => s.replace(/\D/g, '')).filter(Boolean).map(Number);
        if (ids.length >= 2) { recommendedIds = ids; lines.pop(); reply = lines.join('\n').trim(); }
      }
    }
    state.consultantChat.messages.push({ role: 'assistant', content: reply });
    state.consultantChat.loading = false;
    render();
    document.getElementById('chat-messages')?.scrollTo(0, 999999);

    if (recommendedIds && recommendedIds.length > 0) {
      const products = recommendedIds.map(id => state.products.find(p => p.id === id)).filter(Boolean);
      if (products.length > 0) {
        state.consultantProducts = products;
        state.consultantSelected = {};
        setTimeout(() => { state.consultantStep = 'result'; render(); }, 1200);
      }
    }
  } catch (e) {
    state.consultantChat.loading = false;
    state.consultantChat.error = true;
    if (e.message === 'ai_not_configured') toast('ИИ-консультант временно недоступен — уточните у администратора');
    render();
  }
}

function renderConsultantStub() {
  const step = state.consultantStep || 'intro';
  const header = `
    <div class="back-row-lg"><button data-action="back-to-services">← Сервисы</button></div>
    <div class="topbar-centered"><h1>Бот-консультант</h1></div>
  `;

  if (step === 'intro') {
    return header + `
      <div class="empty-state">
        <h3>🧬 Живой ИИ-консультант</h3>
        <p>Расскажите о себе в чате — чем занимаетесь, какие цели, каким спортом занимаетесь — и получите персональную рекомендацию из нашего каталога со скидкой 10%.</p>
        <button class="btn btn-primary" data-action="consultant-start" style="margin-top:10px">Начать разговор</button>
      </div>
    `;
  }

  if (step === 'chat') {
    const chat = state.consultantChat;
    return header + `
      <div class="section" style="padding-top:0">
        <div id="chat-messages" class="chat-messages">
          ${chat.messages.filter(m => !m.hidden).map(m => `<div class="chat-bubble ${m.role}">${m.content}</div>`).join('')}
          ${chat.loading ? `<div class="chat-bubble assistant chat-typing">Печатает…</div>` : ''}
          ${chat.error ? `<div class="chat-bubble assistant" style="color:var(--danger)">Не удалось получить ответ. Попробуйте ещё раз.</div>` : ''}
        </div>
        <div class="field"><input id="consultant-chat-input" placeholder="Напишите ответ..." ${chat.loading ? 'disabled' : ''} /></div>
        <button class="btn btn-primary btn-block" id="consultant-chat-send" ${chat.loading ? 'disabled' : ''}>Отправить</button>
        <button class="btn btn-ghost btn-block" data-action="consultant-restart" style="margin-top:8px">Начать заново</button>
      </div>
    `;
  }

  if (step === 'result') {
    const products = state.consultantProducts || [];
    const selected = products.filter(p => state.consultantSelected[p.id] !== false);
    const subtotal = selected.reduce((s, p) => s + p.price, 0);
    const discounted = Math.round(subtotal * 0.9);
    return header + `
      <div class="section" style="padding-top:0">
        <h3 style="margin-bottom:6px">Персональная подборка от консультанта</h3>
        <p style="font-size:13px;color:var(--ink-soft);margin-bottom:14px">Снимите галочку, если что-то не нужно.</p>
        ${products.length === 0 ? `<div class="empty-state"><h3>Не нашли подходящих товаров</h3><p>Возможно, каталог сейчас пуст в нужных категориях — загляните позже.</p></div>` :
          products.map(p => `
            <div class="manage-row">
              ${thumbHtml(p.image_url, 'thumb')}
              <div class="info">
                <div class="n">${p.name}</div>
                <div class="m">${p.brand || ''} · ${p.price} ₽</div>
              </div>
              <input type="checkbox" data-consultant-toggle="${p.id}" ${state.consultantSelected[p.id] !== false ? 'checked' : ''} />
            </div>
          `).join('')
        }
        ${products.length > 0 ? `
          <div class="row-between" style="margin:14px 0 4px;font-size:13px;color:var(--ink-soft)"><span>Сумма набора</span><span>${subtotal} ₽</span></div>
          <div class="row-between" style="margin-bottom:14px"><strong>Со скидкой 10%</strong><span class="price-tag">${discounted} ₽</span></div>
          <button class="btn btn-amber btn-block" data-action="consultant-add-to-cart">Добавить в корзину со скидкой 10%</button>
        ` : ''}
        <button class="btn btn-ghost btn-block" data-action="consultant-restart" style="margin-top:8px">Начать заново</button>
      </div>
    `;
  }

  return header;
}

function renderBonusInfoPage() {
  const bonus = state.user ? state.user.bonus : null;
  return `
    <div class="back-row-lg"><button data-action="back-to-services">← Сервисы</button></div>
    <div class="topbar-centered"><h1>Бонусная система</h1></div>
    <div class="section" style="padding-top:0">
      ${bonus ? renderBonusCard(bonus, false) : ''}
      ${state.user ? `<button class="btn btn-ghost btn-block" data-action="open-bonus-history" style="margin-bottom:16px">📜 История начислений и списаний</button>` : ''}

      <div class="list-item">
        <h3 style="margin-bottom:8px">Как это работает</h3>
        <p style="font-size:13px;color:var(--ink-soft);line-height:1.6">
          За каждую выполненную покупку вам возвращается кэшбек бонусами — в зависимости от того, сколько вы потратили за последние 6 месяцев (отсчёт идёт от вашей первой покупки):
        </p>
        <div style="margin:12px 0;display:flex;flex-direction:column;gap:6px;font-size:13px">
          <div class="row-between"><span>🥉 Бронзовый — до 3 000 ₽</span><strong>3%</strong></div>
          <div class="row-between"><span>🥈 Серебряный — от 3 000 ₽</span><strong>5%</strong></div>
          <div class="row-between"><span>🥇 Золотой — от 6 000 ₽</span><strong>7%</strong></div>
          <div class="row-between"><span>💎 Платиновый — от 10 000 ₽</span><strong>10%</strong></div>
        </div>
        <p style="font-size:13px;color:var(--ink-soft);line-height:1.6">
          Кэшбек считается от суммы, которую вы реально оплатили — то есть если часть заказа оплачена бонусами, кэшбек начисляется только на оставшуюся часть.<br><br>
          Бонусами можно оплатить до <strong>50%</strong> стоимости любого заказа.<br><br>
          ⏳ Бонусы действуют <strong>3 месяца</strong> с момента начисления — потратить нужно успеть до сгорания, дальше в истории они будут отмечены как «сгорели».<br><br>
          🎂 На день рождения — скидка <strong>15%</strong> на один заказ, доступна за 7 дней до и 7 дней после (15 дней в сумме).
        </p>
      </div>
    </div>
  `;
}

function renderReferralPage() {
  const ref = state.user ? state.user.referral : null;
  if (!ref) {
    return `
      <div class="back-row-lg"><button data-action="back-to-services">← Сервисы</button></div>
      <div class="topbar-centered"><h1>Реферальная система</h1></div>
      <div class="empty-state"><h3>Откройте приложение в Telegram</h3></div>
    `;
  }
  const link = state.botUsername ? `https://t.me/${state.botUsername}?startapp=${ref.code}` : `(укажите BOT_USERNAME в настройках сервера)`;
  return `
    <div class="back-row-lg"><button data-action="back-to-services">← Сервисы</button></div>
    <div class="topbar-centered"><h1>Реферальная система</h1></div>
    <div class="section" style="padding-top:0">
      <div class="bonus-card">
        <div class="bonus-tier-name">🤝 Приглашайте друзей</div>
        <div class="bonus-progress-label" style="margin-top:6px">Получайте ${Math.round(ref.rate * 100)}% от каждой их покупки бонусами — навсегда, бессрочно</div>
      </div>
      <div class="field"><label>Ваша реферальная ссылка</label><input id="ref-link" readonly value="${link}" /></div>
      <button class="btn btn-primary btn-block" data-action="copy-ref-link">Скопировать ссылку</button>
      <div class="stats-row" style="margin-top:16px">
        <div class="stat-box"><div class="num">${ref.referredCount}</div><div class="lbl">Приглашено друзей</div></div>
        <div class="stat-box"><div class="num">${Math.round(ref.rate * 100)}%</div><div class="lbl">С каждой покупки</div></div>
      </div>
      <div class="list-item">
        <h3 style="margin-bottom:10px">Лесенка бонусов</h3>
        <p style="font-size:13px;color:var(--ink-soft);margin-bottom:10px">За рефералов, которые сделали покупки на сумму от ${ref.qualifyMin} ₽:</p>
        ${ref.ladder.map(t => `
          <div class="row-between" style="padding:6px 0;border-bottom:1px solid var(--line)">
            <span style="font-size:13px">${ref.milestonesAwarded.includes(t.count) ? '✅' : '⬜️'} ${t.count} реферал(ов)</span>
            <strong>${t.bonus} бонусов</strong>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

async function loadReminders() {
  state.reminderData = await api('/api/reminders');
}

const SLOT_LABELS_UI = { morning: '🌅 Утро', day: '☀️ День', evening: '🌙 Вечер' };
const TIMING_LABELS_UI = { morning: 'утром', day: 'днём', evening: 'вечером' };

function renderReminders() {
  const d = state.reminderData;
  if (!d.settings) {
    return `
      <div class="back-row-lg"><button data-action="back-to-services">← Сервисы</button></div>
      <div class="topbar-centered"><h1>Напоминания</h1></div>
      <div class="empty-state"><h3>Откройте приложение в Telegram</h3></div>
    `;
  }
  return `
    <div class="back-row-lg"><button data-action="back-to-services">← Сервисы</button></div>
    <div class="topbar-centered"><h1>Напоминания</h1></div>
    <div class="section" style="padding-top:0">
      <p style="font-size:13px;color:var(--ink-soft);margin-bottom:14px">Бот сам напишет в Telegram в указанное время, что пора принять. Слот сработает, только если в нём есть хотя бы один препарат.</p>

      ${['morning', 'day', 'evening'].map(slot => `
        <div class="reminder-slot-card">
          <div class="row-between">
            <strong>${SLOT_LABELS_UI[slot]}</strong>
            <input type="checkbox" data-slot-toggle="${slot}" ${d.settings[slot].enabled ? 'checked' : ''} />
          </div>
          <input type="time" data-slot-time="${slot}" value="${d.settings[slot].time}" />
        </div>
      `).join('')}

      <div class="manage-group-title" style="padding-left:0">Что принимать</div>
      ${d.items.length === 0 ? `<div class="empty-state"><h3>Список пуст</h3><p>Появится автоматически после покупки, или добавьте вручную</p></div>` :
        d.items.map(i => `
          <div class="reminder-item-row">
            <div class="row-between">
              <div>
                <div class="n">${i.name}</div>
                <div class="m">${i.dosage_qty} ${i.dosage_unit}${i.food_relation ? ', ' + i.food_relation : ''}${i.source === 'purchase' ? ' · из заказа' : ''}</div>
                <div class="reminder-timing-tags">${i.timing.map(t => `<span class="reminder-timing-tag">${TIMING_LABELS_UI[t]}</span>`).join('')}</div>
              </div>
              <button class="icon-btn" data-delete-reminder-item="${i.id}">🗑</button>
            </div>
          </div>
        `).join('')
      }
      <button class="btn btn-ghost btn-block" data-action="add-reminder-item" style="margin-top:8px">➕ Добавить своё лекарство/БАД</button>
    </div>
  `;
}

function openAddReminderItemModal() {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const timing = { morning: false, day: false, evening: false };
  backdrop.innerHTML = `
    <div class="modal-sheet">
      <h3>Добавить в список приёма</h3>
      <div class="field"><label>Название</label><input id="ri-name" placeholder="напр. Магний B6" /></div>
      <div class="field"><label>Дозировка</label><input id="ri-dosage" placeholder="напр. 1 таблетка" /></div>
      <div class="field">
        <label>Когда принимать</label>
        <div style="display:flex;gap:10px;margin-top:4px">
          <label style="display:flex;align-items:center;gap:4px;font-size:13px"><input type="checkbox" id="ri-morning" /> Утром</label>
          <label style="display:flex;align-items:center;gap:4px;font-size:13px"><input type="checkbox" id="ri-day" /> Днём</label>
          <label style="display:flex;align-items:center;gap:4px;font-size:13px"><input type="checkbox" id="ri-evening" /> Вечером</label>
        </div>
      </div>
      <div class="field">
        <label>Приём пищи</label>
        <select id="ri-food">
          <option value="">Не важно</option>
          <option value="до еды">До еды</option>
          <option value="после еды">После еды</option>
          <option value="во время еды">Во время еды</option>
        </select>
      </div>
      <button class="btn btn-primary btn-block" id="ri-save">Добавить</button>
      <button class="btn btn-ghost btn-block" id="ri-cancel" style="margin-top:8px">Отмена</button>
    </div>
  `;
  document.body.appendChild(backdrop);
  backdrop.querySelector('#ri-cancel').onclick = () => backdrop.remove();
  backdrop.querySelector('#ri-save').onclick = async () => {
    const name = document.getElementById('ri-name').value.trim();
    const dosageRaw = document.getElementById('ri-dosage').value.trim() || '1 шт.';
    const parts = dosageRaw.split(' ');
    const dosage_qty = Number(parts[0]) || 1;
    const dosage_unit = parts.slice(1).join(' ') || 'шт.';
    const timingSel = ['morning', 'day', 'evening'].filter(t => document.getElementById(`ri-${t}`).checked);
    const food_relation = document.getElementById('ri-food').value;
    if (!name) { toast('Введите название'); return; }
    if (timingSel.length === 0) { toast('Выберите хотя бы одно время приёма'); return; }
    try {
      await api('/api/reminders/items', { method: 'POST', body: { name, dosage_qty, dosage_unit, timing: timingSel, food_relation } });
      backdrop.remove();
      await loadReminders();
      render();
      toast('Добавлено');
    } catch (e) { toast('Не удалось добавить'); }
  };
}

async function loadReviews(page = 1) {
  state.reviewsData = await api(`/api/reviews?page=${page}`);
}

function renderReviewsWall() {
  const d = state.reviewsData;
  return `
    <div class="back-row-lg"><button data-action="back-to-services">← Сервисы</button></div>
    <div class="topbar-centered"><h1>Отзывы</h1></div>
    <div class="section" style="padding-top:0">
      <div class="stats-row">
        <div class="stat-box"><div class="num">${d.avg || '—'} ⭐</div><div class="lbl">Средняя оценка</div></div>
        <div class="stat-box"><div class="num">${d.total}</div><div class="lbl">Всего отзывов</div></div>
      </div>
      ${d.items.length === 0 ? `<div class="empty-state"><h3>Отзывов пока нет</h3><p>Будьте первым, кто оценит заказ!</p></div>` :
        d.items.map(r => `
          <div class="list-item">
            <div class="row-between">
              <strong>${r.author_name}</strong>
              <span class="tier-badge" style="background:var(--sage);color:var(--forest-dark)">⭐ ${r.avg}/10</span>
            </div>
            <div style="font-size:11px;color:var(--ink-soft);margin:4px 0 8px">${fmtDate(r.created_at)}</div>
            <div style="font-size:12px;color:var(--ink-soft);display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px">
              <span>Товар: ${r.product_quality}/10</span>
              <span>Сервис: ${r.service_quality}/10</span>
              <span>Доставка: ${r.delivery_speed}/10</span>
            </div>
            ${r.text ? `<p style="font-size:13px;line-height:1.5">${r.text}</p>` : ''}
            ${effectiveAdmin() ? `<button class="btn btn-danger" style="padding:6px 12px;font-size:12px;margin-top:8px" data-delete-review="${r.id}">Удалить отзыв</button>` : ''}
          </div>
        `).join('')
      }
      ${d.totalPages > 1 ? `
        <div class="row-between" style="margin-top:12px">
          <button class="btn btn-ghost" data-action="reviews-prev" ${d.page <= 1 ? 'disabled' : ''}>← Назад</button>
          <span style="font-size:13px;color:var(--ink-soft)">Стр. ${d.page} из ${d.totalPages}</span>
          <button class="btn btn-ghost" data-action="reviews-next" ${d.page >= d.totalPages ? 'disabled' : ''}>Вперёд →</button>
        </div>
      ` : ''}
    </div>
  `;
}

// ================= КАТАЛОГ (покупатель) =================
const SECTION_ORDER = ['БАДы', 'Спортпит'];
const SECTION_EMOJI = { 'БАДы': '💊', 'Спортпит': '🥤' };

function visibleProducts() {
  const all = state.products;
  return effectiveAdmin() ? all : all.filter(p => p.active);
}

function renderCatalog() {
  const products = visibleProducts();

  if (state.catalogStep === 'sections') {
    const sections = [...new Set(products.map(p => p.section).filter(Boolean))]
      .sort((a, b) => SECTION_ORDER.indexOf(a) - SECTION_ORDER.indexOf(b));
    return `
      <div class="back-row-lg"><button data-action="back-to-services">← Сервисы</button></div>
      <div class="section-tiles">
        ${sections.map(s => `
          <div class="section-tile" data-section="${s}">
            <div class="emoji">${SECTION_EMOJI[s] || '🌿'}</div>
            <div class="name">${s}</div>
            <div class="count">${products.filter(p => p.section === s).length} товаров</div>
          </div>
        `).join('') || `<div class="empty-state" style="grid-column:1/-1"><h3>Каталог пуст</h3></div>`}
      </div>
    `;
  }

  // Сразу список всех товаров раздела + поиск по названию + фильтр по производителю
  let list = products.filter(p => p.section === state.selectedSection);
  const brands = [...new Set(list.map(p => p.brand).filter(Boolean))].sort();

  if (state.selectedBrand) list = list.filter(p => p.brand === state.selectedBrand);
  if (state.searchQuery.trim()) {
    const q = state.searchQuery.trim().toLowerCase();
    list = list.filter(p => p.name.toLowerCase().includes(q));
  }
  if (state.sortBy === 'brand') list = [...list].sort((a, b) => (a.brand || '').localeCompare(b.brand || ''));
  else if (state.sortBy === 'price_asc') list = [...list].sort((a, b) => a.price - b.price);
  else if (state.sortBy === 'price_desc') list = [...list].sort((a, b) => b.price - a.price);

  return `
    <div class="back-row-lg"><button data-action="back-to-sections">← ${state.selectedSection}</button></div>
    <div class="section" style="padding-top:0">
      <div class="field" style="margin-bottom:8px">
        <input id="catalog-search" placeholder="Поиск по названию..." value="${state.searchQuery}" />
      </div>
      <div class="sort-row" style="justify-content:space-between">
        <select data-action="brand-select">
          <option value="">Все производители</option>
          ${brands.map(b => `<option value="${b}" ${state.selectedBrand === b ? 'selected' : ''}>${b}</option>`).join('')}
        </select>
        <select data-action="sort-select">
          <option value="default" ${state.sortBy === 'default' ? 'selected' : ''}>По умолчанию</option>
          <option value="brand" ${state.sortBy === 'brand' ? 'selected' : ''}>По производителю (А-Я)</option>
          <option value="price_asc" ${state.sortBy === 'price_asc' ? 'selected' : ''}>Сначала дешевле</option>
          <option value="price_desc" ${state.sortBy === 'price_desc' ? 'selected' : ''}>Сначала дороже</option>
        </select>
      </div>
    </div>
    <div class="grid">
      ${list.map(renderProductCard).join('') || `<div class="empty-state" style="grid-column:1/-1"><h3>Ничего не найдено</h3></div>`}
    </div>
  `;
}

function renderProductCard(p) {
  const inactive = !p.active;
  const stockLabel = p.stock === 0
    ? '<div class="stock-out">Нет в наличии</div>'
    : `<div class="${p.stock <= 5 ? 'stock-low' : ''}" style="font-size:11px;color:var(--ink-soft)">Осталось ${p.stock} шт.</div>`;
  return `
    <div class="card" data-open-product="${p.id}" style="${inactive ? 'opacity:0.5' : ''}">
      ${thumbHtml(p.image_url, 'img-ph')}
      <div class="brand-tag">${p.brand || ''}</div>
      <div class="name">${p.name}</div>
      <div class="price-tag">${p.price} ₽</div>
      ${stockLabel}
      <button class="btn btn-primary" data-action="quick-add" data-id="${p.id}" ${p.stock === 0 ? 'disabled' : ''}>В корзину</button>
    </div>
  `;
}

function openProductDetailModal(product) {
  const inCart = state.cart[product.id] || 0;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  let qty = 1;

  function draw() {
    const maxReached = qty >= product.stock;
    backdrop.innerHTML = `
      <div class="modal-sheet">
        ${thumbHtml(product.image_url, 'detail-img')}
        <div class="brand-tag">${product.brand || ''}</div>
        <h3>${product.name}</h3>
        <div class="eyebrow" style="margin:4px 0 10px">${product.section} · ${product.category}</div>
        <p style="font-size:14px;color:var(--ink-soft);line-height:1.5">${product.description || ''}</p>
        <div class="row-between" style="margin-top:14px">
          <span class="price-tag">${product.price} ₽</span>
          <span style="font-size:12px;color:var(--ink-soft)">${product.stock === 0 ? 'Нет в наличии' : `В наличии: ${product.stock} шт.`}</span>
        </div>
        ${inCart ? `<div style="text-align:center;font-size:12px;color:var(--ink-soft);margin-top:8px">Уже в корзине: ${inCart} шт.</div>` : ''}
        ${product.stock > 0 ? `
          <div class="qty-stepper">
            <button id="pd-dec">−</button>
            <span class="val" id="pd-qty">${qty}</span>
            <button id="pd-inc" ${maxReached ? 'disabled' : ''}>+</button>
          </div>
          <button class="btn btn-primary btn-block" id="pd-add">Добавить в корзину</button>
        ` : ''}
        <button class="btn btn-ghost btn-block" id="pd-close" style="margin-top:8px">Закрыть</button>
      </div>
    `;
    backdrop.querySelector('#pd-close').onclick = () => backdrop.remove();
    if (product.stock > 0) {
      backdrop.querySelector('#pd-dec').onclick = () => { if (qty > 1) { qty--; draw(); } };
      backdrop.querySelector('#pd-inc').onclick = () => { if (qty < product.stock) { qty++; draw(); } };
      backdrop.querySelector('#pd-add').onclick = () => {
        state.cart[product.id] = Math.min((state.cart[product.id] || 0) + qty, product.stock);
        saveCart();
        backdrop.remove();
        toast('Добавлено в корзину');
        render();
      };
    }
  }
  draw();
  document.body.appendChild(backdrop);
}

// ================= КОРЗИНА =================
function renderCart() {
  const items = Object.entries(state.cart)
    .map(([id, qty]) => ({ product: state.products.find(p => p.id === Number(id)), qty }))
    .filter(i => i.product);
  const total = items.reduce((sum, i) => sum + i.product.price * i.qty, 0);
  const complete = profileComplete(state.user);
  const limitReached = state.myActiveOrdersCount >= 3;

  const bday = state.user && state.user.birthdayDiscount;
  const birthdayEligible = bday && bday.eligible;
  const cartProductIds = items.map(i => i.product.id);
  const consultantEligible = state.consultantEligibleIds.length > 0 && cartProductIds.length > 0 &&
    cartProductIds.every(id => state.consultantEligibleIds.includes(id));
  // Скидки не суммируются: если выбрана скидка ДР — консультантскую не считаем, и наоборот
  const useBirthday = state.checkoutUseBirthday && birthdayEligible;
  const useConsultant = !useBirthday && state.checkoutUseConsultant && consultantEligible;
  const afterDiscount = useBirthday ? Math.round(total * (1 - bday.rate)) : useConsultant ? Math.round(total * 0.9) : total;
  const deliveryCost = total < 500 ? 300 : total < 1000 ? 200 : total < 1500 ? 100 : 0;
  const bonusBalance = state.user ? state.user.bonus.balance : 0;
  const maxBonus = Math.min(bonusBalance, Math.floor(afterDiscount * 0.5));
  const bonusUsed = Math.min(state.checkoutUseBonus, maxBonus);
  const payable = afterDiscount - bonusUsed + deliveryCost;

  return `
    <div class="topbar-centered"><h1>Корзина</h1></div>
    <div class="section">
      ${items.length === 0 ? `<div class="empty-state"><h3>Корзина пуста</h3><p>Добавьте товары из каталога</p></div>` : `
        <div class="list-item">
          ${items.map(i => `
            <div class="cart-line">
              <div class="cart-line-thumb">
                ${thumbHtml(i.product.image_url, 'thumb')}
                <div>
                  <div style="font-weight:600;font-size:14px">${i.product.name}</div>
                  <div class="price-tag" style="margin-top:4px">${i.product.price} ₽</div>
                </div>
              </div>
              <div class="qty-control">
                <button data-action="dec" data-id="${i.product.id}">−</button>
                <span>${i.qty}</span>
                <button data-action="inc" data-id="${i.product.id}" ${i.qty >= i.product.stock ? 'disabled' : ''}>+</button>
              </div>
            </div>
          `).join('')}
        </div>

        ${birthdayEligible ? `
          <label class="row-between" style="padding:12px 14px;background:var(--sage);border-radius:12px;margin-bottom:12px;cursor:pointer">
            <span>🎂 Скидка ко дню рождения −${Math.round(bday.rate * 100)}%</span>
            <input type="checkbox" id="use-birthday" ${state.checkoutUseBirthday ? 'checked' : ''} />
          </label>
        ` : ''}

        ${consultantEligible ? `
          <label class="row-between" style="padding:12px 14px;background:var(--sage);border-radius:12px;margin-bottom:12px;cursor:pointer">
            <span>🧬 Скидка от бот-консультанта −10%</span>
            <input type="checkbox" id="use-consultant" ${state.checkoutUseConsultant && !useBirthday ? 'checked' : ''} ${useBirthday ? 'disabled' : ''} />
          </label>
          ${useBirthday ? `<div style="font-size:11px;color:var(--ink-soft);margin:-8px 0 12px">Скидки не суммируются — сейчас выбрана скидка на день рождения</div>` : ''}
        ` : ''}

        ${state.user && bonusBalance > 0 ? `
          <div class="field">
            <label>Списать бонусов (доступно ${bonusBalance} ₽, максимум 50% заказа — ${maxBonus} ₽)</label>
            <input type="number" id="use-bonus" min="0" max="${maxBonus}" value="${bonusUsed}" />
          </div>
        ` : ''}

        <div class="row-between" style="margin:8px 0;font-size:13px;color:var(--ink-soft)">
          <span>Сумма товаров</span><span>${total} ₽</span>
        </div>
        ${useBirthday ? `<div class="row-between" style="margin:4px 0;font-size:13px;color:var(--ink-soft)"><span>Скидка ДР</span><span>−${total - afterDiscount} ₽</span></div>` : ''}
        ${useConsultant ? `<div class="row-between" style="margin:4px 0;font-size:13px;color:var(--ink-soft)"><span>Скидка консультанта</span><span>−${total - afterDiscount} ₽</span></div>` : ''}
        ${bonusUsed > 0 ? `<div class="row-between" style="margin:4px 0;font-size:13px;color:var(--ink-soft)"><span>Бонусами</span><span>−${bonusUsed} ₽</span></div>` : ''}
        <div class="row-between" style="margin:4px 0;font-size:13px;color:var(--ink-soft)">
          <span>Доставка${deliveryCost === 0 ? ' 🎉' : ''}</span><span>${deliveryCost === 0 ? 'Бесплатно' : deliveryCost + ' ₽'}</span>
        </div>
        ${deliveryCost > 0 ? `<div style="font-size:11px;color:var(--ink-soft);margin-bottom:4px">Бесплатная доставка от 1500 ₽ товаров</div>` : ''}
        <div class="row-between" style="margin:8px 0 16px;">
          <strong>К оплате</strong>
          <span class="price-tag">${payable} ₽</span>
        </div>

        ${!state.user ? `<div class="empty-state"><h3>Нужен вход через Telegram</h3></div>` :
          limitReached ? `<div class="limit-banner">У вас уже 3 активных заказа — это максимум одновременно. Дождитесь выполнения или отмените один из текущих заказов в истории покупок в профиле.</div>` :
          !complete ? `
            <div class="profile-incomplete">Перед оформлением заказа заполните имя, фамилию и телефон в профиле.</div>
            <button class="btn btn-primary btn-block" data-action="go-to-profile">Заполнить профиль</button>
          ` : `
            <div class="checkout-readonly">
              <span>${state.user.first_name} ${state.user.last_name} · ${state.user.phone}</span>
              <a data-action="go-to-profile" href="#">изменить</a>
            </div>
            <div class="field"><label>Адрес доставки</label><textarea id="checkout-address" placeholder="Город, улица, дом, квартира">${state.user.address || ''}</textarea></div>
            <div class="field"><label>Комментарий к заказу</label><textarea id="checkout-comment" placeholder="Необязательно"></textarea></div>
            <button class="btn btn-amber btn-block" data-action="checkout">Оформить заказ</button>
          `
        }
      `}
    </div>
  `;
}

// ================= ЗАКАЗЫ (покупатель) =================
function renderOrders() {
  return `
    <div class="topbar"><div><div class="eyebrow">Мои заказы</div><h1>Заказы</h1></div></div>
    <div class="section">
      ${!state.user ? `<div class="empty-state"><h3>Нужен вход через Telegram</h3></div>` :
        state.orders.length === 0 ? `<div class="empty-state"><h3>Заказов пока нет</h3></div>` :
        state.orders.map(o => `
          <div class="list-item order-card" data-open-order="${o.id}">
            <div class="row-between">
              <strong>Заказ №${o.id}</strong>
              <span class="status-badge status-${o.status}">${STATUS_LABELS[o.status]}</span>
            </div>
            <div style="font-size:13px;margin:8px 0;color:var(--ink-soft)">${o.items.map(i => `${i.name} × ${i.qty}`).join(', ')}</div>
            <div class="row-between"><span class="price-tag">${o.payable_total ?? o.total} ₽</span>${o.paid ? `<span class="paid-badge">Оплачено</span>` : ''}</div>
          </div>
        `).join('')
      }
    </div>
  `;
}

function orderItemsHtml(o) {
  return `
    <div class="list-item" style="margin-top:14px">
      ${o.items.map(i => {
        const product = state.products.find(p => p.id === i.product_id);
        return `
        <div class="cart-line-thumb" style="padding:8px 0;border-bottom:1px solid var(--line)">
          ${thumbHtml(product?.image_url, 'thumb')}
          <div style="flex:1">
            <div style="font-weight:600;font-size:14px">${i.name}</div>
            <div style="font-size:12px;color:var(--ink-soft)">${i.qty} × ${i.price} ₽</div>
          </div>
          <div class="price-tag">${i.qty * i.price} ₽</div>
        </div>
      `;}).join('')}
    </div>
  `;
}

function openOrderDetailModal(order) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  function drawView() {
    backdrop.innerHTML = `
      <div class="modal-sheet">
        <h3>Заказ №${order.id}</h3>
        <span class="status-badge status-${order.status}">${STATUS_LABELS[order.status]}</span>
        ${orderItemsHtml(order)}
        <div class="row-between" style="margin:12px 0"><strong>Итого к оплате</strong><span class="price-tag">${order.payable_total ?? order.total} ₽</span></div>
        <div class="field"><label>Адрес доставки</label><div style="font-size:14px">${order.address || '—'}</div></div>
        ${order.comment ? `<div class="field"><label>Комментарий</label><div style="font-size:14px">${order.comment}</div></div>` : ''}
        ${order.status === 'new' || order.status === 'processing' ? `
          <div class="order-actions">
            <button class="btn btn-ghost" id="od-edit">Редактировать</button>
            <button class="btn btn-danger" id="od-cancel">Удалить заказ</button>
          </div>
        ` : ''}
        <button class="btn btn-primary btn-block" id="od-close" style="margin-top:10px">Закрыть</button>
      </div>
    `;
    backdrop.querySelector('#od-close').onclick = () => backdrop.remove();
    if (order.status === 'processing') {
      backdrop.querySelector('#od-edit').onclick = () => drawEdit();
      backdrop.querySelector('#od-cancel').onclick = async () => {
        if (!confirm('Удалить этот заказ?')) return;
        try {
          await api(`/api/orders/${order.id}`, { method: 'DELETE' });
          backdrop.remove();
          toast('Заказ удалён');
          await loadOrders();
          await refreshMyActiveOrders();
          render();
        } catch (e) { toast('Не удалось удалить заказ'); }
      };
    }
  }

  function drawEdit() {
    const editItems = order.items.map(i => ({ ...i }));
    function total() { return editItems.reduce((s, i) => s + i.price * i.qty, 0); }
    function drawEditInner() {
      backdrop.innerHTML = `
        <div class="modal-sheet">
          <h3>Редактировать заказ №${order.id}</h3>
          <div class="list-item" style="margin-top:10px">
            ${editItems.map((i, idx) => {
              const product = state.products.find(p => p.id === i.product_id);
              const maxQty = product ? product.stock : i.qty;
              return `
                <div class="cart-line-thumb" style="padding:8px 0;border-bottom:1px solid var(--line)">
                  ${thumbHtml(product?.image_url, 'thumb')}
                  <div style="flex:1">
                    <div style="font-weight:600;font-size:14px">${i.name}</div>
                    <div style="font-size:12px;color:var(--ink-soft)">${i.price} ₽ / шт.</div>
                  </div>
                  <div class="qty-control">
                    <button data-edit-dec="${idx}">−</button>
                    <span>${i.qty}</span>
                    <button data-edit-inc="${idx}" ${i.qty >= maxQty ? 'disabled' : ''}>+</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
          <div class="row-between" style="margin:12px 0"><strong>Сумма</strong><span class="price-tag">${total()} ₽</span></div>
          <div class="field"><label>Адрес доставки</label><textarea id="oe-address">${order.address || ''}</textarea></div>
          <div class="field"><label>Комментарий</label><textarea id="oe-comment">${order.comment || ''}</textarea></div>
          <button class="btn btn-primary btn-block" id="oe-save">Сохранить изменения</button>
          <button class="btn btn-ghost btn-block" id="oe-cancel" style="margin-top:8px">Отмена</button>
        </div>
      `;
      backdrop.querySelectorAll('[data-edit-dec]').forEach(btn => {
        btn.onclick = () => { const idx = Number(btn.dataset.editDec); if (editItems[idx].qty > 1) { editItems[idx].qty--; drawEditInner(); } };
      });
      backdrop.querySelectorAll('[data-edit-inc]').forEach(btn => {
        btn.onclick = () => {
          const idx = Number(btn.dataset.editInc);
          const product = state.products.find(p => p.id === editItems[idx].product_id);
          if (!product || editItems[idx].qty < product.stock) { editItems[idx].qty++; drawEditInner(); }
        };
      });
      backdrop.querySelector('#oe-cancel').onclick = () => drawView();
      backdrop.querySelector('#oe-save').onclick = async () => {
        const address = document.getElementById('oe-address').value.trim();
        const comment = document.getElementById('oe-comment').value.trim();
        if (!address) { toast('Укажите адрес доставки'); return; }
        try {
          const updated = await api(`/api/orders/${order.id}`, {
            method: 'PUT', body: { items: editItems.map(i => ({ product_id: i.product_id, qty: i.qty })), address, comment }
          });
          Object.assign(order, updated);
          backdrop.remove();
          toast('Заказ обновлён');
          await loadOrders();
          render();
        } catch (e) { toast('Не удалось сохранить изменения'); }
      };
    }
    drawEditInner();
  }

  drawView();
  document.body.appendChild(backdrop);
}

// ================= ПРОФИЛЬ =================
const AVATAR_EMOJIS = ['🦊', '🐨', '🐼', '🦉', '🐢', '🦁', '🐯', '🐸', '🐙', '🦄', '🐳', '🦋'];
function avatarEmojiFor(telegramId) {
  const s = String(telegramId || '0');
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_EMOJIS[hash % AVATAR_EMOJIS.length];
}

function renderProfile() {
  if (!state.user) {
    return `<div class="topbar-centered"><h1>Профиль</h1></div><div class="empty-state"><h3>Откройте приложение в Telegram</h3></div>`;
  }
  const avatar = avatarEmojiFor(state.user.telegram_id);

  return `
    <div class="topbar-centered"><h1>Профиль</h1></div>
    <div class="profile-header">
      <div class="profile-header-inner">
        <div class="avatar-lg">${avatar}</div>
        <div class="pname">${state.user.first_name || 'Без имени'} ${state.user.last_name || ''}</div>
      </div>
      <button class="notif-bell" data-action="open-notifications">🔔${state.user.unreadNotifications > 0 ? `<span class="badge">${Math.min(state.user.unreadNotifications, 9)}</span>` : ''}</button>
      <button class="settings-gear" data-action="open-settings">⚙️</button>
    </div>
    <div class="section">
      ${state.isAdmin ? `
        <div class="mode-toggle">
          <div>
            <div class="txt">${state.viewAsClient ? 'Режим: обычный клиент' : 'Режим: администратор'}</div>
            <div class="sub">${state.viewAsClient ? 'Вы видите приложение так же, как покупатель' : 'Видны инструменты управления магазином'}</div>
          </div>
          <button class="btn ${state.viewAsClient ? 'btn-primary' : 'btn-ghost'}" data-action="toggle-view-mode">
            ${state.viewAsClient ? 'Вернуться в админку' : 'Смотреть как клиент'}
          </button>
        </div>
      ` : ''}
      ${renderBonusCard(state.user.bonus)}
      <button class="manage-action-btn" data-action="open-bonus-history"><span class="emoji">🎁</span> Бонусы: ${state.user.bonus.balance} ₽ — история</button>
      <button class="manage-action-btn" style="margin-top:8px" data-action="open-purchase-history"><span class="emoji">📦</span> История покупок</button>
      ${!profileComplete(state.user) ? `<div class="profile-incomplete" style="margin-top:14px">Заполните имя, фамилию и телефон в настройках (⚙️ вверху).</div>` : ''}
    </div>
  `;
}

function renderBonusCard(bonus, clickable = true) {
  if (!bonus) return '';
  const tierEmoji = { 'Бронзовый': '🥉', 'Серебряный': '🥈', 'Золотой': '🥇', 'Платиновый': '💎' };
  const progressPct = bonus.isMaxTier ? 100 : Math.min(100, Math.round((bonus.periodSpent / bonus.nextTierThreshold) * 100));
  return `
    <div class="bonus-card" ${clickable ? 'data-action="go-to-bonus-info" style="cursor:pointer"' : ''}>
      <div class="row-between">
        <span class="tier-badge">${tierEmoji[bonus.tier] || ''} ${bonus.tier}</span>
        <span class="bonus-balance">${bonus.balance} ₽ бонусов</span>
      </div>
      <div class="bonus-tier-name" style="margin-top:10px">Кэшбек ${Math.round(bonus.rate * 100)}%</div>
      <div class="bonus-progress-track"><div class="bonus-progress-fill" style="width:${progressPct}%"></div></div>
      <div class="bonus-progress-label">
        ${bonus.isMaxTier ? 'Максимальный уровень достигнут' : `${bonus.periodSpent} ₽ из ${bonus.nextTierThreshold} ₽ за текущие полгода — до следующего уровня`}
      </div>
    </div>
  `;
}

async function openNotificationsModal() {
  const data = await api('/api/profile/notifications');
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal-sheet">
      <h3>Уведомления</h3>
      ${data.items.length === 0 ? `<div class="empty-state"><h3>Пока пусто</h3></div>` :
        data.items.map(n => `
          <div class="notif-item ${n.read ? '' : 'unread'}" data-notif-id="${n.id}" data-notif-order="${n.meta?.order_id || ''}">
            <div class="title">${n.title}</div>
            <div class="body">${n.body}</div>
            <div class="date">${fmtDate(n.created_at)}</div>
          </div>
        `).join('')
      }
      <button class="btn btn-ghost btn-block" id="notif-close" style="margin-top:10px">Закрыть</button>
    </div>
  `;
  backdrop.querySelector('#notif-close').onclick = () => backdrop.remove();
  backdrop.querySelectorAll('[data-notif-order]').forEach(el => {
    if (el.dataset.notifOrder) {
      el.onclick = () => { backdrop.remove(); openReviewForm(Number(el.dataset.notifOrder)); };
    }
  });
  document.body.appendChild(backdrop);
  if (data.unread > 0) {
    await api('/api/profile/notifications/read-all', { method: 'POST' });
    if (state.user) state.user.unreadNotifications = 0;
  }
}

function openReviewForm(orderId) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const ratings = { product_quality: 8, service_quality: 8, delivery_speed: 8 };

  function draw() {
    backdrop.innerHTML = `
      <div class="modal-sheet">
        <h3>⭐ Оценить заказ №${orderId}</h3>
        <p style="font-size:13px;color:var(--ink-soft);margin-top:-6px">За отзыв начислим 50 бонусов на ваш счёт.</p>

        <div class="field">
          <label>Качество товара: <strong id="val-product">${ratings.product_quality}</strong>/10</label>
          <input type="range" min="1" max="10" id="rate-product" value="${ratings.product_quality}" style="width:100%" />
        </div>
        <div class="field">
          <label>Качество обслуживания: <strong id="val-service">${ratings.service_quality}</strong>/10</label>
          <input type="range" min="1" max="10" id="rate-service" value="${ratings.service_quality}" style="width:100%" />
        </div>
        <div class="field">
          <label>Скорость доставки: <strong id="val-delivery">${ratings.delivery_speed}</strong>/10</label>
          <input type="range" min="1" max="10" id="rate-delivery" value="${ratings.delivery_speed}" style="width:100%" />
        </div>
        <div class="field"><label>Комментарий (необязательно)</label><textarea id="review-text" placeholder="Расскажите, как всё прошло..."></textarea></div>
        <label class="row-between" style="padding:10px 0;cursor:pointer">
          <span>Опубликовать анонимно</span>
          <input type="checkbox" id="review-anonymous" />
        </label>
        <button class="btn btn-primary btn-block" id="review-submit">Отправить отзыв</button>
        <button class="btn btn-ghost btn-block" id="review-cancel" style="margin-top:8px">Отмена</button>
      </div>
    `;
    // Значения ползунков обновляем точечно (без перерисовки всей модалки), чтобы не прерывать drag
    backdrop.querySelector('#rate-product').oninput = (e) => { ratings.product_quality = Number(e.target.value); backdrop.querySelector('#val-product').textContent = e.target.value; };
    backdrop.querySelector('#rate-service').oninput = (e) => { ratings.service_quality = Number(e.target.value); backdrop.querySelector('#val-service').textContent = e.target.value; };
    backdrop.querySelector('#rate-delivery').oninput = (e) => { ratings.delivery_speed = Number(e.target.value); backdrop.querySelector('#val-delivery').textContent = e.target.value; };
    backdrop.querySelector('#review-cancel').onclick = () => backdrop.remove();
    backdrop.querySelector('#review-submit').onclick = async () => {
      const text = document.getElementById('review-text').value.trim();
      const anonymous = document.getElementById('review-anonymous').checked;
      try {
        await api(`/api/orders/${orderId}/review`, { method: 'POST', body: { ...ratings, text, anonymous } });
        backdrop.remove();
        toast('Спасибо за отзыв! Начислено 50 бонусов 🎉');
        state.user = await api('/api/profile/me');
        render();
      } catch (e) {
        if (e.message === 'already_reviewed') toast('Вы уже оставляли отзыв на этот заказ');
        else toast('Не удалось отправить отзыв');
      }
    };
  }
  draw();
  document.body.appendChild(backdrop);
}

async function openBonusHistoryModal() {
  const history = await api('/api/profile/bonus-history');
  const STATUS_TXT = { active: 'Активен', spent: 'Списание', expired: 'Сгорел', used: 'Использован', revoked: 'Аннулирован' };
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal-sheet">
      <h3>История бонусов</h3>
      ${history.length === 0 ? `<div class="empty-state"><h3>Пока пусто</h3></div>` :
        history.map(t => `
          <div class="ledger-entry">
            <div>
              <div class="desc">${t.label}</div>
              <div class="date">${fmtDate(t.created_at)} · ${STATUS_TXT[t.status] || t.status}${t.type !== 'redeem' && t.status === 'active' ? ` · до ${fmtDate(t.expires_at)}` : ''}</div>
            </div>
            <div class="amt ${t.type === 'redeem' ? 'expense' : 'income'}">${t.type === 'redeem' ? '−' : '+'}${t.amount} ₽</div>
          </div>
        `).join('')
      }
      <button class="btn btn-ghost btn-block" id="bh-close" style="margin-top:10px">Закрыть</button>
    </div>
  `;
  backdrop.querySelector('#bh-close').onclick = () => backdrop.remove();
  document.body.appendChild(backdrop);
}

async function openPurchaseHistoryModal() {
  const orders = await api('/api/orders/my');
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal-sheet">
      <h3>История покупок</h3>
      ${orders.length === 0 ? `<div class="empty-state"><h3>Заказов пока нет</h3></div>` :
        orders.map(o => `
          <div class="list-item">
            <div class="row-between"><strong>Заказ №${o.id}</strong><span class="status-badge status-${o.status}">${STATUS_LABELS[o.status]}</span></div>
            <div style="font-size:12px;color:var(--ink-soft);margin:6px 0">${o.items.map(i => `${i.name} × ${i.qty}`).join(', ')}</div>
            <div class="row-between"><span class="price-tag">${o.payable_total ?? o.total} ₽</span>${o.paid ? `<span class="paid-badge">Оплачено</span>` : ''}</div>
          </div>
        `).join('')
      }
      <button class="btn btn-ghost btn-block" id="ph-close" style="margin-top:10px">Закрыть</button>
    </div>
  `;
  backdrop.querySelector('#ph-close').onclick = () => backdrop.remove();
  document.body.appendChild(backdrop);
}

function openSettingsModal() {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const u = state.user;
  const cooldown = clientCooldownCheck(u);
  backdrop.innerHTML = `
    <div class="modal-sheet">
      <h3>Настройки профиля</h3>
      <div class="field"><label>Имя</label><input id="s-first-name" value="${u.first_name || ''}" /></div>
      <div class="field"><label>Фамилия</label><input id="s-last-name" value="${u.last_name || ''}" /></div>
      <div class="field"><label>Телефон</label><input id="s-phone" type="tel" value="${u.phone || ''}" placeholder="+7 900 000-00-00" /></div>
      <div class="field">
        <label>Дата рождения</label>
        <input id="s-birth" type="date" value="${u.birth_date || ''}" ${cooldown.blocked ? 'disabled' : ''} />
        ${cooldown.blocked ? `<div style="font-size:11px;color:var(--amber-dark);margin-top:4px">Дату рождения можно менять раз в 6 месяцев. Следующее изменение — ${cooldown.nextDateStr}.</div>` : ''}
      </div>
      <button class="btn btn-primary btn-block" id="s-save">Сохранить</button>
      <button class="btn btn-ghost btn-block" id="s-cancel" style="margin-top:8px">Отмена</button>
    </div>
  `;
  document.body.appendChild(backdrop);
  attachPhoneMask(backdrop.querySelector('#s-phone'));
  backdrop.querySelector('#s-cancel').onclick = () => backdrop.remove();
  backdrop.querySelector('#s-save').onclick = async () => {
    const first_name = document.getElementById('s-first-name').value.trim();
    const last_name = document.getElementById('s-last-name').value.trim();
    const phone = document.getElementById('s-phone').value.trim();
    const birthInput = document.getElementById('s-birth');
    const birth_date = birthInput.disabled ? u.birth_date : birthInput.value;
    if (!first_name || !last_name || !phone) { toast('Заполните имя, фамилию и телефон'); return; }
    try {
      state.user = await api('/api/profile/me', { method: 'PUT', body: { first_name, last_name, phone, birth_date } });
      backdrop.remove();
      toast('Профиль обновлён');
      render();
    } catch (e) { toast('Дату рождения пока менять нельзя (раз в 6 месяцев)'); }
  };
}

function clientCooldownCheck(u) {
  if (!u.birth_date_updated_at) return { blocked: false };
  const last = new Date(u.birth_date_updated_at);
  const nextAllowed = new Date(last);
  nextAllowed.setMonth(nextAllowed.getMonth() + 6);
  if (new Date() < nextAllowed) return { blocked: true, nextDateStr: nextAllowed.toLocaleDateString('ru-RU') };
  return { blocked: false };
}

// ================= УПРАВЛЕНИЕ =================
const MANAGE_TILES = [
  { id: 'catalog', label: 'Каталог', emoji: '📦' },
  { id: 'orders', label: 'Заказы', emoji: '🧾' },
  { id: 'users', label: 'Пользователи', emoji: '👥' },
  { id: 'ledger', label: 'Бухгалтерия', emoji: '💰' },
  { id: 'stats', label: 'Статистика', emoji: '📊' },
];

function renderManage() {
  if (!state.manageSection) {
    return `
      <div class="topbar"><div><div class="eyebrow">Админ-панель</div><h1>Управление</h1></div></div>
      <div class="manage-menu">
        ${MANAGE_TILES.map(t => `
          <div class="manage-menu-tile" data-manage-section="${t.id}">
            <div class="emoji">${t.emoji}</div>
            <div class="name">${t.label}</div>
          </div>
        `).join('')}
      </div>
      <div class="section" style="padding-top:0">
        <button class="btn btn-ghost btn-block" data-action="exit-admin-mode">🚪 Выйти из режима администратора</button>
      </div>
    `;
  }
  const title = MANAGE_TILES.find(t => t.id === state.manageSection)?.label || '';
  let inner = '';
  if (state.manageSection === 'catalog') inner = renderManageCatalog();
  else if (state.manageSection === 'orders') inner = renderManageOrders();
  else if (state.manageSection === 'users') inner = renderManageUsers();
  else if (state.manageSection === 'ledger') inner = renderManageLedger();
  else if (state.manageSection === 'stats') inner = renderManageStats();

  return `
    <div class="topbar"><div><div class="eyebrow">Управление</div><h1>${title}</h1></div></div>
    <div class="back-row" data-action="back-to-manage-menu">← Все разделы</div>
    ${inner}
  `;
}

// ---- Управление: Каталог ----
function renderManageCatalog() {
  if (state.manageCatalogView === 'list') {
    const bySection = {};
    state.products.forEach(p => { const sec = p.section || 'Без раздела'; bySection[sec] = bySection[sec] || []; bySection[sec].push(p); });
    return `
      <div class="back-row" data-action="back-to-catalog-menu">← Меню каталога</div>
      ${Object.entries(bySection).map(([sec, items]) => `
        <div class="manage-group-title">${sec}</div>
        ${items.map(p => `
          <div class="manage-row" data-open-manage-product="${p.id}" style="${p.active ? '' : 'opacity:0.5'}">
            ${thumbHtml(p.image_url, 'thumb')}
            <div class="info">
              <div class="n">${p.name}</div>
              <div class="m">${p.brand || '—'} · ост. ${p.stock} шт.</div>
              <div class="expiry-tag ${isExpirySoon(p.nearestExpiry) ? 'expiry-soon' : ''}">Годен до: ${p.nearestExpiry ? fmtDate(p.nearestExpiry) : '—'}</div>
            </div>
          </div>
        `).join('')}
      `).join('') || `<div class="empty-state"><h3>Товаров пока нет</h3></div>`}
    `;
  }
  return `
    <div class="manage-actions-list">
      <button class="manage-action-btn" data-action="mc-add-product"><span class="emoji">➕</span> Добавить новый товар</button>
      <button class="manage-action-btn" data-action="mc-add-stock"><span class="emoji">📥</span> Добавить товар на склад</button>
      <button class="manage-action-btn" data-action="mc-remove-stock"><span class="emoji">📤</span> Удалить товар со склада</button>
      <button class="manage-action-btn" data-action="mc-list"><span class="emoji">📋</span> Список товаров</button>
    </div>
  `;
}

function isExpirySoon(dateStr) {
  if (!dateStr) return false;
  const days = (new Date(dateStr) - new Date()) / 86400000;
  return days < 30;
}

// ---- Управление: Заказы ----
function renderManageOrders() {
  const counts = { processing: 0, delivering: 0, completed: 0 };
  state.orders.forEach(o => { if (counts[o.status] !== undefined) counts[o.status]++; });
  const tabs = [
    { id: 'processing', label: 'В обработке' },
    { id: 'delivering', label: 'Доставляем' },
    { id: 'completed', label: 'Выполненные' },
  ];
  const list = state.orders.filter(o => o.status === state.manageOrdersTab);
  return `
    <div class="order-status-tiles">
      ${tabs.map(t => `
        <div class="order-status-tile ${state.manageOrdersTab === t.id ? 'active' : ''}" data-manage-orders-tab="${t.id}">
          <div class="num">${counts[t.id]}</div><div class="lbl">${t.label}</div>
        </div>
      `).join('')}
    </div>
    <div class="section">
      ${list.length === 0 ? `<div class="empty-state"><h3>Заказов нет</h3></div>` :
        list.map(o => `
          <div class="list-item order-card" data-open-manage-order="${o.id}">
            <div class="row-between">
              <strong>Заказ №${o.id}</strong>
              ${o.paid ? `<span class="paid-badge">Оплачено</span>` : ''}
            </div>
            <div style="font-size:12px;color:var(--ink-soft);margin-top:4px">${o.first_name || ''} ${o.last_name || ''} · @${o.username || '—'} · ${o.phone || '—'}${o.buyer_note ? ` · 📝 ${o.buyer_note}` : ''}</div>
            <div style="font-size:13px;margin:8px 0;color:var(--ink-soft)">${o.items.map(i => `${i.name} × ${i.qty}`).join(', ')}</div>
            <div class="row-between"><span class="price-tag">${o.payable_total ?? o.total} ₽</span></div>
          </div>
        `).join('')
      }
    </div>
  `;
}

function openManageOrderDetailModal(order) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  function draw() {
    let actionsHtml = '';
    if (order.status === 'processing') {
      actionsHtml = `
        <div class="field"><label>Время и место доставки (обязательно)</label><textarea id="mo-admin-comment" placeholder="напр. Вторник, 18:00, у подъезда"></textarea></div>
        <button class="btn btn-amber btn-block" id="mo-deliver">В доставку</button>
      `;
    } else if (order.status === 'delivering') {
      actionsHtml = `
        <div class="field"><label>Комментарий администратора (время/место доставки)</label><div style="font-size:14px">${order.admin_comment || '—'}</div></div>
        <div class="order-actions">
          <button class="btn btn-primary" id="mo-complete">Доставлен</button>
          <button class="btn ${order.paid ? 'btn-primary' : 'btn-ghost'}" id="mo-paid">${order.paid ? 'Оплачено ✓' : 'Оплачен'}</button>
        </div>
        <button class="btn btn-danger btn-block" id="mo-cancel" style="margin-top:8px">Отменить заказ</button>
      `;
    } else if (order.status === 'completed') {
      actionsHtml = `
        <div class="field"><label>Комментарий администратора</label><div style="font-size:14px">${order.admin_comment || '—'}</div></div>
        <div class="row-between" style="margin-top:8px">
          <span style="font-size:13px;color:var(--ink-soft)">Оплата</span>
          ${order.paid ? `<span class="paid-badge">Оплачено</span>` : `<button class="btn btn-ghost" id="mo-paid">Отметить оплаченным</button>`}
        </div>
        <button class="btn btn-danger btn-block" id="mo-delete-completed" style="margin-top:12px">Удалить заказ</button>
        <div style="font-size:11px;color:var(--ink-soft);margin-top:6px">Товар вернётся на склад, начисленные бонусы и сумма в бухгалтерии за этот заказ будут отменены</div>
      `;
    }

    backdrop.innerHTML = `
      <div class="modal-sheet">
        <h3>Заказ №${order.id}</h3>
        <span class="status-badge status-${order.status}">${STATUS_LABELS[order.status]}</span>
        <div class="field" style="margin-top:10px"><label>Покупатель</label><div style="font-size:14px">${order.first_name || ''} ${order.last_name || ''} · @${order.username || '—'} (id ${order.telegram_id})${order.buyer_note ? `<br>📝 ${order.buyer_note}` : ''}</div></div>
        <div class="field"><label>Телефон</label><div style="font-size:14px">${order.phone || '—'}</div></div>
        ${orderItemsHtml(order)}
        <div class="row-between" style="margin:12px 0"><strong>Итого к оплате</strong><span class="price-tag">${order.payable_total ?? order.total} ₽</span></div>
        <div class="field"><label>Адрес доставки</label><div style="font-size:14px">${order.address || '—'}</div></div>
        <div class="field"><label>Комментарий покупателя</label><div style="font-size:14px">${order.comment || '—'}</div></div>
        ${actionsHtml}
        <button class="btn btn-ghost btn-block" id="mo-close" style="margin-top:10px">Закрыть</button>
      </div>
    `;
    backdrop.querySelector('#mo-close').onclick = () => backdrop.remove();

    const deliverBtn = backdrop.querySelector('#mo-deliver');
    if (deliverBtn) deliverBtn.onclick = async () => {
      const comment = document.getElementById('mo-admin-comment').value.trim();
      if (!comment) { toast('Укажите время и место доставки'); return; }
      if (!confirm('Отправить заказ в доставку?')) return;
      try {
        await api(`/api/orders/${order.id}/deliver`, { method: 'PUT', body: { admin_comment: comment } });
        backdrop.remove();
        toast('Заказ передан в доставку');
        await loadOrders(); render();
      } catch (e) { toast('Не удалось обновить заказ'); }
    };
    const completeBtn = backdrop.querySelector('#mo-complete');
    if (completeBtn) completeBtn.onclick = async () => {
      if (!confirm('Отметить заказ как доставленный?')) return;
      try {
        await api(`/api/orders/${order.id}/complete`, { method: 'PUT' });
        backdrop.remove();
        toast('Заказ выполнен, сумма добавлена в бухгалтерию');
        await loadOrders(); render();
      } catch (e) { toast('Не удалось обновить заказ'); }
    };
    const paidBtn = backdrop.querySelector('#mo-paid');
    if (paidBtn) paidBtn.onclick = async () => {
      const willBePaid = !order.paid;
      if (!confirm(willBePaid ? 'Отметить заказ как оплаченный?' : 'Снять отметку об оплате?')) return;
      try {
        const updated = await api(`/api/orders/${order.id}/paid`, { method: 'PUT', body: { paid: willBePaid } });
        Object.assign(order, updated);
        draw();
        await loadOrders(); render();
        toast(order.paid ? 'Отмечено как оплачено' : 'Отметка снята');
      } catch (e) { toast('Не удалось обновить оплату'); }
    };
    const cancelBtn = backdrop.querySelector('#mo-cancel');
    if (cancelBtn) cancelBtn.onclick = async () => {
      if (!confirm('Отменить этот заказ? Товар вернётся на склад.')) return;
      try {
        await api(`/api/orders/${order.id}`, { method: 'DELETE' });
        backdrop.remove();
        toast('Заказ отменён, товар возвращён на склад');
        await loadOrders(); render();
      } catch (e) { toast('Не удалось отменить заказ'); }
    };
    const deleteCompletedBtn = backdrop.querySelector('#mo-delete-completed');
    if (deleteCompletedBtn) deleteCompletedBtn.onclick = async () => {
      if (!confirm('Удалить этот выполненный заказ? Товар вернётся на склад, бонусы и сумма в бухгалтерии за него будут отменены.')) return;
      try {
        await api(`/api/orders/${order.id}`, { method: 'DELETE' });
        backdrop.remove();
        toast('Заказ удалён, склад и бухгалтерия скорректированы');
        await loadOrders(); render();
      } catch (e) { toast('Не удалось удалить заказ'); }
    };
  }
  draw();
  document.body.appendChild(backdrop);
}

// ---- Управление: Пользователи ----
function renderManageUsers() {
  return state.usersData.length === 0 ? `<div class="empty-state"><h3>Пользователей пока нет</h3></div>` :
    state.usersData.map(u => `
      <div class="user-row" data-open-user="${u.id}">
        <div>
          <div class="n">${u.first_name || 'Без имени'} ${u.last_name || ''}</div>
          <div class="m">@${u.username || '—'}${u.admin_note ? ` · 📝 ${u.admin_note}` : ''}</div>
        </div>
        <div class="price-tag">${u.stats.totalSpent} ₽</div>
      </div>
    `).join('');
}

async function openUserDetailModal(userId) {
  const u = await api(`/api/users/${userId}`);
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  let noteEditing = false;

  function draw() {
    backdrop.innerHTML = `
      <div class="modal-sheet">
        <h3>${u.first_name || ''} ${u.last_name || ''}</h3>
        <div class="field"><label>Telegram ID</label><div style="font-size:14px">${u.telegram_id}</div></div>
        <div class="field"><label>Username</label><div style="font-size:14px">@${u.username || '—'}</div></div>
        <div class="field"><label>Телефон</label><div style="font-size:14px">${u.phone || '—'}</div></div>
        <div class="field"><label>Дата рождения</label><div style="font-size:14px">${u.birth_date ? fmtDate(u.birth_date) : '—'}</div></div>

        <div class="field">
          <label>📝 Заметка администратора (видна только вам)</label>
          ${noteEditing ? `
            <input id="ud-note-input" value="${u.admin_note || ''}" placeholder="напр. Постоянный клиент, любит скидки" />
            <div class="order-actions" style="margin-top:8px">
              <button class="btn btn-primary" id="ud-note-save">Сохранить</button>
              <button class="btn btn-ghost" id="ud-note-cancel">Отмена</button>
            </div>
          ` : `
            <div class="row-between">
              <span style="font-size:14px">${u.admin_note || 'Не указана'}</span>
              <div style="display:flex;gap:6px">
                <button class="icon-btn" id="ud-note-edit">✏️</button>
                ${u.admin_note ? `<button class="icon-btn" id="ud-note-delete">🗑</button>` : ''}
              </div>
            </div>
          `}
        </div>

        <div class="stats-row">
          <div class="stat-box"><div class="num">${u.stats.ordersCount}</div><div class="lbl">Заказов</div></div>
          <div class="stat-box"><div class="num">${u.stats.totalSpent} ₽</div><div class="lbl">Потрачено</div></div>
        </div>
        ${renderBonusCard(u.bonus)}
        <button class="btn btn-primary btn-block" id="ud-add-order">➕ Добавить выполненный заказ вручную</button>
        <div class="manage-group-title" style="padding-left:0">История заказов</div>
        ${u.orders.length === 0 ? `<div style="font-size:13px;color:var(--ink-soft)">Заказов пока нет</div>` :
          u.orders.map(o => `
            <div class="list-item">
              <div class="row-between"><strong>Заказ №${o.id}</strong><span class="status-badge status-${o.status}">${STATUS_LABELS[o.status]}</span></div>
              <div style="font-size:12px;color:var(--ink-soft);margin:6px 0">${o.items.map(i => `${i.name} × ${i.qty}`).join(', ')}</div>
              <div class="row-between">
                <span class="price-tag">${o.payable_total ?? o.total} ₽</span>
                <button class="btn btn-danger" style="padding:6px 12px;font-size:12px" data-delete-user-order="${o.id}">Удалить</button>
              </div>
            </div>
          `).join('')
        }
        <button class="btn btn-ghost btn-block" id="ud-close" style="margin-top:10px">Закрыть</button>
      </div>
    `;
    backdrop.querySelector('#ud-close').onclick = () => backdrop.remove();
    backdrop.querySelector('#ud-add-order').onclick = () => openManualOrderModal(u, () => reload());

    const noteEditBtn = backdrop.querySelector('#ud-note-edit');
    if (noteEditBtn) noteEditBtn.onclick = () => { noteEditing = true; draw(); };
    const noteCancelBtn = backdrop.querySelector('#ud-note-cancel');
    if (noteCancelBtn) noteCancelBtn.onclick = () => { noteEditing = false; draw(); };
    const noteSaveBtn = backdrop.querySelector('#ud-note-save');
    if (noteSaveBtn) noteSaveBtn.onclick = async () => {
      const note = document.getElementById('ud-note-input').value.trim();
      try {
        const result = await api(`/api/users/${u.id}/note`, { method: 'PUT', body: { note } });
        u.admin_note = result.admin_note;
        noteEditing = false;
        draw();
        await loadUsers();
        toast('Заметка сохранена');
      } catch (e) { toast('Не удалось сохранить заметку'); }
    };
    const noteDeleteBtn = backdrop.querySelector('#ud-note-delete');
    if (noteDeleteBtn) noteDeleteBtn.onclick = async () => {
      if (!confirm('Удалить заметку?')) return;
      try {
        await api(`/api/users/${u.id}/note`, { method: 'PUT', body: { note: '' } });
        u.admin_note = '';
        draw();
        await loadUsers();
        toast('Заметка удалена');
      } catch (e) { toast('Не удалось удалить заметку'); }
    };

    backdrop.querySelectorAll('[data-delete-user-order]').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Удалить этот заказ из истории покупателя? Если он был выполнен — товар вернётся на склад, а сумма уйдёт из бухгалтерии.')) return;
        try {
          await api(`/api/orders/${btn.dataset.deleteUserOrder}`, { method: 'DELETE' });
          toast('Заказ удалён');
          await reload();
        } catch (e) { toast('Не удалось удалить заказ'); }
      };
    });
  }

  async function reload() {
    const fresh = await api(`/api/users/${userId}`);
    Object.assign(u, fresh);
    draw();
    await loadUsers();
  }

  draw();
  document.body.appendChild(backdrop);
}

function openManualOrderModal(user, onDone) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const picked = {}; // product_id -> qty
  let descriptionValue = '';
  let discountValue = 0;

  function total() {
    return Object.entries(picked).reduce((sum, [id, qty]) => {
      const p = state.products.find(pr => pr.id === Number(id));
      return sum + (p ? p.price * qty : 0);
    }, 0);
  }

  function draw(filter = '') {
    const filtered = state.products.filter(p => p.active && p.name.toLowerCase().includes(filter.toLowerCase()));
    const subtotal = total();
    backdrop.innerHTML = `
      <div class="modal-sheet">
        <h3>Добавить выполненный заказ</h3>
        <p style="font-size:13px;color:var(--ink-soft);margin-top:-6px">Для продаж, оформленных не через бота — спишет склад и добавит сумму в бухгалтерию и бонусы клиента.</p>
        <div class="field"><input id="mo-search" placeholder="Поиск товара..." value="${filter}" /></div>
        <div style="max-height:240px;overflow-y:auto">
          ${filtered.map(p => `
            <div class="manage-row" style="cursor:default">
              <div class="info"><div class="n">${p.name}</div><div class="m">${p.brand || '—'} · ${p.price} ₽ · ост. ${p.stock}</div></div>
              <div class="qty-control">
                <button data-mo-dec="${p.id}">−</button>
                <span>${picked[p.id] || 0}</span>
                <button data-mo-inc="${p.id}" ${(picked[p.id] || 0) >= p.stock ? 'disabled' : ''}>+</button>
              </div>
            </div>
          `).join('') || `<div style="font-size:13px;color:var(--ink-soft);padding:10px 0">Ничего не найдено</div>`}
        </div>
        <div class="row-between" style="margin:12px 0"><strong>Сумма товаров</strong><span class="price-tag">${subtotal} ₽</span></div>
        <div class="field"><label>Скидка, ₽ (если давали покупателю)</label><input id="mo-discount" type="number" min="0" max="${subtotal}" value="${discountValue}" /></div>
        <div class="row-between" style="margin-bottom:12px"><strong>Итого к учёту</strong><span class="price-tag">${Math.max(0, subtotal - discountValue)} ₽</span></div>
        <div class="field"><label>Описание (необязательно)</label><input id="mo-description" placeholder="напр. Продано лично в зале" value="${descriptionValue}" /></div>
        <button class="btn btn-primary btn-block" id="mo-submit">Оформить</button>
        <button class="btn btn-ghost btn-block" id="mo-cancel-modal" style="margin-top:8px">Отмена</button>
      </div>
    `;
    const searchInput = backdrop.querySelector('#mo-search');
    searchInput.oninput = (e) => draw(e.target.value);
    searchInput.focus();
    searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);

    backdrop.querySelector('#mo-description').oninput = (e) => { descriptionValue = e.target.value; };
    backdrop.querySelector('#mo-discount').oninput = (e) => {
      discountValue = Math.max(0, Math.min(Number(e.target.value) || 0, subtotal));
    };

    backdrop.querySelectorAll('[data-mo-inc]').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.moInc;
        const p = state.products.find(pr => pr.id === Number(id));
        if ((picked[id] || 0) < p.stock) { picked[id] = (picked[id] || 0) + 1; draw(filter); }
      };
    });
    backdrop.querySelectorAll('[data-mo-dec]').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.moDec;
        if (picked[id] > 0) { picked[id]--; if (picked[id] === 0) delete picked[id]; draw(filter); }
      };
    });
    backdrop.querySelector('#mo-cancel-modal').onclick = () => backdrop.remove();
    backdrop.querySelector('#mo-submit').onclick = async () => {
      const items = Object.entries(picked).map(([id, qty]) => ({ product_id: Number(id), qty }));
      if (items.length === 0) { toast('Выберите хотя бы один товар'); return; }
      if (!confirm('Оформить выполненный заказ вручную?')) return;
      try {
        await api(`/api/users/${user.id}/manual-order`, { method: 'POST', body: { items, description: descriptionValue.trim(), discount: discountValue } });
        backdrop.remove();
        toast('Заказ добавлен');
        await loadProducts();
        if (onDone) await onDone();
      } catch (e) { toast('Не удалось оформить заказ'); }
    };
  }
  draw();
  document.body.appendChild(backdrop);
}

// ---- Управление: Бухгалтерия ----
function renderManageLedger() {
  const { balance, entries } = state.ledgerData;
  return `
    <div class="balance-card"><div class="num">${balance} ₽</div><div class="lbl">Текущий баланс</div></div>
    <div class="ledger-actions">
      <button class="btn btn-primary" data-action="ledger-income">Указать доход</button>
      <button class="btn btn-danger" data-action="ledger-expense">Указать расход</button>
    </div>
    <div class="manage-group-title">История</div>
    ${entries.length === 0 ? `<div class="empty-state"><h3>Записей пока нет</h3></div>` :
      entries.map(e => `
        <div class="ledger-entry">
          <div>
            <div class="desc">${e.description || (e.type === 'income' ? 'Доход' : 'Расход')}</div>
            <div class="date">${fmtDate(e.date)}${e.auto ? ' · авто' : ''}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <div class="amt ${e.type}">${e.type === 'income' ? '+' : '−'}${e.amount} ₽</div>
            <button class="icon-btn" data-action="delete-ledger-entry" data-id="${e.id}">🗑</button>
          </div>
        </div>
      `).join('')
    }
  `;
}

function openLedgerEntryModal(type) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const today = new Date().toISOString().slice(0, 10);
  backdrop.innerHTML = `
    <div class="modal-sheet">
      <h3>${type === 'income' ? 'Указать доход' : 'Указать расход'}</h3>
      <div class="field"><label>Сумма, ₽</label><input id="le-amount" type="number" /></div>
      <div class="field"><label>Описание</label><input id="le-description" placeholder="напр. Закупка товара" /></div>
      <div class="field"><label>Дата</label><input id="le-date" type="date" value="${today}" /></div>
      <button class="btn btn-primary btn-block" id="le-save">Сохранить</button>
      <button class="btn btn-ghost btn-block" id="le-cancel" style="margin-top:8px">Отмена</button>
    </div>
  `;
  document.body.appendChild(backdrop);
  backdrop.querySelector('#le-cancel').onclick = () => backdrop.remove();
  backdrop.querySelector('#le-save').onclick = async () => {
    const amount = Number(document.getElementById('le-amount').value);
    const description = document.getElementById('le-description').value.trim();
    const date = document.getElementById('le-date').value;
    if (!amount || amount <= 0) { toast('Укажите сумму'); return; }
    try {
      await api('/api/ledger', { method: 'POST', body: { type, amount, description, date } });
      backdrop.remove();
      await loadLedger();
      render();
      toast('Записано');
    } catch (e) { toast('Не удалось сохранить'); }
  };
}

// ---- Управление: Статистика ----
function renderManageStats() {
  const s = state.statsData;
  if (!s) return `<div class="empty-state"><h3>Загрузка...</h3></div>`;
  return `
    <div class="stats-grid">
      <div class="stat-box"><div class="num">${s.usersCount}</div><div class="lbl">Пользователей</div></div>
      <div class="stat-box"><div class="num">${s.productsCount}</div><div class="lbl">Товаров в каталоге</div></div>
      <div class="stat-box"><div class="num">${s.totalOrders}</div><div class="lbl">Всего заказов</div></div>
      <div class="stat-box"><div class="num">${s.totalRevenue} ₽</div><div class="lbl">Выручка (выполненные)</div></div>
      <div class="stat-box"><div class="num">${s.balance} ₽</div><div class="lbl">Баланс</div></div>
      <div class="stat-box"><div class="num">${s.ordersByStatus.processing + s.ordersByStatus.delivering}</div><div class="lbl">Активных заказов</div></div>
    </div>
    <div class="manage-group-title">Топ товаров по продажам</div>
    <div class="top-products-list">
      ${s.topProducts.length === 0 ? `<div style="font-size:13px;color:var(--ink-soft)">Пока нет выполненных заказов</div>` :
        s.topProducts.map(p => `<div class="top-product-row"><span>${p.name}</span><span>${p.qty} шт. · ${p.revenue} ₽</span></div>`).join('')
      }
    </div>
  `;
}

// ---- Модалка товара (создание/редактирование карточки) ----
function openProductModal(product) {
  const isEdit = !!product;
  const sections = [...new Set(state.products.map(p => p.section).filter(Boolean))];
  const categories = [...new Set(state.products.map(p => p.category).filter(Boolean))];
  const brands = [...new Set(state.products.map(p => p.brand).filter(Boolean))];

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal-sheet">
      <h3>${isEdit ? 'Редактировать товар' : 'Новый товар'}</h3>
      ${isEdit ? `
        <div class="image-upload-row">
          <div id="pf-image-preview">${product.image_url ? `<img src="${product.image_url}" class="image-upload-preview" alt="">` : `<div class="image-upload-ph">🌿</div>`}</div>
          <div style="flex:1;display:flex;flex-direction:column;gap:6px">
            <button type="button" class="btn btn-ghost" id="pf-upload-btn" style="font-size:13px">Загрузить фото</button>
            ${product.image_url ? `<button type="button" class="btn btn-ghost" id="pf-remove-image" style="font-size:13px;color:var(--danger)">Удалить фото</button>` : ''}
            <input type="file" id="pf-image-file" accept="image/*" style="display:none" />
          </div>
        </div>
      ` : `<div class="field"><label>Фото</label><div style="font-size:13px;color:var(--ink-soft)">Фото можно будет загрузить после создания товара — откройте его в «Список товаров»</div></div>`}
      <div class="field"><label>Название</label><input id="pf-name" value="${product?.name || ''}" /></div>
      <div class="field">
        <label>Производитель</label>
        <input id="pf-brand" list="dl-brands" value="${product?.brand || ''}" placeholder="напр. Maxler" />
        <datalist id="dl-brands">${brands.map(b => `<option value="${b}">`).join('')}</datalist>
      </div>
      <div class="field">
        <label>Раздел</label>
        <input id="pf-section" list="dl-sections" value="${product?.section || ''}" placeholder="БАДы / Спортпит" />
        <datalist id="dl-sections">${sections.map(s => `<option value="${s}">`).join('')}</datalist>
      </div>
      <div class="field">
        <label>Подраздел</label>
        <input id="pf-category" list="dl-categories" value="${product?.category || ''}" placeholder="напр. Витамины и минералы" />
        <datalist id="dl-categories">${categories.map(c => `<option value="${c}">`).join('')}</datalist>
      </div>
      <div class="field"><label>Описание</label><textarea id="pf-description">${product?.description || ''}</textarea></div>
      <div class="field"><label>Цена, ₽</label><input id="pf-price" type="number" value="${product?.price ?? ''}" /></div>
      ${isEdit ? `
        <div class="field"><label>Остаток на складе</label><div style="font-size:14px">${product.stock} шт. (меняется через «Добавить/Удалить на складе»)</div></div>
        <div class="field">
          <label>Статус</label>
          <select id="pf-active">
            <option value="1" ${product.active ? 'selected' : ''}>Активен (виден в каталоге)</option>
            <option value="0" ${!product.active ? 'selected' : ''}>Скрыт</option>
          </select>
        </div>
      ` : `<div class="field"><label>Остаток на складе</label><div style="font-size:13px;color:var(--ink-soft)">Новый товар стартует с 0 — пополните склад отдельно через «Добавить товар на склад»</div></div>`}
      <button class="btn btn-primary btn-block" id="pf-save">Сохранить</button>
      ${isEdit ? `<button class="btn btn-danger btn-block" id="pf-delete" style="margin-top:8px">Удалить товар</button>` : ''}
      <button class="btn btn-ghost btn-block" id="pf-cancel" style="margin-top:8px">Отмена</button>
    </div>
  `;
  document.body.appendChild(backdrop);

  if (isEdit) {
    const uploadBtn = backdrop.querySelector('#pf-upload-btn');
    const fileInput = backdrop.querySelector('#pf-image-file');
    uploadBtn.onclick = () => fileInput.click();
    fileInput.onchange = async () => {
      const file = fileInput.files[0];
      if (!file) return;
      try {
        const updated = await apiUploadFile(`/api/catalog/${product.id}/image`, file);
        product.image_url = updated.image_url;
        toast('Фото загружено');
        await loadProducts();
        backdrop.remove();
        openProductModal(state.products.find(p => p.id === product.id));
      } catch (e) { toast('Не удалось загрузить фото (проверьте формат и размер до 5МБ)'); }
    };
    const removeImageBtn = backdrop.querySelector('#pf-remove-image');
    if (removeImageBtn) {
      removeImageBtn.onclick = async () => {
        try {
          await api(`/api/catalog/${product.id}/image`, { method: 'DELETE' });
          toast('Фото удалено');
          await loadProducts();
          backdrop.remove();
          openProductModal(state.products.find(p => p.id === product.id));
        } catch (e) { toast('Не удалось удалить фото'); }
      };
    }
  }

  backdrop.querySelector('#pf-cancel').onclick = () => backdrop.remove();
  backdrop.querySelector('#pf-save').onclick = async () => {
    const payload = {
      name: backdrop.querySelector('#pf-name').value.trim(),
      section: backdrop.querySelector('#pf-section').value.trim(),
      category: backdrop.querySelector('#pf-category').value.trim(),
      brand: backdrop.querySelector('#pf-brand').value.trim(),
      description: backdrop.querySelector('#pf-description').value.trim(),
      price: Number(backdrop.querySelector('#pf-price').value),
    };
    if (!payload.name || !payload.price) { toast('Заполните название и цену'); return; }
    try {
      if (isEdit) {
        payload.active = backdrop.querySelector('#pf-active').value === '1';
        await api(`/api/catalog/${product.id}`, { method: 'PUT', body: payload });
      } else {
        await api('/api/catalog', { method: 'POST', body: payload });
      }
      backdrop.remove();
      await loadProducts();
      render();
      toast('Сохранено');
    } catch (e) { toast('Ошибка сохранения'); }
  };
  if (isEdit) {
    backdrop.querySelector('#pf-delete').onclick = async () => {
      if (!confirm('Скрыть товар из каталога?')) return;
      await api(`/api/catalog/${product.id}`, { method: 'DELETE' });
      backdrop.remove();
      await loadProducts();
      render();
      toast('Товар скрыт');
    };
  }
}

// ---- Пикер товара для добавления/списания склада ----
function openStockPickerModal(mode) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal-sheet">
      <h3>${mode === 'add' ? 'Выберите товар для пополнения' : 'Выберите товар для списания'}</h3>
      <div class="field"><input id="sp-search" placeholder="Поиск по названию..." /></div>
      <div id="sp-list"></div>
      <button class="btn btn-ghost btn-block" id="sp-cancel" style="margin-top:8px">Отмена</button>
    </div>
  `;
  document.body.appendChild(backdrop);

  function drawList(filter = '') {
    const filtered = state.products.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));
    backdrop.querySelector('#sp-list').innerHTML = filtered.map(p => `
      <div class="manage-row" data-pick-product="${p.id}" style="cursor:pointer">
        <div class="info"><div class="n">${p.name}</div><div class="m">${p.brand || '—'} · ост. ${p.stock} шт.</div></div>
      </div>
    `).join('') || `<div style="font-size:13px;color:var(--ink-soft);padding:10px 0">Ничего не найдено</div>`;
    backdrop.querySelectorAll('[data-pick-product]').forEach(row => {
      row.onclick = () => {
        const product = state.products.find(p => p.id === Number(row.dataset.pickProduct));
        backdrop.remove();
        openStockAdjustModal(product, mode);
      };
    });
  }
  drawList();
  backdrop.querySelector('#sp-search').oninput = (e) => drawList(e.target.value);
  backdrop.querySelector('#sp-cancel').onclick = () => backdrop.remove();
}

function openStockAdjustModal(product, mode) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal-sheet">
      <h3>${mode === 'add' ? 'Добавить на склад' : 'Списать со склада'}</h3>
      <div class="field"><label>Товар</label><div style="font-size:14px">${product.name} (сейчас на складе: ${product.stock} шт.)</div></div>
      <div class="field"><label>Количество, шт.</label><input id="sa-qty" type="number" min="1" /></div>
      ${mode === 'add' ? `<div class="field"><label>Срок годности</label><input id="sa-expiry" type="date" /></div>` : ''}
      <button class="btn btn-primary btn-block" id="sa-save">${mode === 'add' ? 'Добавить' : 'Списать'}</button>
      <button class="btn btn-ghost btn-block" id="sa-cancel" style="margin-top:8px">Отмена</button>
    </div>
  `;
  document.body.appendChild(backdrop);
  backdrop.querySelector('#sa-cancel').onclick = () => backdrop.remove();
  backdrop.querySelector('#sa-save').onclick = async () => {
    const qty = Number(document.getElementById('sa-qty').value);
    if (!qty || qty <= 0) { toast('Укажите количество'); return; }
    try {
      if (mode === 'add') {
        const expiry = document.getElementById('sa-expiry').value;
        if (!expiry) { toast('Укажите срок годности'); return; }
        await api(`/api/catalog/${product.id}/stock/add`, { method: 'POST', body: { qty, expiry } });
        toast('Товар добавлен на склад');
      } else {
        if (qty > product.stock) { toast('Нельзя списать больше, чем есть на складе'); return; }
        await api(`/api/catalog/${product.id}/stock/remove`, { method: 'POST', body: { qty } });
        toast('Товар списан со склада');
      }
      backdrop.remove();
      await loadProducts();
      render();
    } catch (e) { toast('Не удалось сохранить'); }
  };
}

// ---------- Обработчики событий ----------
function attachEvents() {
  app.querySelectorAll('[data-tab]').forEach(btn => {
    btn.onclick = async () => {
      state.view = btn.dataset.tab;
      if (state.view === 'manage') { state.manageSection = null; }
      if (state.view === 'cart' && state.user) await refreshMyActiveOrders();
      render();
    };
  });

  // Сервисы: переход к разделу
  app.querySelectorAll('[data-service]').forEach(tile => {
    tile.onclick = async () => {
      if (tile.dataset.service === 'consultant') {
        const link = `https://t.me/${state.botUsername}?start=assistant`;
        if (tg && tg.openTelegramLink) tg.openTelegramLink(link);
        else window.open(link, '_blank');
        return;
      }
      state.view = tile.dataset.service;
      if (state.view === 'catalog') { state.catalogStep = 'sections'; state.selectedSection = null; state.selectedSubcategory = null; state.selectedBrand = null; state.searchQuery = ''; }
      if (state.view === 'reviews') { await loadReviews(1); }
      if (state.view === 'reminders') { await loadReminders(); }
      render();
    };
  });
  app.querySelectorAll('[data-action="back-to-services"]').forEach(el => { el.onclick = () => { state.view = 'services'; render(); }; });
  const bonusInfoLink = app.querySelector('[data-action="go-to-bonus-info"]');
  if (bonusInfoLink) bonusInfoLink.onclick = () => { state.view = 'bonusInfo'; render(); };

  // Бот-консультант (живой чат с ИИ)
  const consultantStartBtn = app.querySelector('[data-action="consultant-start"]');
  if (consultantStartBtn) {
    consultantStartBtn.onclick = async () => {
      state.consultantStep = 'chat';
      state.consultantChat = { messages: [{ role: 'user', content: 'Здравствуйте! Помогите подобрать БАДы и спортпит под меня.', hidden: true }], loading: true, error: false };
      render();
      await sendConsultantChat();
    };
  }
  const consultantSendBtn = app.querySelector('#consultant-chat-send');
  const consultantInput = app.querySelector('#consultant-chat-input');
  async function submitConsultantInput() {
    const text = consultantInput.value.trim();
    if (!text) return;
    state.consultantChat.messages.push({ role: 'user', content: text });
    state.consultantChat.loading = true;
    state.consultantChat.error = false;
    render();
    await sendConsultantChat();
  }
  if (consultantSendBtn) consultantSendBtn.onclick = submitConsultantInput;
  if (consultantInput) {
    consultantInput.focus();
    consultantInput.onkeydown = (e) => { if (e.key === 'Enter') submitConsultantInput(); };
  }

  app.querySelectorAll('[data-consultant-toggle]').forEach(cb => {
    cb.onchange = () => { state.consultantSelected[cb.dataset.consultantToggle] = cb.checked; render(); };
  });
  const consultantAddBtn = app.querySelector('[data-action="consultant-add-to-cart"]');
  if (consultantAddBtn) {
    consultantAddBtn.onclick = async () => {
      const selected = state.consultantProducts.filter(p => state.consultantSelected[p.id] !== false);
      if (selected.length === 0) { toast('Выберите хотя бы один товар'); return; }
      if (!state.user) { toast('Откройте приложение в Telegram, чтобы сохранить подборку'); return; }
      try {
        await api('/api/consultant/session', { method: 'POST', body: { product_ids: selected.map(p => p.id) } });
        selected.forEach(p => { state.cart[p.id] = Math.min((state.cart[p.id] || 0) + 1, p.stock); });
        saveCart();
        state.consultantEligibleIds = selected.map(p => p.id);
        state.checkoutUseConsultant = true;
        toast('Добавлено в корзину со скидкой 10%');
        state.view = 'cart';
        render();
      } catch (e) { toast('Не удалось сохранить подборку'); }
    };
  }
  const consultantRestartBtn = app.querySelector('[data-action="consultant-restart"]');
  if (consultantRestartBtn) consultantRestartBtn.onclick = () => { state.consultantStep = 'intro'; state.consultantChat = { messages: [], loading: false, error: false }; render(); };

  const copyRefBtn = app.querySelector('[data-action="copy-ref-link"]');
  if (copyRefBtn) copyRefBtn.onclick = () => {
    const input = document.getElementById('ref-link');
    input.select();
    try { navigator.clipboard.writeText(input.value); toast('Ссылка скопирована'); }
    catch (e) { document.execCommand('copy'); toast('Ссылка скопирована'); }
  };
  const bonusHistoryBtn = app.querySelector('[data-action="open-bonus-history"]');
  if (bonusHistoryBtn) bonusHistoryBtn.onclick = () => openBonusHistoryModal();
  const purchaseHistoryBtn = app.querySelector('[data-action="open-purchase-history"]');
  if (purchaseHistoryBtn) purchaseHistoryBtn.onclick = () => openPurchaseHistoryModal();

  // Каталог
  app.querySelectorAll('[data-section]').forEach(tile => {
    tile.onclick = () => {
      state.selectedSection = tile.dataset.section;
      state.catalogStep = 'products';
      state.selectedSubcategory = null;
      state.selectedBrand = null;
      state.searchQuery = '';
      state.sortBy = 'default';
      render();
    };
  });
  const backToSections = app.querySelector('[data-action="back-to-sections"]');
  if (backToSections) backToSections.onclick = () => { state.catalogStep = 'sections'; state.selectedSection = null; render(); };
  const sortSelect = app.querySelector('[data-action="sort-select"]');
  if (sortSelect) sortSelect.onchange = () => { state.sortBy = sortSelect.value; render(); };
  const brandSelect = app.querySelector('[data-action="brand-select"]');
  if (brandSelect) brandSelect.onchange = () => { state.selectedBrand = brandSelect.value || null; render(); };
  const searchInput = app.querySelector('#catalog-search');
  if (searchInput) {
    searchInput.oninput = () => { state.searchQuery = searchInput.value; render(); searchInput.focus(); searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length); };
  }

  app.querySelectorAll('[data-open-product]').forEach(card => {
    card.onclick = () => { const product = state.products.find(p => p.id === Number(card.dataset.openProduct)); if (product) openProductDetailModal(product); };
  });
  app.querySelectorAll('[data-action="quick-add"]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const product = state.products.find(p => p.id === Number(btn.dataset.id));
      const current = state.cart[product.id] || 0;
      if (current >= product.stock) { toast('Достигнут максимум остатка'); return; }
      state.cart[product.id] = current + 1;
      saveCart(); toast('Добавлено в корзину'); render();
    };
  });

  // Корзина
  app.querySelectorAll('[data-action="inc"]').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      const product = state.products.find(p => p.id === Number(id));
      if ((state.cart[id] || 0) >= product.stock) { toast('Достигнут максимум остатка'); return; }
      state.cart[id] = (state.cart[id] || 0) + 1; saveCart(); render();
    };
  });
  app.querySelectorAll('[data-action="dec"]').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      state.cart[id] = (state.cart[id] || 0) - 1;
      if (state.cart[id] <= 0) delete state.cart[id];
      saveCart(); render();
    };
  });
  app.querySelectorAll('[data-action="go-to-profile"]').forEach(el => { el.onclick = (e) => { e.preventDefault(); state.view = 'profile'; render(); }; });

  const birthdayCheckbox = app.querySelector('#use-birthday');
  if (birthdayCheckbox) birthdayCheckbox.onchange = () => { state.checkoutUseBirthday = birthdayCheckbox.checked; render(); };
  const consultantCheckbox = app.querySelector('#use-consultant');
  if (consultantCheckbox) consultantCheckbox.onchange = () => { state.checkoutUseConsultant = consultantCheckbox.checked; render(); };
  const bonusInput = app.querySelector('#use-bonus');
  if (bonusInput) {
    bonusInput.oninput = () => {
      state.checkoutUseBonus = Number(bonusInput.value) || 0;
      render();
      const el = document.getElementById('use-bonus');
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    };
  }

  const checkoutBtn = app.querySelector('[data-action="checkout"]');
  if (checkoutBtn) {
    checkoutBtn.onclick = async () => {
      const items = Object.entries(state.cart).map(([id, qty]) => ({ product_id: Number(id), qty }));
      const address = document.getElementById('checkout-address').value.trim();
      const comment = document.getElementById('checkout-comment').value.trim();
      if (!address) { toast('Укажите адрес доставки'); return; }
      try {
        await api('/api/orders', {
          method: 'POST',
          body: {
            items, address, comment, phone: state.user.phone,
            use_bonus: state.checkoutUseBonus, use_birthday_discount: state.checkoutUseBirthday,
            use_consultant_discount: state.checkoutUseConsultant
          }
        });
        state.cart = {}; saveCart();
        state.checkoutUseBonus = 0; state.checkoutUseBirthday = false; state.checkoutUseConsultant = false; state.consultantEligibleIds = [];
        toast('Заказ оформлен!');
        state.user = await api('/api/profile/me');
        await refreshMyActiveOrders();
        state.view = 'profile';
        render();
      } catch (e) {
        if (e.message === 'too_many_active_orders') toast('Максимум 3 активных заказа одновременно');
        else if (e.message === 'insufficient_stock') toast('Одного из товаров не хватает на складе');
        else if (e.message === 'insufficient_bonus') toast('Недостаточно бонусов');
        else toast('Не удалось оформить заказ');
      }
    };
  }

  app.querySelectorAll('[data-open-order]').forEach(card => {
    card.onclick = () => { const order = state.orders.find(o => o.id === Number(card.dataset.openOrder)); if (order) openOrderDetailModal(order); };
  });

  // Профиль
  const gearBtn = app.querySelector('[data-action="open-settings"]');
  if (gearBtn) gearBtn.onclick = () => openSettingsModal();
  const bellBtn = app.querySelector('[data-action="open-notifications"]');
  if (bellBtn) bellBtn.onclick = () => openNotificationsModal();
  const reviewsPrevBtn = app.querySelector('[data-action="reviews-prev"]');
  if (reviewsPrevBtn) reviewsPrevBtn.onclick = async () => { await loadReviews(state.reviewsData.page - 1); render(); };
  const reviewsNextBtn = app.querySelector('[data-action="reviews-next"]');
  if (reviewsNextBtn) reviewsNextBtn.onclick = async () => { await loadReviews(state.reviewsData.page + 1); render(); };
  app.querySelectorAll('[data-delete-review]').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Удалить этот отзыв? Бонус за него у пользователя будет аннулирован.')) return;
      try {
        await api(`/api/reviews/${btn.dataset.deleteReview}`, { method: 'DELETE' });
        toast('Отзыв удалён');
        await loadReviews(state.reviewsData.page);
        render();
      } catch (e) { toast('Не удалось удалить отзыв'); }
    };
  });

  // Напоминания
  app.querySelectorAll('[data-slot-toggle]').forEach(cb => {
    cb.onchange = async () => {
      try {
        await api(`/api/reminders/slot/${cb.dataset.slotToggle}`, { method: 'PUT', body: { enabled: cb.checked } });
        await loadReminders();
        render();
        toast(cb.checked ? 'Слот включён' : 'Слот выключен');
      } catch (e) { toast('Не удалось обновить'); }
    };
  });
  app.querySelectorAll('[data-slot-time]').forEach(input => {
    input.onchange = async () => {
      try {
        await api(`/api/reminders/slot/${input.dataset.slotTime}`, { method: 'PUT', body: { time: input.value } });
        await loadReminders();
        render();
        toast('Время обновлено');
      } catch (e) { toast('Не удалось обновить'); }
    };
  });
  const addReminderBtn = app.querySelector('[data-action="add-reminder-item"]');
  if (addReminderBtn) addReminderBtn.onclick = () => openAddReminderItemModal();
  app.querySelectorAll('[data-delete-reminder-item]').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Удалить из списка приёма?')) return;
      try {
        await api(`/api/reminders/items/${btn.dataset.deleteReminderItem}`, { method: 'DELETE' });
        await loadReminders();
        render();
        toast('Удалено');
      } catch (e) { toast('Не удалось удалить'); }
    };
  });

  const toggleModeBtn = app.querySelector('[data-action="toggle-view-mode"]');
  if (toggleModeBtn) {
    toggleModeBtn.onclick = () => {
      state.viewAsClient = !state.viewAsClient;
      state.view = 'services';
      toast(state.viewAsClient ? 'Режим клиента включён' : 'Режим администратора включён');
      render();
    };
  }
  const exitAdminBtn = app.querySelector('[data-action="exit-admin-mode"]');
  if (exitAdminBtn) {
    exitAdminBtn.onclick = () => {
      state.viewAsClient = true;
      state.view = 'services';
      toast('Вы вышли из режима администратора — теперь видно как обычному клиенту');
      render();
    };
  }

  // Управление: навигация
  app.querySelectorAll('[data-manage-section]').forEach(tile => {
    tile.onclick = async () => {
      state.manageSection = tile.dataset.manageSection;
      state.manageCatalogView = 'menu';
      if (state.manageSection === 'orders') await loadOrders();
      if (state.manageSection === 'users') await loadUsers();
      if (state.manageSection === 'ledger') await loadLedger();
      if (state.manageSection === 'stats') await loadStats();
      render();
    };
  });
  const backToManageMenu = app.querySelector('[data-action="back-to-manage-menu"]');
  if (backToManageMenu) backToManageMenu.onclick = () => { state.manageSection = null; render(); };

  // Управление: Каталог
  const mcAdd = app.querySelector('[data-action="mc-add-product"]');
  if (mcAdd) mcAdd.onclick = () => openProductModal(null);
  const mcAddStock = app.querySelector('[data-action="mc-add-stock"]');
  if (mcAddStock) mcAddStock.onclick = () => openStockPickerModal('add');
  const mcRemoveStock = app.querySelector('[data-action="mc-remove-stock"]');
  if (mcRemoveStock) mcRemoveStock.onclick = () => openStockPickerModal('remove');
  const mcList = app.querySelector('[data-action="mc-list"]');
  if (mcList) mcList.onclick = () => { state.manageCatalogView = 'list'; render(); };
  const backToCatalogMenu = app.querySelector('[data-action="back-to-catalog-menu"]');
  if (backToCatalogMenu) backToCatalogMenu.onclick = () => { state.manageCatalogView = 'menu'; render(); };
  app.querySelectorAll('[data-open-manage-product]').forEach(row => {
    row.onclick = () => { const product = state.products.find(p => p.id === Number(row.dataset.openManageProduct)); if (product) openProductModal(product); };
  });

  // Управление: Заказы
  app.querySelectorAll('[data-manage-orders-tab]').forEach(tile => {
    tile.onclick = () => { state.manageOrdersTab = tile.dataset.manageOrdersTab; render(); };
  });
  app.querySelectorAll('[data-open-manage-order]').forEach(card => {
    card.onclick = () => { const order = state.orders.find(o => o.id === Number(card.dataset.openManageOrder)); if (order) openManageOrderDetailModal(order); };
  });

  // Управление: Пользователи
  app.querySelectorAll('[data-open-user]').forEach(row => {
    row.onclick = () => openUserDetailModal(row.dataset.openUser);
  });

  // Управление: Бухгалтерия
  const ledgerIncomeBtn = app.querySelector('[data-action="ledger-income"]');
  if (ledgerIncomeBtn) ledgerIncomeBtn.onclick = () => openLedgerEntryModal('income');
  const ledgerExpenseBtn = app.querySelector('[data-action="ledger-expense"]');
  if (ledgerExpenseBtn) ledgerExpenseBtn.onclick = () => openLedgerEntryModal('expense');
  app.querySelectorAll('[data-action="delete-ledger-entry"]').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Удалить эту запись из истории?')) return;
      try {
        await api(`/api/ledger/${btn.dataset.id}`, { method: 'DELETE' });
        await loadLedger();
        render();
        toast('Запись удалена');
      } catch (e) { toast('Не удалось удалить запись'); }
    };
  });
}

// ---------- Анимация частиц на фоне ----------
function initParticles() {
  const canvas = document.getElementById('particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h, particles;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  function makeParticles() {
    const count = Math.min(36, Math.floor((w * h) / 26000));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      r: 1.5 + Math.random() * 2.5,
      vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
      hue: Math.random() > 0.5 ? '19,135,108' : '32,40,44',
      alpha: 0.12 + Math.random() * 0.18
    }));
  }
  function tick() {
    ctx.clearRect(0, 0, w, h);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.hue},${p.alpha})`;
      ctx.fill();
    });
    requestAnimationFrame(tick);
  }
  resize();
  makeParticles();
  window.addEventListener('resize', () => { resize(); makeParticles(); });
  tick();
}
initParticles();

loadInitialData();
