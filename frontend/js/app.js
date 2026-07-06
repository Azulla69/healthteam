// ---------- Состояние приложения ----------
const state = {
  view: 'catalog',
  user: null,
  isAdmin: false,
  viewAsClient: false,
  products: [],
  orders: [],
  myActiveOrdersCount: 0,
  cart: JSON.parse(localStorage.getItem('cart') || '{}'),

  catalogStep: 'sections',
  selectedSection: null,
  selectedSubcategory: null,
  sortBy: 'default',

  manageTab: 'products',
};

const STATUS_LABELS = { new: 'Принято в обработку', confirmed: 'Доставляем', done: 'Выполнено', cancelled: 'Отменён' };

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

if (tg) { tg.ready(); tg.expand(); }

// ---------- Загрузка данных ----------
async function loadInitialData() {
  try {
    if (tg && tg.initData) {
      state.user = await api('/api/profile/me');
      state.isAdmin = !!state.user.isAdmin;
      await refreshMyActiveOrders();
    }
  } catch (e) { /* гость */ }
  await loadProducts();
  render();
}

async function loadProducts() { state.products = await api('/api/catalog'); }

async function loadOrders() {
  state.orders = effectiveAdmin() ? await api('/api/orders') : await api('/api/orders/my');
}

async function refreshMyActiveOrders() {
  if (!state.user) return;
  const mine = await api('/api/orders/my');
  state.myActiveOrdersCount = mine.filter(o => ['new', 'confirmed'].includes(o.status)).length;
}

// ---------- Рендер ----------
const app = document.getElementById('app');

function render() {
  let html = '';
  if (state.view === 'catalog') html = renderCatalog();
  else if (state.view === 'cart') html = renderCart();
  else if (state.view === 'orders') html = renderOrders();
  else if (state.view === 'profile') html = renderProfile();
  else if (state.view === 'manage') html = renderManage();

  app.innerHTML = html + renderTabbar();
  attachEvents();
}

function renderTabbar() {
  const tabs = [
    { id: 'catalog', label: 'Каталог', icon: '🌿' },
    { id: 'cart', label: 'Корзина', icon: '🛒', badge: cartCount() },
  ];
  if (!effectiveAdmin()) tabs.push({ id: 'orders', label: 'Заказы', icon: '📦' });
  tabs.push({ id: 'profile', label: 'Профиль', icon: '👤' });
  if (effectiveAdmin()) tabs.push({ id: 'manage', label: 'Управление', icon: '⚙️' });

  return `
    <div class="tabbar">
      ${tabs.map(t => `
        <button class="tab ${state.view === t.id ? 'active' : ''}" data-tab="${t.id}" style="position:relative;">
          <span>${t.icon}</span><span>${t.label}</span>
          ${t.badge ? `<span class="dot"></span>` : ''}
        </button>
      `).join('')}
    </div>
  `;
}

// ---------- Каталог ----------
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
      <div class="topbar"><div><div class="eyebrow">Каталог товаров</div><h1>HealthTeam</h1></div></div>
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

  if (state.catalogStep === 'subcategories') {
    const inSection = products.filter(p => p.section === state.selectedSection);
    const cats = [...new Set(inSection.map(p => p.category).filter(Boolean))];
    return `
      <div class="topbar"><div><div class="eyebrow">Раздел</div><h1>${state.selectedSection}</h1></div></div>
      <div class="back-row" data-action="back-to-sections">← Все разделы</div>
      <div class="subcat-list">
        <div class="subcat-item" data-cat="__all__">Все товары раздела <span class="count">${inSection.length}</span></div>
        ${cats.map(c => `<div class="subcat-item" data-cat="${c}">${c} <span class="count">${inSection.filter(p => p.category === c).length}</span></div>`).join('')}
      </div>
    `;
  }

  let list = products.filter(p => p.section === state.selectedSection);
  if (state.selectedSubcategory) list = list.filter(p => p.category === state.selectedSubcategory);
  if (state.sortBy === 'brand') list = [...list].sort((a, b) => (a.brand || '').localeCompare(b.brand || ''));
  else if (state.sortBy === 'price_asc') list = [...list].sort((a, b) => a.price - b.price);
  else if (state.sortBy === 'price_desc') list = [...list].sort((a, b) => b.price - a.price);

  return `
    <div class="topbar"><div><div class="eyebrow">${state.selectedSection}</div><h1>${state.selectedSubcategory || 'Все товары'}</h1></div></div>
    <div class="back-row" data-action="back-to-subcats">← ${state.selectedSection}</div>
    <div class="sort-row">
      <select data-action="sort-select">
        <option value="default" ${state.sortBy === 'default' ? 'selected' : ''}>По умолчанию</option>
        <option value="brand" ${state.sortBy === 'brand' ? 'selected' : ''}>По производителю (А-Я)</option>
        <option value="price_asc" ${state.sortBy === 'price_asc' ? 'selected' : ''}>Сначала дешевле</option>
        <option value="price_desc" ${state.sortBy === 'price_desc' ? 'selected' : ''}>Сначала дороже</option>
      </select>
    </div>
    <div class="grid">
      ${list.map(renderProductCard).join('') || `<div class="empty-state" style="grid-column:1/-1"><h3>Пока пусто</h3></div>`}
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
      <div class="img-ph">🌿</div>
      <div class="brand-tag">${p.brand || ''}</div>
      <div class="name">${p.name}</div>
      <div class="price-tag">${p.price} ₽</div>
      ${stockLabel}
      <button class="btn btn-primary" data-action="quick-add" data-id="${p.id}" ${p.stock === 0 ? 'disabled' : ''}>В корзину</button>
    </div>
  `;
}

// ---------- Модалка карточки товара ----------
function openProductDetailModal(product) {
  const inCart = state.cart[product.id] || 0;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  let qty = 1;

  function draw() {
    const maxReached = qty >= product.stock;
    backdrop.innerHTML = `
      <div class="modal-sheet">
        <div class="detail-img">🌿</div>
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

// ---------- Корзина ----------
function renderCart() {
  const items = Object.entries(state.cart)
    .map(([id, qty]) => ({ product: state.products.find(p => p.id === Number(id)), qty }))
    .filter(i => i.product);
  const total = items.reduce((sum, i) => sum + i.product.price * i.qty, 0);
  const complete = profileComplete(state.user);
  const limitReached = state.myActiveOrdersCount >= 3;

  return `
    <div class="topbar"><div><div class="eyebrow">Оформление</div><h1>Корзина</h1></div></div>
    <div class="section">
      ${items.length === 0 ? `<div class="empty-state"><h3>Корзина пуста</h3><p>Добавьте товары из каталога</p></div>` : `
        <div class="list-item">
          ${items.map(i => `
            <div class="cart-line">
              <div class="cart-line-thumb">
                <div class="thumb">🌿</div>
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
        <div class="row-between" style="margin:16px 0;">
          <strong>Итого</strong>
          <span class="price-tag">${total} ₽</span>
        </div>

        ${!state.user ? `<div class="empty-state"><h3>Нужен вход через Telegram</h3></div>` :
          limitReached ? `
            <div class="limit-banner">У вас уже 3 активных заказа — это максимум одновременно. Дождитесь выполнения или отмените один из текущих заказов во вкладке «Заказы», прежде чем оформить новый.</div>
          ` :
          !complete ? `
            <div class="profile-incomplete">Перед оформлением заказа заполните имя, фамилию и телефон в профиле — дальше указывать их снова не нужно.</div>
            <button class="btn btn-primary btn-block" data-action="go-to-profile">Заполнить профиль</button>
          ` : `
            <div class="checkout-readonly">
              <span>${state.user.first_name} ${state.user.last_name} · ${state.user.phone}</span>
              <a data-action="go-to-profile" href="#">изменить</a>
            </div>
            <div class="field">
              <label>Адрес доставки</label>
              <textarea id="checkout-address" placeholder="Город, улица, дом, квартира">${state.user.address || ''}</textarea>
            </div>
            <div class="field">
              <label>Комментарий к заказу</label>
              <textarea id="checkout-comment" placeholder="Необязательно"></textarea>
            </div>
            <button class="btn btn-amber btn-block" data-action="checkout">Оформить заказ</button>
          `
        }
      `}
    </div>
  `;
}

// ---------- Заказы (для покупателя) ----------
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
            <div class="row-between"><span class="price-tag">${o.total} ₽</span></div>
          </div>
        `).join('')
      }
    </div>
  `;
}

function orderDetailHtml(o, { editable }) {
  return `
    <h3>Заказ №${o.id}</h3>
    <span class="status-badge status-${o.status}">${STATUS_LABELS[o.status]}</span>
    <div class="list-item" style="margin-top:14px">
      ${o.items.map(i => `
        <div class="cart-line-thumb" style="padding:8px 0;border-bottom:1px solid var(--line)">
          <div class="thumb">🌿</div>
          <div style="flex:1">
            <div style="font-weight:600;font-size:14px">${i.name}</div>
            <div style="font-size:12px;color:var(--ink-soft)">${i.qty} × ${i.price} ₽</div>
          </div>
          <div class="price-tag">${i.qty * i.price} ₽</div>
        </div>
      `).join('')}
    </div>
    <div class="row-between" style="margin:12px 0"><strong>Сумма</strong><span class="price-tag">${o.total} ₽</span></div>
    <div class="field"><label>Адрес доставки</label><div style="font-size:14px">${o.address || '—'}</div></div>
    ${o.comment ? `<div class="field"><label>Комментарий</label><div style="font-size:14px">${o.comment}</div></div>` : ''}
  `;
}

function openOrderDetailModal(order) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  function drawView() {
    backdrop.innerHTML = `
      <div class="modal-sheet">
        ${orderDetailHtml(order, {})}
        ${order.status === 'new' ? `
          <div class="order-actions">
            <button class="btn btn-ghost" id="od-edit">Редактировать</button>
            <button class="btn btn-danger" id="od-cancel">Удалить заказ</button>
          </div>
        ` : ''}
        <button class="btn btn-primary btn-block" id="od-close" style="margin-top:10px">Закрыть</button>
      </div>
    `;
    backdrop.querySelector('#od-close').onclick = () => backdrop.remove();
    if (order.status === 'new') {
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
                  <div class="thumb">🌿</div>
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
        btn.onclick = () => {
          const idx = Number(btn.dataset.editDec);
          if (editItems[idx].qty > 1) { editItems[idx].qty--; drawEditInner(); }
        };
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
            method: 'PUT',
            body: { items: editItems.map(i => ({ product_id: i.product_id, qty: i.qty })), address, comment }
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

// ---------- Профиль ----------
function renderProfile() {
  if (!state.user) {
    return `
      <div class="topbar"><div><div class="eyebrow">Личный кабинет</div><h1>Профиль</h1></div></div>
      <div class="empty-state"><h3>Откройте приложение в Telegram</h3></div>
    `;
  }
  const initial = (state.user.first_name || state.user.username || '?').charAt(0).toUpperCase();
  const stats = state.user.stats || { ordersCount: 0, totalSpent: 0 };

  return `
    <div class="topbar"><div><div class="eyebrow">Личный кабинет</div><h1>Профиль</h1></div></div>
    <div class="profile-header">
      <div class="profile-header-inner">
        <div class="avatar-lg">${initial}</div>
        <div class="pname">${state.user.first_name || 'Без имени'} ${state.user.last_name || ''}</div>
      </div>
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
      <div class="stats-row">
        <div class="stat-box"><div class="num">${stats.ordersCount}</div><div class="lbl">Заказов сделано</div></div>
        <div class="stat-box"><div class="num">${stats.totalSpent} ₽</div><div class="lbl">Всего потрачено</div></div>
      </div>
      ${!profileComplete(state.user) ? `<div class="profile-incomplete">Заполните имя, фамилию и телефон в настройках (⚙️ вверху) — это нужно один раз.</div>` : ''}
    </div>
  `;
}

function openSettingsModal() {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const u = state.user;
  const cooldown = db_checkCooldownClientSide(u);

  backdrop.innerHTML = `
    <div class="modal-sheet">
      <h3>Настройки профиля</h3>
      <div class="field"><label>Имя</label><input id="s-first-name" value="${u.first_name || ''}" /></div>
      <div class="field"><label>Фамилия</label><input id="s-last-name" value="${u.last_name || ''}" /></div>
      <div class="field"><label>Телефон</label><input id="s-phone" type="tel" value="${u.phone || ''}" placeholder="+7 900 000-00-00" /></div>
      <div class="field">
        <label>Дата рождения</label>
        <input id="s-birth" type="date" value="${u.birth_date || ''}" ${cooldown.blocked ? 'disabled' : ''} />
        ${cooldown.blocked ? `<div style="font-size:11px;color:var(--amber-dark);margin-top:4px">Дату рождения можно менять раз в 6 месяцев. Следующее изменение будет доступно ${cooldown.nextDateStr}.</div>` : ''}
      </div>
      <button class="btn btn-primary btn-block" id="s-save">Сохранить</button>
      <button class="btn btn-ghost btn-block" id="s-cancel" style="margin-top:8px">Отмена</button>
    </div>
  `;
  document.body.appendChild(backdrop);
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
    } catch (e) {
      toast('Дату рождения пока менять нельзя (раз в 6 месяцев)');
    }
  };
}

// Проверка cooldown на фронте — только для UI-подсказки, реальная проверка всегда на сервере
function db_checkCooldownClientSide(u) {
  if (!u.birth_date_updated_at) return { blocked: false };
  const last = new Date(u.birth_date_updated_at);
  const nextAllowed = new Date(last);
  nextAllowed.setMonth(nextAllowed.getMonth() + 6);
  if (new Date() < nextAllowed) {
    return { blocked: true, nextDateStr: nextAllowed.toLocaleDateString('ru-RU') };
  }
  return { blocked: false };
}

// ---------- Управление (админ) ----------
function renderManage() {
  const tabs = [{ id: 'products', label: 'Товары' }, { id: 'orders', label: 'Заказы' }];
  return `
    <div class="topbar"><div><div class="eyebrow">Админ-панель</div><h1>Управление</h1></div></div>
    <div class="manage-pills">
      ${tabs.map(t => `<div class="manage-pill ${state.manageTab === t.id ? 'active' : ''}" data-manage-tab="${t.id}">${t.label}</div>`).join('')}
    </div>
    ${state.manageTab === 'products' ? renderManageProducts() : renderManageOrders()}
    ${state.manageTab === 'products' ? `<button class="fab" data-action="add-product">+</button>` : ''}
  `;
}

function renderManageProducts() {
  const bySection = {};
  state.products.forEach(p => {
    const sec = p.section || 'Без раздела';
    bySection[sec] = bySection[sec] || [];
    bySection[sec].push(p);
  });
  return Object.entries(bySection).map(([sec, items]) => `
    <div class="manage-group-title">${sec}</div>
    ${items.map(p => `
      <div class="manage-row" style="${p.active ? '' : 'opacity:0.5'}">
        <div class="info">
          <div class="n">${p.name}</div>
          <div class="m">${p.category || '—'} · ${p.brand || '—'} · ${p.price} ₽ · ост. ${p.stock}</div>
        </div>
        <div class="acts">
          <button class="icon-btn" data-action="edit-product" data-id="${p.id}">✏️</button>
          <button class="icon-btn" data-action="delete-product" data-id="${p.id}">🗑</button>
        </div>
      </div>
    `).join('')}
  `).join('') || `<div class="empty-state"><h3>Товаров пока нет</h3></div>`;
}

function renderManageOrders() {
  return `
    <div class="section">
      ${state.orders.length === 0 ? `<div class="empty-state"><h3>Заказов пока нет</h3></div>` :
        state.orders.map(o => `
          <div class="list-item order-card" data-open-order="${o.id}">
            <div class="row-between">
              <strong>Заказ №${o.id}</strong>
              <span class="status-badge status-${o.status}">${STATUS_LABELS[o.status]}</span>
            </div>
            <div style="font-size:12px;color:var(--ink-soft);margin-top:4px">${o.first_name || ''} ${o.last_name || ''} · @${o.username || '—'}</div>
            <div style="font-size:13px;margin:8px 0;color:var(--ink-soft)">${o.items.map(i => `${i.name} × ${i.qty}`).join(', ')}</div>
            <div class="row-between">
              <span class="price-tag">${o.total} ₽</span>
              <select data-action="change-status" data-id="${o.id}" style="padding:6px 8px;border-radius:8px;border:1px solid var(--line)" onclick="event.stopPropagation()">
                ${Object.entries(STATUS_LABELS).map(([k, v]) => `<option value="${k}" ${o.status === k ? 'selected' : ''}>${v}</option>`).join('')}
              </select>
            </div>
          </div>
        `).join('')
      }
    </div>
  `;
}

// ---------- Модалка товара (админ) ----------
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
      <div class="field"><label>Название</label><input id="pf-name" value="${product?.name || ''}" /></div>
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
      <div class="field">
        <label>Производитель</label>
        <input id="pf-brand" list="dl-brands" value="${product?.brand || ''}" placeholder="напр. Maxler" />
        <datalist id="dl-brands">${brands.map(b => `<option value="${b}">`).join('')}</datalist>
      </div>
      <div class="field"><label>Описание</label><textarea id="pf-description">${product?.description || ''}</textarea></div>
      <div class="field"><label>Цена, ₽</label><input id="pf-price" type="number" value="${product?.price ?? ''}" /></div>
      <div class="field"><label>Остаток, шт.</label><input id="pf-stock" type="number" value="${product?.stock ?? 0}" /></div>
      ${isEdit ? `
        <div class="field">
          <label>Статус</label>
          <select id="pf-active">
            <option value="1" ${product.active ? 'selected' : ''}>Активен (виден в каталоге)</option>
            <option value="0" ${!product.active ? 'selected' : ''}>Скрыт</option>
          </select>
        </div>` : ''}
      <button class="btn btn-primary btn-block" id="pf-save">Сохранить</button>
      ${isEdit ? `<button class="btn btn-danger btn-block" id="pf-delete" style="margin-top:8px">Удалить товар</button>` : ''}
      <button class="btn btn-ghost btn-block" id="pf-cancel" style="margin-top:8px">Отмена</button>
    </div>
  `;
  document.body.appendChild(backdrop);

  backdrop.querySelector('#pf-cancel').onclick = () => backdrop.remove();
  backdrop.querySelector('#pf-save').onclick = async () => {
    const payload = {
      name: backdrop.querySelector('#pf-name').value.trim(),
      section: backdrop.querySelector('#pf-section').value.trim(),
      category: backdrop.querySelector('#pf-category').value.trim(),
      brand: backdrop.querySelector('#pf-brand').value.trim(),
      description: backdrop.querySelector('#pf-description').value.trim(),
      price: Number(backdrop.querySelector('#pf-price').value),
      stock: Number(backdrop.querySelector('#pf-stock').value),
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

// ---------- Обработчики событий ----------
function attachEvents() {
  app.querySelectorAll('[data-tab]').forEach(btn => {
    btn.onclick = async () => {
      state.view = btn.dataset.tab;
      if (state.view === 'catalog') { state.catalogStep = 'sections'; state.selectedSection = null; state.selectedSubcategory = null; }
      if ((state.view === 'orders' || state.view === 'manage') && state.user) await loadOrders();
      if (state.view === 'cart' && state.user) await refreshMyActiveOrders();
      render();
    };
  });

  app.querySelectorAll('[data-section]').forEach(tile => {
    tile.onclick = () => { state.selectedSection = tile.dataset.section; state.catalogStep = 'subcategories'; render(); };
  });
  app.querySelectorAll('[data-cat]').forEach(item => {
    item.onclick = () => {
      state.selectedSubcategory = item.dataset.cat === '__all__' ? null : item.dataset.cat;
      state.catalogStep = 'products';
      state.sortBy = 'default';
      render();
    };
  });
  const backToSections = app.querySelector('[data-action="back-to-sections"]');
  if (backToSections) backToSections.onclick = () => { state.catalogStep = 'sections'; state.selectedSection = null; render(); };
  const backToSubcats = app.querySelector('[data-action="back-to-subcats"]');
  if (backToSubcats) backToSubcats.onclick = () => { state.catalogStep = 'subcategories'; state.selectedSubcategory = null; render(); };
  const sortSelect = app.querySelector('[data-action="sort-select"]');
  if (sortSelect) sortSelect.onchange = () => { state.sortBy = sortSelect.value; render(); };

  // Открытие карточки товара (клик по карточке, не по кнопке)
  app.querySelectorAll('[data-open-product]').forEach(card => {
    card.onclick = () => {
      const product = state.products.find(p => p.id === Number(card.dataset.openProduct));
      if (product) openProductDetailModal(product);
    };
  });
  app.querySelectorAll('[data-action="quick-add"]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const product = state.products.find(p => p.id === Number(btn.dataset.id));
      const current = state.cart[product.id] || 0;
      if (current >= product.stock) { toast('Достигнут максимум остатка'); return; }
      state.cart[product.id] = current + 1;
      saveCart();
      toast('Добавлено в корзину');
      render();
    };
  });

  // Корзина
  app.querySelectorAll('[data-action="inc"]').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      const product = state.products.find(p => p.id === Number(id));
      if ((state.cart[id] || 0) >= product.stock) { toast('Достигнут максимум остатка'); return; }
      state.cart[id] = (state.cart[id] || 0) + 1;
      saveCart(); render();
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

  app.querySelectorAll('[data-action="go-to-profile"]').forEach(el => {
    el.onclick = (e) => { e.preventDefault(); state.view = 'profile'; render(); };
  });

  const checkoutBtn = app.querySelector('[data-action="checkout"]');
  if (checkoutBtn) {
    checkoutBtn.onclick = async () => {
      const items = Object.entries(state.cart).map(([id, qty]) => ({ product_id: Number(id), qty }));
      const address = document.getElementById('checkout-address').value.trim();
      const comment = document.getElementById('checkout-comment').value.trim();
      if (!address) { toast('Укажите адрес доставки'); return; }
      try {
        await api('/api/orders', { method: 'POST', body: { items, address, comment, phone: state.user.phone } });
        state.cart = {};
        saveCart();
        toast('Заказ оформлен!');
        state.view = 'orders';
        await loadOrders();
        await refreshMyActiveOrders();
        render();
      } catch (e) {
        if (e.message === 'too_many_active_orders') toast('Максимум 3 активных заказа одновременно');
        else if (e.message === 'insufficient_stock') toast('Одного из товаров не хватает на складе');
        else toast('Не удалось оформить заказ');
      }
    };
  }

  // Заказы (покупатель)
  app.querySelectorAll('[data-open-order]').forEach(card => {
    card.onclick = () => {
      const order = state.orders.find(o => o.id === Number(card.dataset.openOrder));
      if (order) openOrderDetailModal(order);
    };
  });

  // Профиль
  const gearBtn = app.querySelector('[data-action="open-settings"]');
  if (gearBtn) gearBtn.onclick = () => openSettingsModal();

  const toggleModeBtn = app.querySelector('[data-action="toggle-view-mode"]');
  if (toggleModeBtn) {
    toggleModeBtn.onclick = () => {
      state.viewAsClient = !state.viewAsClient;
      state.view = 'catalog';
      state.catalogStep = 'sections';
      toast(state.viewAsClient ? 'Режим клиента включён' : 'Режим администратора включён');
      render();
    };
  }

  // Смена статуса заказа (админ)
  app.querySelectorAll('[data-action="change-status"]').forEach(sel => {
    sel.onchange = async () => {
      await api(`/api/orders/${sel.dataset.id}/status`, { method: 'PUT', body: { status: sel.value } });
      await loadOrders();
      render();
      toast('Статус обновлён');
    };
  });

  // Управление
  app.querySelectorAll('[data-manage-tab]').forEach(pill => {
    pill.onclick = async () => {
      state.manageTab = pill.dataset.manageTab;
      if (state.manageTab === 'orders') await loadOrders();
      render();
    };
  });
  const addBtn = app.querySelector('[data-action="add-product"]');
  if (addBtn) addBtn.onclick = () => openProductModal(null);
  app.querySelectorAll('[data-action="edit-product"]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const product = state.products.find(p => p.id === Number(btn.dataset.id));
      openProductModal(product);
    };
  });
  app.querySelectorAll('[data-action="delete-product"]').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm('Скрыть товар из каталога?')) return;
      await api(`/api/catalog/${btn.dataset.id}`, { method: 'DELETE' });
      await loadProducts();
      render();
      toast('Товар скрыт');
    };
  });
}

loadInitialData();
