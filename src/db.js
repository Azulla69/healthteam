const fs = require('fs');
const path = require('path');

// DATA_DIR можно задать через переменную окружения — например, путь монтирования Railway Volume.
// Если не задана, используется папка проекта (подходит для локальной разработки).
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_FILE = path.join(DATA_DIR, 'data.json');
const MAX_ACTIVE_ORDERS = 3;
const BIRTHDATE_COOLDOWN_MONTHS = 6;
const ACTIVE_STATUSES = ['processing', 'delivering'];

function seedProducts() {
  const now = new Date().toISOString();
  const items = [
    { name: 'Жиросжигатель', brand: 'Доктор Море', section: 'БАДы', category: 'Жиросжигатели', price: 700, stock: 58, description: 'Стимулирует метаболизм и расход энергии, обычно принимают при похудении вместе со спортом.' },
    { name: 'Коллаген комплекс', brand: 'Доктор Море', section: 'БАДы', category: 'Коллаген', price: 850, stock: 6, description: 'Поддержка кожи, суставов и связок, особенно актуально после 30 лет.' },
    { name: 'Селен+цинк', brand: 'Доктор Море', section: 'БАДы', category: 'Витамины и минералы', price: 550, stock: 4, description: 'Антиоксидантная пара, поддержка щитовидной железы и иммунитета.' },
    { name: 'Цинка пиколинат', brand: 'Доктор Море', section: 'БАДы', category: 'Витамины и минералы', price: 450, stock: 4, description: 'Хорошо усвояемая форма цинка — для иммунитета, кожи, тестостерона у мужчин.' },
    { name: 'Магний хелат', brand: 'Доктор Море', section: 'БАДы', category: 'Витамины и минералы', price: 500, stock: 1, description: 'Расслабление нервной системы, помощь при судорогах и плохом сне.' },
    { name: 'Альфалипоевая кислота', brand: 'Доктор Море', section: 'БАДы', category: 'Антиоксиданты', price: 550, stock: 1, description: 'Мощный антиоксидант, поддержка печени и обмена сахара в крови.' },
    { name: 'Железа хелат', brand: 'Доктор Море', section: 'БАДы', category: 'Витамины и минералы', price: 500, stock: 1, description: 'Восполнение дефицита железа при усталости и низком гемоглобине.' },
    { name: 'Ламинария', brand: 'Доктор Море', section: 'БАДы', category: 'Витамины и минералы', price: 900, stock: 1, description: 'Природный источник йода, поддержка щитовидной железы.' },
    { name: 'Система очищения', brand: 'Доктор Море', section: 'БАДы', category: 'Детокс', price: 1700, stock: 1, description: 'Комплекс для мягкого детокса организма, курс на 1-2 недели.' },
    { name: 'Омега зрение', brand: 'Доктор Море', section: 'БАДы', category: 'Омега-3', price: 940, stock: 2, description: 'Омега-3 с добавками для глаз, при работе за компьютером.' },
    { name: 'Куркумин зелёный', brand: 'Qeep', section: 'БАДы', category: 'Противовоспалительные', price: 300, stock: 11, description: 'Противовоспалительная поддержка суставов и ЖКТ.' },
    { name: 'Куркумин коричневый', brand: 'Qeep', section: 'БАДы', category: 'Противовоспалительные', price: 630, stock: 2, description: 'Более концентрированная формула куркумина, та же цель.' },
    { name: 'Rutin', brand: 'Now', section: 'БАДы', category: 'Витамины и минералы', price: 900, stock: 1, description: 'Укрепление капилляров и сосудов, часто принимают вместе с витамином C.' },
    { name: 'D-mannose', brand: 'Now', section: 'БАДы', category: 'Женское здоровье', price: 980, stock: 1, description: 'Поддержка здоровья мочевыводящих путей, популярно у женщин при склонности к циститу.' },
    { name: 'Железо', brand: 'Доктор Дезалия', section: 'БАДы', category: 'Витамины и минералы', price: 400, stock: 2, description: 'Восполнение дефицита железа (аналог хелата железа других брендов).' },
    { name: 'Liquid collagen', brand: 'Доктор Зубарева', section: 'БАДы', category: 'Коллаген', price: 100, stock: 1, description: 'Жидкий коллаген, для кожи и суставов, быстрее усваивается чем капсулы.' },
    { name: 'Гуарана', brand: 'Ironman', section: 'Спортпит', category: 'Энергетики', price: 50, stock: 10, description: 'Природный источник кофеина, бодрость и концентрация без "срыва" как от кофе.' },
    { name: 'Magnesium glycinate liquid', brand: 'Maxler', section: 'Спортпит', category: 'Витамины и минералы', price: 100, stock: 12, description: 'Жидкий магний, быстрое усвоение, для сна и восстановления мышц после тренировки.' },
    { name: 'Monster pak (40 пакетов)', brand: 'Maxler', section: 'Спортпит', category: 'Витаминные комплексы', price: 2900, stock: 1, description: 'Комплексный набор витаминов и добавок на 40 приёмов.' },
    { name: 'Black mamba hyperrush', brand: 'Maxler', section: 'Спортпит', category: 'Предтренировочные комплексы', price: 600, stock: 1, description: 'Предтренировочный комплекс с высокой стимуляцией для интенсивных тренировок.' },
    { name: 'Железа хелат', brand: 'Tetralab', section: 'Спортпит', category: 'Витамины и минералы', price: 550, stock: 1, description: 'Ещё один вариант железа.' },
    { name: 'Fighter', brand: 'Labs', section: 'Спортпит', category: 'Предтренировочные комплексы', price: 1100, stock: 1, description: 'Предтренировочный комплекс — энергия и фокус на тренировке.' },
    { name: 'Mass formula', brand: 'Hqb', section: 'Спортпит', category: 'Гейнеры', price: 1100, stock: 1, description: 'Гейнер для набора мышечной массы.' },
    { name: 'Guarana', brand: 'Atech Nutrition', section: 'Спортпит', category: 'Энергетики', price: 350, stock: 1, description: 'Природный кофеин (аналог гуараны Ironman).' },
    { name: 'Pre-work', brand: 'Cybermass', section: 'Спортпит', category: 'Предтренировочные комплексы', price: 500, stock: 1, description: 'Предтренировочный комплекс, аналог Fighter и Black Mamba.' },
    { name: 'Caffeine 2000 plus', brand: 'Sporttech', section: 'Спортпит', category: 'Энергетики', price: 50, stock: 1, description: 'Чистый кофеин в капсулах.' },
  ];
  return items.map((item, i) => ({
    id: i + 1, name: item.name, description: item.description, price: item.price,
    section: item.section, category: item.category, brand: item.brand,
    image_url: '', stock: item.stock, active: true, created_at: now,
    batches: item.stock > 0 ? [{ id: i + 1, qty: item.stock, expiry: null, created_at: now }] : []
  }));
}

function loadDefault() {
  const products = seedProducts();
  return {
    users: [], products, orders: [], order_items: [], ledger: [],
    seq: { users: 1, products: products.length + 1, orders: 1, order_items: 1, batches: products.length + 1, ledger: 1 }
  };
}

let data;
if (fs.existsSync(DB_FILE)) {
  data = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  if (!data.ledger) data.ledger = [];
  if (!data.seq.ledger) data.seq.ledger = 1;
  if (!data.seq.batches) data.seq.batches = 1;
} else {
  data = loadDefault();
  persist();
}

function persist() { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); }
function nextId(table) { return data.seq[table]++; }

// ---------- Users ----------
function upsertUser({ telegram_id, username, first_name, last_name }) {
  let user = data.users.find(u => u.telegram_id === telegram_id);
  if (user) {
    user.username = username;
    if (!user.first_name) user.first_name = first_name;
    if (!user.last_name) user.last_name = last_name;
  } else {
    user = {
      id: nextId('users'), telegram_id, username, first_name, last_name,
      phone: '', address: '', birth_date: null, birth_date_updated_at: null,
      created_at: new Date().toISOString()
    };
    data.users.push(user);
  }
  persist();
  return user;
}

function updateUser(id, fields) {
  const user = data.users.find(u => u.id === id);
  if (!user) return null;
  Object.assign(user, fields);
  persist();
  return user;
}

function getUser(id) { return data.users.find(u => u.id === Number(id)); }
function getAllUsers() { return data.users; }

function checkBirthDateCooldown(user, newBirthDate) {
  if (!newBirthDate || newBirthDate === user.birth_date) return { allowed: true };
  if (!user.birth_date_updated_at) return { allowed: true };
  const last = new Date(user.birth_date_updated_at);
  const nextAllowed = new Date(last);
  nextAllowed.setMonth(nextAllowed.getMonth() + BIRTHDATE_COOLDOWN_MONTHS);
  if (new Date() < nextAllowed) return { allowed: false, nextAllowedAt: nextAllowed.toISOString() };
  return { allowed: true };
}

// ---------- Products & склад (партии со сроком годности) ----------
function getProducts({ onlyActive } = {}) {
  const list = onlyActive ? data.products.filter(p => p.active) : data.products;
  return [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}
function getProduct(id) { return data.products.find(p => p.id === Number(id)); }

function nearestExpiry(product) {
  const withExpiry = (product.batches || []).filter(b => b.qty > 0 && b.expiry);
  if (withExpiry.length === 0) return null;
  return withExpiry.sort((a, b) => new Date(a.expiry) - new Date(b.expiry))[0].expiry;
}

// Скрывает партии/сроки годности от обычных пользователей
function sanitizeProduct(product, isAdmin) {
  if (isAdmin) return { ...product, nearestExpiry: nearestExpiry(product) };
  const { batches, ...rest } = product;
  return rest;
}

function createProduct(fields) {
  const product = {
    id: nextId('products'), name: fields.name, description: fields.description || '',
    price: Number(fields.price), section: fields.section || '', category: fields.category || '',
    brand: fields.brand || '', image_url: fields.image_url || '',
    stock: 0, batches: [], active: true, created_at: new Date().toISOString()
  };
  data.products.push(product);
  persist();
  return product;
}

function updateProduct(id, fields) {
  const product = getProduct(id);
  if (!product) return null;
  Object.assign(product, {
    name: fields.name ?? product.name,
    description: fields.description ?? product.description,
    price: fields.price != null ? Number(fields.price) : product.price,
    section: fields.section ?? product.section,
    category: fields.category ?? product.category,
    brand: fields.brand ?? product.brand,
    image_url: fields.image_url ?? product.image_url,
    active: fields.active != null ? !!fields.active : product.active
    // stock сюда намеренно не попадает — меняется только через addStock/removeStock
  });
  persist();
  return product;
}

function hideProduct(id) {
  const product = getProduct(id);
  if (!product) return null;
  product.active = false;
  persist();
  return product;
}

function deleteProductHard(id) {
  data.products = data.products.filter(p => p.id !== Number(id));
  persist();
}

function addStock(productId, qty, expiry) {
  const product = getProduct(productId);
  if (!product) return { error: 'not_found' };
  qty = Number(qty);
  if (!qty || qty <= 0) return { error: 'bad_qty' };
  if (!product.batches) product.batches = [];
  product.batches.push({ id: nextId('batches'), qty, expiry: expiry || null, created_at: new Date().toISOString() });
  product.stock += qty;
  persist();
  return { product };
}

function removeStock(productId, qty) {
  const product = getProduct(productId);
  if (!product) return { error: 'not_found' };
  qty = Number(qty);
  if (!qty || qty <= 0) return { error: 'bad_qty' };
  if (qty > product.stock) return { error: 'insufficient_stock', available: product.stock };

  // Списываем сначала из партий с ближайшим сроком годности (без срока — в последнюю очередь)
  let remaining = qty;
  const sorted = [...(product.batches || [])].sort((a, b) => {
    if (!a.expiry && !b.expiry) return 0;
    if (!a.expiry) return 1;
    if (!b.expiry) return -1;
    return new Date(a.expiry) - new Date(b.expiry);
  });
  for (const batch of sorted) {
    if (remaining <= 0) break;
    const take = Math.min(batch.qty, remaining);
    batch.qty -= take;
    remaining -= take;
  }
  product.batches = product.batches.filter(b => b.qty > 0);
  product.stock -= qty;
  persist();
  return { product };
}

// ---------- Orders ----------
function resolveItems(items) {
  let total = 0;
  const resolvedItems = [];
  for (const item of items) {
    const product = getProduct(item.product_id);
    if (!product || !product.active) continue;
    const qty = Math.max(1, Number(item.qty) || 1);
    if (qty > product.stock) return { error: 'insufficient_stock', product: product.name, available: product.stock };
    resolvedItems.push({ product_id: product.id, name: product.name, price: product.price, qty });
    total += product.price * qty;
  }
  return { resolvedItems, total };
}

function countActiveOrders(user_id) {
  return data.orders.filter(o => o.user_id === user_id && ACTIVE_STATUSES.includes(o.status)).length;
}

function createOrder({ user_id, items, comment, phone, address }) {
  if (countActiveOrders(user_id) >= MAX_ACTIVE_ORDERS) return { error: 'too_many_active_orders', limit: MAX_ACTIVE_ORDERS };
  const resolved = resolveItems(items);
  if (resolved.error) return resolved;
  if (resolved.resolvedItems.length === 0) return { error: 'no_valid_items' };

  const order = {
    id: nextId('orders'), user_id, status: 'processing', paid: false,
    total: resolved.total, comment: comment || '', admin_comment: '',
    phone: phone || '', address: address || '', created_at: new Date().toISOString()
  };
  data.orders.push(order);
  const items_ = resolved.resolvedItems.map(i => ({ id: nextId('order_items'), order_id: order.id, ...i }));
  data.order_items.push(...items_);
  persist();
  return { order: { ...order, items: items_ } };
}

function attachItems(order) { return { ...order, items: data.order_items.filter(i => i.order_id === order.id) }; }
function getOrderRaw(id) { return data.orders.find(o => o.id === Number(id)); }

function getOrdersByUser(user_id) {
  return data.orders.filter(o => o.user_id === user_id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(attachItems);
}

function getAllOrders() {
  return data.orders
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(o => {
      const user = data.users.find(u => u.id === o.user_id) || {};
      return { ...attachItems(o), first_name: user.first_name, last_name: user.last_name, username: user.username, telegram_id: user.telegram_id };
    });
}

// Пользователь редактирует свой заказ, пока статус "processing"
function updateOrder(id, { items, address, comment }) {
  const order = getOrderRaw(id);
  if (!order) return { error: 'not_found' };
  if (order.status !== 'processing') return { error: 'not_editable' };
  const resolved = resolveItems(items);
  if (resolved.error) return resolved;
  if (resolved.resolvedItems.length === 0) return { error: 'no_valid_items' };

  data.order_items = data.order_items.filter(i => i.order_id !== order.id);
  const items_ = resolved.resolvedItems.map(i => ({ id: nextId('order_items'), order_id: order.id, ...i }));
  data.order_items.push(...items_);
  order.total = resolved.total;
  if (address !== undefined) order.address = address;
  if (comment !== undefined) order.comment = comment;
  persist();
  return { order: attachItems(order) };
}

function cancelOrder(id) {
  const order = getOrderRaw(id);
  if (!order) return { error: 'not_found' };
  if (order.status !== 'processing') return { error: 'not_cancellable' };
  data.orders = data.orders.filter(o => o.id !== order.id);
  data.order_items = data.order_items.filter(i => i.order_id !== order.id);
  persist();
  return { ok: true };
}

// "В обработке" -> "Доставляем": обязателен комментарий админа (время/место доставки)
function moveToDelivering(id, adminComment) {
  const order = getOrderRaw(id);
  if (!order) return { error: 'not_found' };
  if (order.status !== 'processing') return { error: 'bad_transition' };
  if (!adminComment || !adminComment.trim()) return { error: 'admin_comment_required' };
  order.status = 'delivering';
  order.admin_comment = adminComment.trim();
  persist();
  return { order: attachItems(order) };
}

// "Доставляем" -> "Выполнено": сумма заказа автоматически уходит в бухгалтерию
function moveToCompleted(id) {
  const order = getOrderRaw(id);
  if (!order) return { error: 'not_found' };
  if (order.status !== 'delivering') return { error: 'bad_transition' };
  order.status = 'completed';
  order.completed_at = new Date().toISOString();
  addLedgerEntry({ type: 'income', amount: order.total, description: `Заказ №${order.id}`, date: order.completed_at, auto: true, order_id: order.id });
  persist();
  return { order: attachItems(order) };
}

function setOrderPaid(id, paid) {
  const order = getOrderRaw(id);
  if (!order) return { error: 'not_found' };
  order.paid = !!paid;
  persist();
  return { order: attachItems(order) };
}

// ---------- Статистика личного кабинета ----------
function getUserStats(user_id) {
  const orders = data.orders.filter(o => o.user_id === user_id && o.status !== 'cancelled');
  return { ordersCount: orders.length, totalSpent: orders.reduce((sum, o) => sum + o.total, 0) };
}

// ---------- Бухгалтерия ----------
function addLedgerEntry({ type, amount, description, date, auto = false, order_id = null }) {
  const entry = {
    id: nextId('ledger'), type, amount: Number(amount), description: description || '',
    date: date || new Date().toISOString(), auto, order_id, created_at: new Date().toISOString()
  };
  data.ledger.push(entry);
  persist();
  return entry;
}

function getLedger() {
  return [...data.ledger].sort((a, b) => new Date(b.date) - new Date(a.date));
}

function getBalance() {
  return data.ledger.reduce((sum, e) => sum + (e.type === 'income' ? e.amount : -e.amount), 0);
}

// ---------- Общая статистика магазина ----------
function getShopStats() {
  const ordersByStatus = { processing: 0, delivering: 0, completed: 0 };
  data.orders.forEach(o => { if (ordersByStatus[o.status] !== undefined) ordersByStatus[o.status]++; });

  const completedOrders = data.orders.filter(o => o.status === 'completed');
  const totalRevenue = completedOrders.reduce((s, o) => s + o.total, 0);

  const productSales = {};
  completedOrders.forEach(o => {
    attachItems(o).items.forEach(i => {
      if (!productSales[i.product_id]) productSales[i.product_id] = { name: i.name, qty: 0, revenue: 0 };
      productSales[i.product_id].qty += i.qty;
      productSales[i.product_id].revenue += i.qty * i.price;
    });
  });
  const topProducts = Object.values(productSales).sort((a, b) => b.qty - a.qty).slice(0, 5);

  return {
    usersCount: data.users.length,
    productsCount: data.products.filter(p => p.active).length,
    ordersByStatus,
    totalOrders: data.orders.length,
    totalRevenue,
    balance: getBalance(),
    topProducts
  };
}

module.exports = {
  upsertUser, updateUser, getUser, getAllUsers, checkBirthDateCooldown,
  getProducts, getProduct, createProduct, updateProduct, hideProduct, deleteProductHard,
  addStock, removeStock, sanitizeProduct, nearestExpiry,
  createOrder, getOrdersByUser, getAllOrders, getUserStats,
  getOrderRaw, updateOrder, cancelOrder, moveToDelivering, moveToCompleted, setOrderPaid,
  countActiveOrders, MAX_ACTIVE_ORDERS,
  addLedgerEntry, getLedger, getBalance, getShopStats
};
