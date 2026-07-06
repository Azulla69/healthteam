// ---------- Состояние приложения ----------
const state = {
  view: 'catalog',
  user: null,
  isAdmin: false,
  products: [],
  category: 'Все',
  orders: [],
  cart: JSON.parse(localStorage.getItem('cart') || '{}'), // { productId: qty }
};

function saveCart() {
  localStorage.setItem('cart', JSON.stringify(state.cart));
}

function cartCount() {
  return Object.values(state.cart).reduce((a, b) => a + b, 0);
}

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

// ---------- Инициализация Telegram WebApp ----------
if (tg) {
  tg.ready();
  tg.expand();
}

// ---------- Загрузка данных ----------
async function loadInitialData() {
  try {
    if (tg && tg.initData) {
      state.user = await api('/api/profile/me');
      state.isAdmin = !!state.user.isAdmin;
    }
  } catch (e) {
    // пользователь просто не авторизован (открыто вне Telegram) — работаем как гость
  }
  await loadProducts();
  render();
}

async function loadProducts() {
  state.products = await api('/api/catalog');
}

async function loadOrders() {
  state.orders = state.isAdmin ? await api('/api/orders') : await api('/api/orders/my');
}

// ---------- Рендер ----------
const app = document.getElementById('app');

function render() {
  let html = '';
  if (state.view === 'catalog') html = renderCatalog();
  else if (state.view === 'cart') html = renderCart();
  else if (state.view === 'orders') html = renderOrders();
  else if (state.view === 'profile') html = renderProfile();

  app.innerHTML = html + renderTabbar();
  attachEvents();
}

function renderTabbar() {
  const tabs = [
    { id: 'catalog', label: 'Каталог', icon: '🌿' },
    { id: 'cart', label: 'Корзина', icon: '🛒', badge: cartCount() },
    { id: 'orders', label: 'Заказы', icon: '📦' },
    { id: 'profile', label: 'Профиль', icon: '👤' },
  ];
  return `
    <div class="tabbar">
      ${tabs.map(t => `
        <button class="tab ${state.view === t.id ? 'active' : ''}" data-tab="${t.id}" style="position:relative;">
          <span>${t.icon}</span>
          <span>${t.label}</span>
          ${t.badge ? `<span class="dot"></span>` : ''}
        </button>
      `).join('')}
    </div>
  `;
}

function renderCatalog() {
  const categories = ['Все', ...new Set(state.products.map(p => p.category).filter(Boolean))];
  const filtered = state.category === 'Все'
    ? state.products
    : state.products.filter(p => p.category === state.category);

  return `
    <div class="topbar">
      <div>
        <div class="eyebrow">Каталог товаров</div>
        <h1>HealthTeam</h1>
      </div>
    </div>
    <div class="chips">
      ${categories.map(c => `<div class="chip ${c === state.category ? 'active' : ''}" data-cat="${c}">${c}</div>`).join('')}
    </div>
    <div class="grid">
      ${filtered.map(renderProductCard).join('') || `<div class="empty-state" style="grid-column:1/-1"><h3>Пока пусто</h3><p>Товаров в этой категории нет</p></div>`}
    </div>
    ${state.isAdmin ? `<button class="fab" data-action="add-product">+</button>` : ''}
  `;
}

function renderProductCard(p) {
  const inactive = !p.active;
  const stockLabel = p.stock === 0
    ? '<div class="stock-out">Нет в наличии</div>'
    : p.stock <= 5 ? `<div class="stock-low">Осталось ${p.stock} шт.</div>` : '';
  return `
    <div class="card" data-product-id="${p.id}" style="${inactive ? 'opacity:0.5' : ''}">
      ${state.isAdmin ? `
        <div class="admin-actions">
          <button class="icon-btn" data-action="edit-product" data-id="${p.id}">✏️</button>
          <button class="icon-btn" data-action="delete-product" data-id="${p.id}">🗑</button>
        </div>` : ''}
      <div class="img-ph">🌿</div>
      <div class="cat">${p.category || 'Без категории'}</div>
      <div class="name">${p.name}</div>
      <div class="price-tag">${p.price} ₽</div>
      ${stockLabel}
      <button class="btn btn-primary" data-action="add-to-cart" data-id="${p.id}" ${p.stock === 0 ? 'disabled' : ''}>В корзину</button>
    </div>
  `;
}

function renderCart() {
  const items = Object.entries(state.cart)
    .map(([id, qty]) => ({ product: state.products.find(p => p.id === Number(id)), qty }))
    .filter(i => i.product);

  const total = items.reduce((sum, i) => sum + i.product.price * i.qty, 0);

  return `
    <div class="topbar"><div><div class="eyebrow">Оформление</div><h1>Корзина</h1></div></div>
    <div class="section">
      ${items.length === 0 ? `<div class="empty-state"><h3>Корзина пуста</h3><p>Добавьте товары из каталога</p></div>` : `
        <div class="list-item">
          ${items.map(i => `
            <div class="cart-line">
              <div>
                <div style="font-weight:600;font-size:14px">${i.product.name}</div>
                <div class="price-tag" style="margin-top:4px">${i.product.price} ₽</div>
              </div>
              <div class="qty-control">
                <button data-action="dec" data-id="${i.product.id}">−</button>
                <span>${i.qty}</span>
                <button data-action="inc" data-id="${i.product.id}">+</button>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="row-between" style="margin:16px 0;">
          <strong>Итого</strong>
          <span class="price-tag">${total} ₽</span>
        </div>
        <div class="field">
          <label>Телефон</label>
          <input type="tel" id="checkout-phone" placeholder="+7 900 000-00-00" value="${state.user?.phone || ''}" />
        </div>
        <div class="field">
          <label>Адрес доставки</label>
          <textarea id="checkout-address" placeholder="Город, улица, дом, квартира">${state.user?.address || ''}</textarea>
        </div>
        <div class="field">
          <label>Комментарий к заказу</label>
          <textarea id="checkout-comment" placeholder="Необязательно"></textarea>
        </div>
        <button class="btn btn-amber btn-block" data-action="checkout">Оформить заказ</button>
      `}
    </div>
  `;
}

function renderOrders() {
  const statusLabels = { new: 'Новый', confirmed: 'Подтверждён', done: 'Выполнен', cancelled: 'Отменён' };
  return `
    <div class="topbar"><div><div class="eyebrow">${state.isAdmin ? 'Все заказы' : 'Мои заказы'}</div><h1>Заказы</h1></div></div>
    <div class="section">
      ${!state.user ? `<div class="empty-state"><h3>Нужен вход через Telegram</h3><p>Откройте приложение внутри Telegram, чтобы видеть заказы</p></div>` :
        state.orders.length === 0 ? `<div class="empty-state"><h3>Заказов пока нет</h3></div>` :
        state.orders.map(o => `
          <div class="list-item">
            <div class="row-between">
              <strong>Заказ #${o.id}</strong>
              <span class="status-badge status-${o.status}">${statusLabels[o.status]}</span>
            </div>
            ${state.isAdmin ? `<div style="font-size:12px;color:var(--ink-soft);margin-top:4px">${o.first_name || ''} ${o.last_name || ''} · @${o.username || '—'} · id ${o.telegram_id}</div>` : ''}
            <div style="font-size:13px;margin:8px 0;color:var(--ink-soft)">
              ${o.items.map(i => `${i.name} × ${i.qty}`).join(', ')}
            </div>
            <div class="row-between">
              <span class="price-tag">${o.total} ₽</span>
              ${state.isAdmin ? `
                <select data-action="change-status" data-id="${o.id}" style="padding:6px 8px;border-radius:8px;border:1px solid var(--line)">
                  ${Object.entries(statusLabels).map(([k, v]) => `<option value="${k}" ${o.status === k ? 'selected' : ''}>${v}</option>`).join('')}
                </select>
              ` : ''}
            </div>
          </div>
        `).join('')
      }
    </div>
  `;
}

function renderProfile() {
  if (!state.user) {
    return `
      <div class="topbar"><div><div class="eyebrow">Личный кабинет</div><h1>Профиль</h1></div></div>
      <div class="empty-state"><h3>Откройте приложение в Telegram</h3><p>Профиль доступен только внутри Telegram Mini App</p></div>
    `;
  }
  return `
    <div class="topbar"><div><div class="eyebrow">Личный кабинет</div><h1>${state.user.first_name || 'Профиль'}</h1></div></div>
    <div class="section">
      ${state.isAdmin ? `<div class="status-badge status-confirmed" style="margin-bottom:14px;display:inline-block">Режим администратора</div>` : ''}
      <div class="field">
        <label>Телефон</label>
        <input type="tel" id="profile-phone" value="${state.user.phone || ''}" placeholder="+7 900 000-00-00" />
      </div>
      <div class="field">
        <label>Адрес доставки</label>
        <textarea id="profile-address" placeholder="Город, улица, дом, квартира">${state.user.address || ''}</textarea>
      </div>
      <button class="btn btn-primary btn-block" data-action="save-profile">Сохранить</button>
    </div>
  `;
}

// ---------- Модалка добавления/редактирования товара (только админ) ----------
function openProductModal(product) {
  const isEdit = !!product;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal-sheet">
      <h3>${isEdit ? 'Редактировать товар' : 'Новый товар'}</h3>
      <div class="field"><label>Название</label><input id="pf-name" value="${product?.name || ''}" /></div>
      <div class="field"><label>Категория</label><input id="pf-category" value="${product?.category || ''}" /></div>
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
      category: backdrop.querySelector('#pf-category').value.trim(),
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
    } catch (e) {
      toast('Ошибка сохранения');
    }
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
      if (state.view === 'orders' && state.user) await loadOrders();
      render();
    };
  });

  app.querySelectorAll('[data-cat]').forEach(chip => {
    chip.onclick = () => { state.category = chip.dataset.cat; render(); };
  });

  app.querySelectorAll('[data-action="add-to-cart"]').forEach(btn => {
    btn.onclick = () => {
      const id = Number(btn.dataset.id);
      state.cart[id] = (state.cart[id] || 0) + 1;
      saveCart();
      toast('Добавлено в корзину');
      render();
    };
  });

  app.querySelectorAll('[data-action="inc"]').forEach(btn => {
    btn.onclick = () => { const id = btn.dataset.id; state.cart[id] = (state.cart[id] || 0) + 1; saveCart(); render(); };
  });
  app.querySelectorAll('[data-action="dec"]').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      state.cart[id] = (state.cart[id] || 0) - 1;
      if (state.cart[id] <= 0) delete state.cart[id];
      saveCart();
      render();
    };
  });

  const checkoutBtn = app.querySelector('[data-action="checkout"]');
  if (checkoutBtn) {
    checkoutBtn.onclick = async () => {
      if (!state.user) { toast('Откройте приложение в Telegram, чтобы оформить заказ'); return; }
      const items = Object.entries(state.cart).map(([id, qty]) => ({ product_id: Number(id), qty }));
      const phone = document.getElementById('checkout-phone').value.trim();
      const address = document.getElementById('checkout-address').value.trim();
      const comment = document.getElementById('checkout-comment').value.trim();
      if (!phone || !address) { toast('Укажите телефон и адрес'); return; }
      try {
        await api('/api/orders', { method: 'POST', body: { items, phone, address, comment } });
        state.cart = {};
        saveCart();
        toast('Заказ оформлен!');
        state.view = 'orders';
        await loadOrders();
        render();
      } catch (e) {
        toast('Не удалось оформить заказ');
      }
    };
  }

  const saveProfileBtn = app.querySelector('[data-action="save-profile"]');
  if (saveProfileBtn) {
    saveProfileBtn.onclick = async () => {
      const phone = document.getElementById('profile-phone').value.trim();
      const address = document.getElementById('profile-address').value.trim();
      state.user = await api('/api/profile/me', { method: 'PUT', body: { phone, address } });
      toast('Профиль обновлён');
    };
  }

  app.querySelectorAll('[data-action="change-status"]').forEach(sel => {
    sel.onchange = async () => {
      await api(`/api/orders/${sel.dataset.id}/status`, { method: 'PUT', body: { status: sel.value } });
      await loadOrders();
      render();
      toast('Статус обновлён');
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
