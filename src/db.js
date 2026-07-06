const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '..', 'data.json');

function loadDefault() {
  return {
    users: [],
    products: [
      { id: 1, name: 'Витамин D3 4000 МЕ', description: '60 капсул, поддержка иммунитета и костей', price: 890, category: 'Витамины', image_url: '', stock: 25, active: true, created_at: new Date().toISOString() },
      { id: 2, name: 'Магний B6', description: '90 таблеток, нервная система и сон', price: 650, category: 'Витамины', image_url: '', stock: 40, active: true, created_at: new Date().toISOString() },
      { id: 3, name: 'Сывороточный протеин 900г', description: 'Шоколад, 30г белка на порцию', price: 2490, category: 'Спортпит', image_url: '', stock: 15, active: true, created_at: new Date().toISOString() },
      { id: 4, name: 'Омега-3 1000мг', description: '90 капсул, рыбий жир высокой очистки', price: 1190, category: 'Витамины', image_url: '', stock: 30, active: true, created_at: new Date().toISOString() }
    ],
    orders: [],
    order_items: [],
    seq: { users: 1, products: 5, orders: 1, order_items: 1 }
  };
}

let data;
if (fs.existsSync(DB_FILE)) {
  data = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
} else {
  data = loadDefault();
  persist();
}

function persist() {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function nextId(table) {
  return data.seq[table]++;
}

// ---------- Users ----------
function upsertUser({ telegram_id, username, first_name, last_name }) {
  let user = data.users.find(u => u.telegram_id === telegram_id);
  if (user) {
    Object.assign(user, { username, first_name, last_name });
  } else {
    user = { id: nextId('users'), telegram_id, username, first_name, last_name, phone: '', address: '', created_at: new Date().toISOString() };
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

// ---------- Products ----------
function getProducts({ onlyActive } = {}) {
  const list = onlyActive ? data.products.filter(p => p.active) : data.products;
  return [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function getProduct(id) {
  return data.products.find(p => p.id === Number(id));
}

function createProduct(fields) {
  const product = {
    id: nextId('products'),
    name: fields.name,
    description: fields.description || '',
    price: Number(fields.price),
    category: fields.category || '',
    image_url: fields.image_url || '',
    stock: Number(fields.stock) || 0,
    active: true,
    created_at: new Date().toISOString()
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
    category: fields.category ?? product.category,
    image_url: fields.image_url ?? product.image_url,
    stock: fields.stock != null ? Number(fields.stock) : product.stock,
    active: fields.active != null ? !!fields.active : product.active
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

// ---------- Orders ----------
function createOrder({ user_id, items, comment, phone, address }) {
  let total = 0;
  const resolvedItems = [];
  for (const item of items) {
    const product = getProduct(item.product_id);
    if (!product || !product.active) continue;
    const qty = Math.max(1, Number(item.qty) || 1);
    resolvedItems.push({ product_id: product.id, name: product.name, price: product.price, qty });
    total += product.price * qty;
  }
  if (resolvedItems.length === 0) return null;

  const order = {
    id: nextId('orders'),
    user_id,
    status: 'new',
    total,
    comment: comment || '',
    phone: phone || '',
    address: address || '',
    created_at: new Date().toISOString()
  };
  data.orders.push(order);

  const items_ = resolvedItems.map(i => ({ id: nextId('order_items'), order_id: order.id, ...i }));
  data.order_items.push(...items_);
  persist();

  return { ...order, items: items_ };
}

function attachItems(order) {
  return { ...order, items: data.order_items.filter(i => i.order_id === order.id) };
}

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

function updateOrderStatus(id, status) {
  const order = data.orders.find(o => o.id === Number(id));
  if (!order) return null;
  order.status = status;
  persist();
  return order;
}

module.exports = {
  upsertUser, updateUser,
  getProducts, getProduct, createProduct, updateProduct, hideProduct, deleteProductHard,
  createOrder, getOrdersByUser, getAllOrders, updateOrderStatus
};
