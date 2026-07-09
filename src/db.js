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
const BONUS_PERIOD_MONTHS = 6;
const BONUS_TIERS = [
  { name: 'Платиновый', min: 10000, rate: 0.10 },
  { name: 'Золотой', min: 6000, rate: 0.07 },
  { name: 'Серебряный', min: 3000, rate: 0.05 },
  { name: 'Бронзовый', min: 0, rate: 0.03 },
];
const BONUS_EXPIRY_MONTHS = 3;
const REFERRAL_RATE = 0.05;
const REFERRAL_QUALIFY_MIN = 500;
const REFERRAL_LADDER = [
  { count: 1, bonus: 100 }, { count: 3, bonus: 300 }, { count: 5, bonus: 500 },
  { count: 10, bonus: 1000 }, { count: 20, bonus: 2000 }
];
const BIRTHDAY_DISCOUNT_RATE = 0.15;
const CONSULTANT_DISCOUNT_RATE = 0.10;
const CONSULTANT_SESSION_TTL_HOURS = 24;
const BIRTHDAY_WINDOW_DAYS = 7;
const MAX_BONUS_PAYMENT_SHARE = 0.5;
const SIGNUP_BONUS = 100;
const REVIEW_BONUS = 50;
const DELIVERY_TIERS = [
  { max: 500, cost: 300 },
  { max: 1000, cost: 200 },
  { max: 1500, cost: 100 },
  { max: Infinity, cost: 0 }
];

function getDeliveryCost(itemsTotal) {
  return DELIVERY_TIERS.find(t => itemsTotal < t.max).cost;
}

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

const DEFAULT_MESSAGE_TEMPLATES = {
  welcome: `Привет! 👋 Я бот-помощник магазина <b>HealthTeam</b> — БАДы, витамины и спортивное питание.

Что у нас есть:
🌿 <b>Каталог</b> — БАДы и спортпит с поиском, фильтром по производителю и сортировкой
🎁 <b>Бонусная система</b> — кэшбек 3–10% с каждой покупки, действует 3 месяца
🤝 <b>Реферальная система</b> — приглашайте друзей и получайте 5% с их покупок навсегда
🎂 <b>Скидка на день рождения</b> — 15% на один заказ
🚚 <b>Доставка</b> — от 0 до 300₽, от 1500₽ — бесплатно

Жмите кнопку ниже, чтобы открыть магазин 👇

А ещё можно просто написать мне прямо сюда, чем вы занимаетесь и какая у вас цель — я подберу подходящие БАДы и спортпит и всё подробно расскажу, не выходя из этого чата 💬`,
  assistant_intro: `Привет! Меня зовут Бот-помощник HealthTeam 🤖

Готов выслушать все твои пожелания и подобрать то, что реально нужно — БАДы, витамины или спортпит под твои цели.

Расскажи: чем занимаешься, какая цель (похудение, набор массы, энергия, форма), каким спортом занимаешься и какой у тебя рост и вес — и я всё подберу 💪`,
  order_review_request: `Заказ №{order_id} доставлен! 🎉

Спасибо, что выбрали HealthTeam. Будем рады, если оцените заказ — это займёт минуту, а за отзыв начислим <b>50 бонусов</b> на ваш счёт.`,
  dosage_advice_header: 'Как принимать то, что вы купили:',
  dosage_advice_footer: 'Могу присылать напоминания в удобное время, чтобы вы точно не забыли 👇',
  admin_new_order: `🛒 <b>Новый заказ №{order_id}</b>

{buyer_name} · @{buyer_username}
Телефон: {phone}

{items}

Сумма: {total} ₽`,
  order_placed_thankyou: `Спасибо за заказ №{order_id}! 🙏

Наш менеджер скоро свяжется с вами для уточнения деталей доставки.`,
  idle_nudge: `Эй, друг 👋 Ты заглянул в каталог, но ничего не выбрал.

Давай я подскажу, что подойдёт именно тебе — просто напиши любое слово, и я задам пару вопросов 💬`,
  cart_nudge: `Корзина уже собрана 🛒 Осталось только оформить заказ.

Или тебе нужна ещё какая-то информация о товарах? Давай подскажу/помогу — просто напиши 💬`,
  webapp_nudge: `Мы в ответе за тех, кого приручили... 🦊

Пообщались, а ты даже не открыл веб-приложение — ну разве так можно? Там весь каталог, твоя подборка и скидка ждут 👇`,
  reminder_message: `⏰ Напоминание ({slot})

Время принять:
{items}`
};

function loadDefault() {
  const products = seedProducts();
  return {
    users: [], products, orders: [], order_items: [], ledger: [], bonus_tx: [], consultant_sessions: [],
    notifications: [], reviews: [], reminder_items: [], bot_chat_logs: [],
    message_templates: { ...DEFAULT_MESSAGE_TEMPLATES },
    seq: { users: 1, products: products.length + 1, orders: 1, order_items: 1, batches: products.length + 1, ledger: 1, bonus_tx: 1, consultant_sessions: 1, notifications: 1, reviews: 1, reminder_items: 1, bot_chat_logs: 1 }
  };
}

let data;
if (fs.existsSync(DB_FILE)) {
  data = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  if (!data.ledger) data.ledger = [];
  if (!data.bonus_tx) data.bonus_tx = [];
  if (!data.consultant_sessions) data.consultant_sessions = [];
  if (!data.notifications) data.notifications = [];
  if (!data.reviews) data.reviews = [];
  if (!data.reminder_items) data.reminder_items = [];
  if (!data.bot_chat_logs) data.bot_chat_logs = [];
  if (!data.message_templates) data.message_templates = { ...DEFAULT_MESSAGE_TEMPLATES };
  else Object.keys(DEFAULT_MESSAGE_TEMPLATES).forEach(k => { if (!(k in data.message_templates)) data.message_templates[k] = DEFAULT_MESSAGE_TEMPLATES[k]; });
  if (!data.seq.ledger) data.seq.ledger = 1;
  if (!data.seq.batches) data.seq.batches = 1;
  if (!data.seq.bonus_tx) data.seq.bonus_tx = 1;
  if (!data.seq.consultant_sessions) data.seq.consultant_sessions = 1;
  if (!data.seq.notifications) data.seq.notifications = 1;
  if (!data.seq.reviews) data.seq.reviews = 1;
  if (!data.seq.reminder_items) data.seq.reminder_items = 1;
  if (!data.seq.bot_chat_logs) data.seq.bot_chat_logs = 1;
  data.users.forEach(u => {
    if (u.bonus_balance === undefined) u.bonus_balance = 0;
    if (u.first_purchase_at === undefined) u.first_purchase_at = null;
    if (u.admin_note === undefined) u.admin_note = '';
    if (u.referred_by === undefined) u.referred_by = null;
    if (u.referral_milestones_awarded === undefined) u.referral_milestones_awarded = [];
    if (u.birthday_discount_used_at === undefined) u.birthday_discount_used_at = null;
    if (u.reminders === undefined) {
      u.reminders = {
        morning: { time: '09:00', enabled: false, last_sent: null },
        day: { time: '14:00', enabled: false, last_sent: null },
        evening: { time: '20:00', enabled: false, last_sent: null }
      };
    }
    if (u.idle_check_due_at === undefined) u.idle_check_due_at = null;
    if (u.idle_nudge_sent === undefined) u.idle_nudge_sent = true;
    if (u.cart_updated_at === undefined) u.cart_updated_at = null;
    if (u.cart_nudge_sent === undefined) u.cart_nudge_sent = true;
    if (u.webapp_opened_at === undefined) u.webapp_opened_at = u.created_at || new Date().toISOString();
    if (u.bot_chat_nudge_due_at === undefined) u.bot_chat_nudge_due_at = null;
    if (u.webapp_nudge_sent === undefined) u.webapp_nudge_sent = true;
    // Переносим старый простой баланс в новую систему бонусов с историей (разово, при миграции)
    if (u.bonus_balance > 0 && !data.bonus_tx.some(t => t.user_id === u.id)) {
      const now = new Date();
      const expires = new Date(now); expires.setMonth(expires.getMonth() + BONUS_EXPIRY_MONTHS);
      data.bonus_tx.push({
        id: data.seq.bonus_tx++, user_id: u.id, type: 'cashback', amount: u.bonus_balance,
        remaining: u.bonus_balance, created_at: now.toISOString(), expires_at: expires.toISOString(),
        order_id: null, description: 'Перенос баланса из старой системы'
      });
    }
    // Доначисляем приветственный бонус тем, кто зарегистрировался до введения этой механики
    if (!data.bonus_tx.some(t => t.user_id === u.id && t.type === 'signup')) {
      const now = new Date();
      const expires = new Date(now); expires.setMonth(expires.getMonth() + BONUS_EXPIRY_MONTHS);
      data.bonus_tx.push({
        id: data.seq.bonus_tx++, user_id: u.id, type: 'signup', amount: SIGNUP_BONUS,
        remaining: SIGNUP_BONUS, created_at: now.toISOString(), expires_at: expires.toISOString(),
        order_id: null, description: 'Приветственный бонус (начислен при обновлении)'
      });
    }
  });
  persist();
} else {
  data = loadDefault();
  persist();
}

function persist() { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); }
function nextId(table) { return data.seq[table]++; }

// ---------- Users ----------
function upsertUser({ telegram_id, username, first_name, last_name, viaWebapp = false }) {
  let user = data.users.find(u => u.telegram_id === telegram_id);
  if (user) {
    user.username = username;
    if (!user.first_name) user.first_name = first_name;
    if (!user.last_name) user.last_name = last_name;
    if (viaWebapp) markWebappOpened(user);
  } else {
    user = {
      id: nextId('users'), telegram_id, username, first_name, last_name,
      phone: '', address: '', birth_date: null, birth_date_updated_at: null,
      bonus_balance: 0, first_purchase_at: null,
      referred_by: null, referral_milestones_awarded: [], birthday_discount_used_at: null,
      admin_note: '',
      reminders: {
        morning: { time: '09:00', enabled: false, last_sent: null },
        day: { time: '14:00', enabled: false, last_sent: null },
        evening: { time: '20:00', enabled: false, last_sent: null }
      },
      idle_check_due_at: null, idle_nudge_sent: true, cart_updated_at: null, cart_nudge_sent: true,
      webapp_opened_at: viaWebapp ? new Date().toISOString() : null,
      bot_chat_nudge_due_at: null, webapp_nudge_sent: true,
      created_at: new Date().toISOString()
    };
    data.users.push(user);
    addEarnTx(user.id, 'signup', SIGNUP_BONUS, null, 'Бонус за регистрацию');
  }
  persist();
  return user;
}

// Отмечает, что пользователь открыл веб-приложение — отменяет напоминание "пообщались, а ты не открыл"
function markWebappOpened(user) {
  user.webapp_opened_at = new Date().toISOString();
  user.bot_chat_nudge_due_at = null;
  user.webapp_nudge_sent = true;
}

// Вызывается ботом при каждом сообщении пользователя — регистрирует его в базе (если это первое
// обращение вообще, хоть через бот, хоть через приложение) и ставит таймер напоминания "открой приложение"
function recordBotChat({ telegram_id, username, first_name, last_name }) {
  const user = upsertUser({ telegram_id, username, first_name, last_name, viaWebapp: false });
  if (!user.webapp_opened_at) {
    user.bot_chat_nudge_due_at = new Date(Date.now() + 60 * 60000).toISOString();
    user.webapp_nudge_sent = false;
    persist();
  }
  return user;
}

function findDueWebappNudges(now = new Date()) {
  return data.users.filter(u =>
    !u.webapp_opened_at && u.bot_chat_nudge_due_at && !u.webapp_nudge_sent && new Date(u.bot_chat_nudge_due_at) <= now
  );
}
function markWebappNudgeSent(user_id) {
  const user = getUser(user_id);
  if (user) { user.webapp_nudge_sent = true; persist(); }
}

// Привязывает пользователя к пригласившему (один раз, при первом визите по реф-ссылке)
function setReferrer(user_id, referrerTelegramId) {
  const user = getUser(user_id);
  if (!user) return { error: 'not_found' };
  if (user.referred_by) return { error: 'already_set' };
  if (String(referrerTelegramId) === String(user.telegram_id)) return { error: 'self_referral' };
  const referrer = data.users.find(u => u.telegram_id === String(referrerTelegramId));
  if (!referrer) return { error: 'referrer_not_found' };
  user.referred_by = referrer.telegram_id;
  persist();
  return { ok: true };
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
function itemsOfOrder(orderId) { return data.order_items.filter(i => i.order_id === orderId); }

// Списывает со склада все товары заказа (вызывается при переходе в "Доставляем")
function deductStockForOrder(order) {
  itemsOfOrder(order.id).forEach(i => removeStock(i.product_id, i.qty));
}

// Возвращает на склад все товары заказа (вызывается при отмене уже списанного заказа)
function restoreStockForOrder(order) {
  itemsOfOrder(order.id).forEach(i => {
    if (getProduct(i.product_id)) addStock(i.product_id, i.qty, null);
  });
}

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

function createOrder({ user_id, items, comment, phone, address, use_bonus, use_birthday_discount, use_consultant_discount }) {
  if (countActiveOrders(user_id) >= MAX_ACTIVE_ORDERS) return { error: 'too_many_active_orders', limit: MAX_ACTIVE_ORDERS };
  const resolved = resolveItems(items);
  if (resolved.error) return resolved;
  if (resolved.resolvedItems.length === 0) return { error: 'no_valid_items' };

  const user = getUser(user_id);
  let total = resolved.total;
  let birthdayDiscountAmount = 0;
  let birthdayApplied = false;
  let consultantDiscountAmount = 0;
  let consultantApplied = false;
  let consultantSessionToMark = null;

  if (use_birthday_discount && user) {
    const bd = getBirthdayDiscountInfo(user);
    if (bd.eligible) {
      birthdayDiscountAmount = Math.round(total * BIRTHDAY_DISCOUNT_RATE);
      total -= birthdayDiscountAmount;
      birthdayApplied = true;
    }
  }
  // Скидки не суммируются — если ДР уже применена, скидку консультанта не даём
  if (!birthdayApplied && use_consultant_discount && user) {
    const session = findValidConsultantSession(user_id, resolved.resolvedItems.map(i => i.product_id));
    if (session) {
      consultantDiscountAmount = Math.round(total * CONSULTANT_DISCOUNT_RATE);
      total -= consultantDiscountAmount;
      consultantApplied = true;
      consultantSessionToMark = session.id;
    }
  }

  let bonusRedeemed = 0;
  const requestedBonus = Math.max(0, Number(use_bonus) || 0);
  if (requestedBonus > 0) {
    const maxByShare = Math.floor(total * MAX_BONUS_PAYMENT_SHARE);
    const available = getBonusBalance(user_id);
    bonusRedeemed = Math.min(requestedBonus, maxByShare, available);
    if (bonusRedeemed > 0) redeemBonuses(user_id, bonusRedeemed, null); // order_id проставим ниже, после создания
  }

  const paidAmount = total - bonusRedeemed;
  const deliveryCost = getDeliveryCost(resolved.total);
  const payableTotal = paidAmount + deliveryCost;

  const order = {
    id: nextId('orders'), user_id, status: 'processing', paid: false,
    total: resolved.total, birthday_discount_applied: birthdayApplied, birthday_discount_amount: birthdayDiscountAmount,
    consultant_discount_applied: consultantApplied, consultant_discount_amount: consultantDiscountAmount,
    bonus_redeemed: bonusRedeemed, delivery_cost: deliveryCost, paid_amount: paidAmount, payable_total: payableTotal,
    comment: comment || '', admin_comment: '',
    phone: phone || '', address: address || '', created_at: new Date().toISOString()
  };
  data.orders.push(order);
  const items_ = resolved.resolvedItems.map(i => ({ id: nextId('order_items'), order_id: order.id, ...i }));
  data.order_items.push(...items_);

  // Проставляем order_id в записи о списании бонусов и отмечаем применение скидки ДР
  if (bonusRedeemed > 0) {
    const tx = data.bonus_tx.filter(t => t.user_id === user_id && t.type === 'redeem' && t.order_id === null).pop();
    if (tx) tx.order_id = order.id;
  }
  if (birthdayApplied) user.birthday_discount_used_at = new Date().toISOString();
  if (consultantSessionToMark) markConsultantSessionUsed(consultantSessionToMark);

  persist();
  return { order: { ...order, items: items_ } };
}

function attachItems(order) { return { ...order, items: data.order_items.filter(i => i.order_id === order.id) }; }
function getOrderRaw(id) { return data.orders.find(o => o.id === Number(id)); }

// Ручное оформление продажи админом (товар продан не через бота) — сразу "Выполнено",
// списывает склад и добавляет сумму в бухгалтерию + начисляет кэшбек, как обычный заказ
function createManualOrder({ user_id, items, description, discount }) {
  const resolved = resolveItems(items);
  if (resolved.error) return resolved;
  if (resolved.resolvedItems.length === 0) return { error: 'no_valid_items' };

  const discountAmount = Math.max(0, Math.min(Number(discount) || 0, resolved.total));
  const paidAmount = resolved.total - discountAmount;

  const now = new Date().toISOString();
  const order = {
    id: nextId('orders'), user_id, status: 'completed', paid: true,
    total: resolved.total, manual_discount: discountAmount,
    paid_amount: paidAmount, payable_total: paidAmount, delivery_cost: 0, bonus_redeemed: 0, birthday_discount_applied: false, birthday_discount_amount: 0,
    comment: description || 'Продажа оформлена вручную', admin_comment: '',
    phone: '', address: 'Продажа оформлена вручную (без доставки)',
    created_at: now, completed_at: now
  };
  data.orders.push(order);
  const items_ = resolved.resolvedItems.map(i => ({ id: nextId('order_items'), order_id: order.id, ...i }));
  data.order_items.push(...items_);

  resolved.resolvedItems.forEach(i => removeStock(i.product_id, i.qty));
  awardCashback(order);
  awardReferral(order);
  addLedgerEntry({ type: 'income', amount: paidAmount, description: `Заказ №${order.id} (вручную)${discountAmount ? `, скидка ${discountAmount}₽` : ''}`, date: now, auto: true, order_id: order.id });
  persist();
  return { order: attachItems(order) };
}

function getOrdersByUser(user_id) {
  return data.orders.filter(o => o.user_id === user_id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(attachItems);
}

function getAllOrders() {
  return data.orders
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(o => {
      const user = data.users.find(u => u.id === o.user_id) || {};
      return { ...attachItems(o), first_name: user.first_name, last_name: user.last_name, username: user.username, telegram_id: user.telegram_id, buyer_note: user.admin_note };
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
  order.delivery_cost = getDeliveryCost(resolved.total);
  const afterBirthday = resolved.total - (order.birthday_discount_amount || 0);
  order.paid_amount = afterBirthday - (order.bonus_redeemed || 0);
  order.payable_total = order.paid_amount + order.delivery_cost;
  if (address !== undefined) order.address = address;
  if (comment !== undefined) order.comment = comment;
  persist();
  return { order: attachItems(order) };
}

// isAdmin=false: пользователь отменяет свой заказ, только пока статус "processing"
// isAdmin=true: админ может отменить/удалить заказ на любом этапе — товар возвращается на склад,
// а если заказ уже был выполнен — сторнируется автозапись в бухгалтерии и списанный кэшбек
function adminOrUserCancel(id, { isAdmin } = {}) {
  const order = getOrderRaw(id);
  if (!order) return { error: 'not_found' };

  if (!isAdmin) {
    if (order.status !== 'processing') return { error: 'not_cancellable' };
    if (order.bonus_redeemed > 0) refundBonuses(order.user_id, order.bonus_redeemed, order.id);
    data.orders = data.orders.filter(o => o.id !== order.id);
    data.order_items = data.order_items.filter(i => i.order_id !== order.id);
    persist();
    return { ok: true };
  }

  if (order.status === 'delivering' || order.status === 'completed') {
    restoreStockForOrder(order);
  }
  if (order.bonus_redeemed > 0) refundBonuses(order.user_id, order.bonus_redeemed, order.id);
  if (order.status === 'completed') {
    data.ledger = data.ledger.filter(e => !(e.order_id === order.id && e.auto));
    revokeEarnedForOrder(order.id);
    removeReviewForOrder(order.id);
  }
  data.orders = data.orders.filter(o => o.id !== order.id);
  data.order_items = data.order_items.filter(i => i.order_id !== order.id);
  persist();
  return { ok: true };
}

// "В обработке" -> "Доставляем": обязателен комментарий админа (время/место доставки), товар списывается со склада
function moveToDelivering(id, adminComment) {
  const order = getOrderRaw(id);
  if (!order) return { error: 'not_found' };
  if (order.status !== 'processing') return { error: 'bad_transition' };
  if (!adminComment || !adminComment.trim()) return { error: 'admin_comment_required' };
  order.status = 'delivering';
  order.admin_comment = adminComment.trim();
  deductStockForOrder(order);
  persist();
  return { order: attachItems(order) };
}

// "Доставляем" -> "Выполнено": сумма заказа автоматически уходит в бухгалтерию, начисляется кэшбек
function moveToCompleted(id) {
  const order = getOrderRaw(id);
  if (!order) return { error: 'not_found' };
  if (order.status !== 'delivering') return { error: 'bad_transition' };
  order.status = 'completed';
  order.completed_at = new Date().toISOString();
  awardCashback(order);
  awardReferral(order);
  addLedgerEntry({ type: 'income', amount: order.payable_total != null ? order.payable_total : order.total, description: `Заказ №${order.id}`, date: order.completed_at, auto: true, order_id: order.id });
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

// ---------- Бонусы: транзакции (начисления сгорают через 3 месяца, списание — FIFO) ----------
function addEarnTx(user_id, type, amount, order_id, description) {
  if (amount <= 0) return;
  const now = new Date();
  const expires = new Date(now); expires.setMonth(expires.getMonth() + BONUS_EXPIRY_MONTHS);
  data.bonus_tx.push({
    id: nextId('bonus_tx'), user_id, type, amount, remaining: amount,
    created_at: now.toISOString(), expires_at: expires.toISOString(),
    order_id, description
  });
}

function getBonusBalance(user_id) {
  const now = new Date();
  return data.bonus_tx
    .filter(t => t.user_id === user_id && t.remaining > 0 && new Date(t.expires_at) > now)
    .reduce((sum, t) => sum + t.remaining, 0);
}

// Списывает бонусы (FIFO — сначала те, что сгорят раньше), возвращает {ok, redeemed} либо {error}
function redeemBonuses(user_id, amount, order_id) {
  if (amount <= 0) return { ok: true, redeemed: 0 };
  const available = getBonusBalance(user_id);
  if (amount > available) return { error: 'insufficient_bonus', available };
  const now = new Date();
  let remaining = amount;
  const earners = data.bonus_tx
    .filter(t => t.user_id === user_id && t.remaining > 0 && new Date(t.expires_at) > now)
    .sort((a, b) => new Date(a.expires_at) - new Date(b.expires_at));
  for (const tx of earners) {
    if (remaining <= 0) break;
    const take = Math.min(tx.remaining, remaining);
    tx.remaining -= take;
    remaining -= take;
  }
  data.bonus_tx.push({
    id: nextId('bonus_tx'), user_id, type: 'redeem', amount, remaining: 0,
    created_at: now.toISOString(), expires_at: now.toISOString(), order_id,
    description: `Списание бонусов на заказ №${order_id}`
  });
  return { ok: true, redeemed: amount };
}

// Возврат списанных бонусов (при отмене заказа) — новым начислением с новым сроком сгорания
function refundBonuses(user_id, amount, order_id) {
  if (amount > 0) addEarnTx(user_id, 'refund', amount, order_id, `Возврат бонусов за отменённый заказ №${order_id}`);
}

// Аннулирует начисленный за заказ кэшбек/реферальный бонус (при отмене выполненного заказа)
function revokeEarnedForOrder(order_id) {
  data.bonus_tx.forEach(t => {
    if (t.order_id === order_id && ['cashback', 'referral', 'referral_ladder', 'review'].includes(t.type) && t.remaining > 0) {
      t.remaining = 0;
      t.revoked = true;
    }
  });
}

// Удаляет отзыв, привязанный к заказу (если был), и аннулирует бонус за него.
// Возвращает заказу возможность получить новый отзыв (reviewed = false).
function removeReviewForOrder(order_id) {
  const review = data.reviews.find(r => r.order_id === order_id);
  if (!review) return;
  data.reviews = data.reviews.filter(r => r.id !== review.id);
  data.bonus_tx.forEach(t => {
    if (t.order_id === order_id && t.type === 'review' && t.remaining > 0) { t.remaining = 0; t.revoked = true; }
  });
  const order = getOrderRaw(order_id);
  if (order) order.reviewed = false;
}

// Ручное удаление отзыва администратором (не связано с удалением заказа)
function deleteReview(review_id) {
  const review = data.reviews.find(r => r.id === Number(review_id));
  if (!review) return { error: 'not_found' };
  data.reviews = data.reviews.filter(r => r.id !== review.id);
  data.bonus_tx.forEach(t => {
    if (t.order_id === review.order_id && t.type === 'review' && t.remaining > 0) { t.remaining = 0; t.revoked = true; }
  });
  const order = getOrderRaw(review.order_id);
  if (order) order.reviewed = false;
  persist();
  return { ok: true };
}

function getBonusHistory(user_id) {
  const now = new Date();
  return data.bonus_tx.filter(t => t.user_id === user_id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(t => {
      let status = 'active';
      if (t.type === 'redeem') status = 'spent';
      else if (t.revoked) status = 'revoked';
      else if (t.remaining <= 0) status = 'used';
      else if (new Date(t.expires_at) <= now) status = 'expired';
      return { ...t, status };
    });
}

const TX_LABELS = {
  cashback: 'Кэшбек', referral: 'Бонус за реферала', referral_ladder: 'Реферальная лесенка',
  redeem: 'Списание на заказ', refund: 'Возврат за отменённый заказ', signup: 'Бонус за регистрацию'
};

// ---------- Бонусная программа: уровни кэшбека ----------
function getBonusTier(periodSpent) {
  return BONUS_TIERS.find(t => periodSpent >= t.min);
}

// Границы текущего 6-месячного периода, отсчитываемого от даты первой покупки
function getBonusPeriodBounds(firstPurchaseAt, now = new Date()) {
  let start = new Date(firstPurchaseAt);
  let end = new Date(start);
  end.setMonth(end.getMonth() + BONUS_PERIOD_MONTHS);
  while (end <= now) {
    start = new Date(end);
    end = new Date(start);
    end.setMonth(end.getMonth() + BONUS_PERIOD_MONTHS);
  }
  return { periodStart: start, periodEnd: end };
}

function getPeriodSpent(user_id, periodStart, periodEnd) {
  return data.orders
    .filter(o => o.user_id === user_id && o.status === 'completed' && o.completed_at)
    .filter(o => {
      const d = new Date(o.completed_at);
      return d >= periodStart && d < periodEnd;
    })
    .reduce((sum, o) => sum + (o.paid_amount != null ? o.paid_amount : o.total), 0);
}

function getBonusInfo(user) {
  const tiersAsc = [...BONUS_TIERS].sort((a, b) => a.min - b.min);
  const balance = getBonusBalance(user.id);
  if (!user.first_purchase_at) {
    const tier = getBonusTier(0);
    const next = tiersAsc.find(t => t.min > 0);
    return {
      balance, tier: tier.name, rate: tier.rate,
      periodSpent: 0, periodStart: null, periodEnd: null,
      nextTierThreshold: next ? next.min : null, isMaxTier: !next
    };
  }
  const { periodStart, periodEnd } = getBonusPeriodBounds(user.first_purchase_at);
  const periodSpent = getPeriodSpent(user.id, periodStart, periodEnd);
  const tier = getBonusTier(periodSpent);
  const next = tiersAsc.find(t => t.min > tier.min);
  return {
    balance, tier: tier.name, rate: tier.rate,
    periodSpent, periodStart: periodStart.toISOString(), periodEnd: periodEnd.toISOString(),
    nextTierThreshold: next ? next.min : null, isMaxTier: !next
  };
}

// Начисляет кэшбек за выполненный заказ — считается от ОПЛАЧЕННОЙ суммы (total минус списанные бонусы и скидка ДР)
function awardCashback(order) {
  const user = getUser(order.user_id);
  if (!user) return 0;
  if (!user.first_purchase_at) user.first_purchase_at = order.completed_at;

  const base = order.paid_amount != null ? order.paid_amount : order.total;
  const { periodStart, periodEnd } = getBonusPeriodBounds(user.first_purchase_at);
  const periodSpent = getPeriodSpent(user.id, periodStart, periodEnd);
  const tier = getBonusTier(periodSpent);
  const cashback = Math.round(base * tier.rate);

  if (cashback > 0) addEarnTx(user.id, 'cashback', cashback, order.id, `Кэшбек за заказ №${order.id}`);
  order.cashback_awarded = cashback;
  order.cashback_tier = tier.name;
  return cashback;
}

// Реферальные начисления: 5% пригласившему + проверка реферальной "лесенки"
function awardReferral(order) {
  const buyer = getUser(order.user_id);
  if (!buyer || !buyer.referred_by) return;
  const referrer = data.users.find(u => u.telegram_id === buyer.referred_by);
  if (!referrer) return;

  const base = order.paid_amount != null ? order.paid_amount : order.total;
  const commission = Math.round(base * REFERRAL_RATE);
  if (commission > 0) addEarnTx(referrer.id, 'referral', commission, order.id, `5% с покупки реферала (заказ №${order.id})`);

  // Считаем, сколько рефералов уже "квалифицировались" (сумма покупок >= 500₽), и выдаём лесенку
  const referredUsers = data.users.filter(u => u.referred_by === referrer.telegram_id);
  const qualifyingCount = referredUsers.filter(ru => {
    const spent = data.orders.filter(o => o.user_id === ru.id && o.status === 'completed')
      .reduce((s, o) => s + (o.paid_amount != null ? o.paid_amount : o.total), 0);
    return spent >= REFERRAL_QUALIFY_MIN;
  }).length;

  REFERRAL_LADDER.forEach(tier => {
    if (qualifyingCount >= tier.count && !referrer.referral_milestones_awarded.includes(tier.count)) {
      addEarnTx(referrer.id, 'referral_ladder', tier.bonus, order.id, `Лесенка: ${tier.count} реферал(ов) с покупками от ${REFERRAL_QUALIFY_MIN}₽`);
      referrer.referral_milestones_awarded.push(tier.count);
    }
  });
}

// ---------- Скидка ко дню рождения ----------
function getBirthdayWindow(birthDate, now = new Date()) {
  const bd = new Date(birthDate);
  for (const yearOffset of [-1, 0, 1]) {
    const bday = new Date(now.getFullYear() + yearOffset, bd.getMonth(), bd.getDate());
    const start = new Date(bday); start.setDate(start.getDate() - BIRTHDAY_WINDOW_DAYS);
    const end = new Date(bday); end.setDate(end.getDate() + BIRTHDAY_WINDOW_DAYS + 1); // +1 включительно весь последний день
    if (now >= start && now < end) return { start, end, bday };
  }
  return null;
}

function getBirthdayDiscountInfo(user) {
  if (!user.birth_date) return { eligible: false };
  const window = getBirthdayWindow(user.birth_date);
  if (!window) return { eligible: false };
  const usedAt = user.birthday_discount_used_at ? new Date(user.birthday_discount_used_at) : null;
  const alreadyUsed = usedAt && usedAt >= window.start && usedAt < window.end;
  return { eligible: !alreadyUsed, rate: BIRTHDAY_DISCOUNT_RATE, windowEnd: window.end.toISOString() };
}

// ---------- Бот-консультант: сессия подбора и скидка 10% на набор ----------
function createConsultantSession(user_id, product_ids) {
  const session = {
    id: nextId('consultant_sessions'), user_id, product_ids: [...new Set(product_ids.map(Number))],
    created_at: new Date().toISOString(), used: false
  };
  data.consultant_sessions.push(session);
  persist();
  return session;
}

// Заказ имеет право на скидку, если есть недавняя неиспользованная сессия подбора,
// и ВСЕ товары в заказе входят в рекомендованный набор из этой сессии
function findValidConsultantSession(user_id, orderProductIds) {
  const cutoff = new Date(Date.now() - CONSULTANT_SESSION_TTL_HOURS * 3600 * 1000);
  const candidates = data.consultant_sessions
    .filter(s => s.user_id === user_id && !s.used && new Date(s.created_at) > cutoff)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return candidates.find(s => orderProductIds.length > 0 && orderProductIds.every(id => s.product_ids.includes(id))) || null;
}

function markConsultantSessionUsed(id) {
  const s = data.consultant_sessions.find(s => s.id === id);
  if (s) { s.used = true; persist(); }
}


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
  return [...data.ledger].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function deleteLedgerEntry(id) {
  const before = data.ledger.length;
  data.ledger = data.ledger.filter(e => e.id !== Number(id));
  persist();
  return { deleted: data.ledger.length < before };
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

// ---------- Уведомления ----------
function addNotification(user_id, title, body, meta = {}) {
  data.notifications.push({
    id: nextId('notifications'), user_id, title, body, meta,
    created_at: new Date().toISOString(), read: false
  });
  persist();
}

function getNotifications(user_id) {
  return data.notifications.filter(n => n.user_id === user_id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function getUnreadNotificationsCount(user_id) {
  return data.notifications.filter(n => n.user_id === user_id && !n.read).length;
}

function markAllNotificationsRead(user_id) {
  data.notifications.forEach(n => { if (n.user_id === user_id) n.read = true; });
  persist();
}

// ---------- Отзывы ----------
function submitReview(order_id, user_id, { product_quality, service_quality, delivery_speed, text, anonymous }) {
  order_id = Number(order_id);
  const order = getOrderRaw(order_id);
  if (!order) return { error: 'not_found' };
  if (order.user_id !== user_id) return { error: 'forbidden' };
  if (order.status !== 'completed') return { error: 'not_completed' };
  if (order.reviewed) return { error: 'already_reviewed' };

  const pq = Math.min(10, Math.max(1, Number(product_quality) || 0));
  const sq = Math.min(10, Math.max(1, Number(service_quality) || 0));
  const ds = Math.min(10, Math.max(1, Number(delivery_speed) || 0));
  if (!pq || !sq || !ds) return { error: 'bad_rating' };
  const avg = Math.round(((pq + sq + ds) / 3) * 10) / 10;

  const user = getUser(user_id);
  const review = {
    id: nextId('reviews'), order_id, user_id,
    product_quality: pq, service_quality: sq, delivery_speed: ds, avg,
    text: (text || '').trim(), anonymous: !!anonymous,
    author_name: anonymous ? 'Аноним' : `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Покупатель',
    created_at: new Date().toISOString()
  };
  data.reviews.push(review);
  order.reviewed = true;
  addEarnTx(user_id, 'review', REVIEW_BONUS, order_id, `Бонус за отзыв на заказ №${order_id}`);
  persist();
  return { review };
}

function getReviews({ page = 1, pageSize = 10 } = {}) {
  const all = [...data.reviews].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const total = all.length;
  const avg = total === 0 ? 0 : Math.round((all.reduce((s, r) => s + r.avg, 0) / total) * 10) / 10;
  const start = (page - 1) * pageSize;
  const items = all.slice(start, start + pageSize);
  return { items, total, avg, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}


// ---------- Напоминания о приёме ----------
const REMINDER_SLOTS = ['morning', 'day', 'evening'];

function getReminderData(user) {
  return { settings: user.reminders, items: data.reminder_items.filter(i => i.user_id === user.id) };
}

function setReminderSlot(user_id, slot, { time, enabled }) {
  if (!REMINDER_SLOTS.includes(slot)) return { error: 'bad_slot' };
  const user = getUser(user_id);
  if (!user) return { error: 'not_found' };
  if (time !== undefined) user.reminders[slot].time = time;
  if (enabled !== undefined) user.reminders[slot].enabled = !!enabled;
  persist();
  return { settings: user.reminders };
}

function addReminderItem(user_id, { name, dosage_qty, dosage_unit, timing, food_relation, source, order_id, product_id }) {
  const item = {
    id: nextId('reminder_items'), user_id,
    name: (name || '').trim(),
    dosage_qty: dosage_qty || 1,
    dosage_unit: (dosage_unit || 'шт.').trim(),
    timing: (timing || []).filter(t => REMINDER_SLOTS.includes(t)),
    food_relation: food_relation || '',
    source: source || 'manual',
    order_id: order_id || null,
    product_id: product_id || null,
    created_at: new Date().toISOString()
  };
  data.reminder_items.push(item);
  persist();
  return item;
}

function deleteReminderItem(id, user_id) {
  const item = data.reminder_items.find(i => i.id === Number(id));
  if (!item || item.user_id !== user_id) return { error: 'not_found' };
  data.reminder_items = data.reminder_items.filter(i => i.id !== item.id);
  persist();
  return { ok: true };
}

// Для планировщика: пользователи, у кого нужный слот включён и время совпадает с текущим,
// и напоминание в этот слот сегодня ещё не отправлялось
function findDueReminders(currentHHMM, todayStr) {
  const due = [];
  data.users.forEach(user => {
    REMINDER_SLOTS.forEach(slot => {
      const s = user.reminders && user.reminders[slot];
      if (s && s.enabled && s.time === currentHHMM && s.last_sent !== todayStr) {
        const items = data.reminder_items.filter(i => i.user_id === user.id && i.timing.includes(slot));
        if (items.length > 0) due.push({ user, slot, items });
      }
    });
  });
  return due;
}

function markReminderSent(user_id, slot, todayStr) {
  const user = getUser(user_id);
  if (user) { user.reminders[slot].last_sent = todayStr; persist(); }
}

// ---------- Редактируемые шаблоны сообщений бота ----------
function getAllTemplates() { return data.message_templates; }
function getTemplate(key) { return data.message_templates[key] ?? DEFAULT_MESSAGE_TEMPLATES[key] ?? ''; }
function setTemplate(key, text) {
  if (!(key in DEFAULT_MESSAGE_TEMPLATES)) return { error: 'unknown_key' };
  data.message_templates[key] = text;
  persist();
  return { ok: true };
}
function resetTemplate(key) {
  if (!(key in DEFAULT_MESSAGE_TEMPLATES)) return { error: 'unknown_key' };
  data.message_templates[key] = DEFAULT_MESSAGE_TEMPLATES[key];
  persist();
  return { ok: true };
}
// Простая подстановка {переменных} в шаблон
function renderTemplate(key, vars = {}) {
  let text = getTemplate(key);
  Object.entries(vars).forEach(([k, v]) => { text = text.split(`{${k}}`).join(v); });
  return text;
}

// ---------- Отслеживание активности (для мягких напоминаний "не закончил выбор / бросил корзину") ----------
const IDLE_NUDGE_MINUTES = 10;
const CART_NUDGE_MINUTES = 30;

function pingAppOpen(user_id) {
  const user = getUser(user_id);
  if (!user) return;
  const due = new Date(Date.now() + IDLE_NUDGE_MINUTES * 60000).toISOString();
  user.idle_check_due_at = due;
  user.idle_nudge_sent = false;
  persist();
}

function touchCart(user_id) {
  const user = getUser(user_id);
  if (!user) return;
  user.cart_updated_at = new Date().toISOString();
  user.cart_nudge_sent = false;
  // Раз человек что-то делает в приложении — не идле, не шлём "ты ничего не выбрал"
  user.idle_check_due_at = null;
  persist();
}

function clearCartTracking(user_id) {
  const user = getUser(user_id);
  if (!user) return;
  user.cart_updated_at = null;
  user.cart_nudge_sent = true;
  persist();
}

function findDueIdleNudges(now = new Date()) {
  return data.users.filter(u => u.idle_check_due_at && !u.idle_nudge_sent && new Date(u.idle_check_due_at) <= now);
}
function markIdleNudgeSent(user_id) {
  const user = getUser(user_id);
  if (user) { user.idle_nudge_sent = true; persist(); }
}

function findDueCartNudges(now = new Date()) {
  return data.users.filter(u =>
    u.cart_updated_at && !u.cart_nudge_sent &&
    (now - new Date(u.cart_updated_at)) >= CART_NUDGE_MINUTES * 60000
  );
}
function markCartNudgeSent(user_id) {
  const user = getUser(user_id);
  if (user) { user.cart_nudge_sent = true; persist(); }
}

// ---------- Логи переписки с ботом ----------
const MAX_BOT_CHAT_LOGS = 5000; // не даём файлу расти бесконечно

function logBotMessage(telegram_id, role, text) {
  const user = data.users.find(u => u.telegram_id === telegram_id);
  data.bot_chat_logs.push({
    id: nextId('bot_chat_logs'), telegram_id, user_id: user ? user.id : null,
    role, text, created_at: new Date().toISOString()
  });
  if (data.bot_chat_logs.length > MAX_BOT_CHAT_LOGS) {
    data.bot_chat_logs.splice(0, data.bot_chat_logs.length - MAX_BOT_CHAT_LOGS);
  }
  persist();
}

// Список собеседников бота — по одному на пользователя, с превью последнего сообщения
function getBotChatUsers() {
  const byTelegramId = new Map();
  data.bot_chat_logs.forEach(l => {
    const existing = byTelegramId.get(l.telegram_id);
    if (!existing || new Date(l.created_at) >= new Date(existing.last_message_at)) {
      byTelegramId.set(l.telegram_id, {
        telegram_id: l.telegram_id, user_id: l.user_id,
        last_message_at: l.created_at, last_message_text: l.text, last_message_role: l.role,
        message_count: (existing?.message_count || 0) + 1
      });
    } else {
      existing.message_count += 1;
    }
  });
  return [...byTelegramId.values()]
    .map(u => {
      const user = u.user_id ? getUser(u.user_id) : null;
      return {
        ...u,
        user_name: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Без имени' : 'Неизвестный',
        username: user ? user.username : null
      };
    })
    .sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
}

// Полная переписка с одним конкретным пользователем (от старых к новым — как обычный чат)
function getBotChatLogsForUser(telegram_id, { page = 1, pageSize = 50 } = {}) {
  const all = data.bot_chat_logs
    .filter(l => l.telegram_id === String(telegram_id))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const total = all.length;
  // Пагинация "с конца" — последняя страница показывает самые свежие сообщения
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const start = Math.max(0, total - clampedPage * pageSize);
  const end = total - (clampedPage - 1) * pageSize;
  const items = all.slice(start, end);
  return { items, total, page: clampedPage, pageSize, totalPages };
}

module.exports = {
  DATA_DIR,
  upsertUser, updateUser, getUser, getAllUsers, checkBirthDateCooldown, setReferrer,
  getProducts, getProduct, createProduct, updateProduct, hideProduct, deleteProductHard,
  addStock, removeStock, sanitizeProduct, nearestExpiry,
  createOrder, createManualOrder, getOrdersByUser, getAllOrders, getUserStats,
  getOrderRaw, updateOrder, adminOrUserCancel, moveToDelivering, moveToCompleted, setOrderPaid,
  countActiveOrders, MAX_ACTIVE_ORDERS,
  addLedgerEntry, getLedger, deleteLedgerEntry, getBalance, getShopStats,
  getBonusInfo, getBonusBalance, getBonusHistory, redeemBonuses, TX_LABELS,
  getBirthdayDiscountInfo, REFERRAL_RATE, REFERRAL_QUALIFY_MIN, REFERRAL_LADDER, MAX_BONUS_PAYMENT_SHARE,
  getDeliveryCost, DELIVERY_TIERS,
  createConsultantSession, findValidConsultantSession, CONSULTANT_DISCOUNT_RATE,
  addNotification, getNotifications, getUnreadNotificationsCount, markAllNotificationsRead,
  submitReview, getReviews, deleteReview,
  getReminderData, setReminderSlot, addReminderItem, deleteReminderItem, findDueReminders, markReminderSent, REMINDER_SLOTS,
  getAllTemplates, getTemplate, setTemplate, resetTemplate, renderTemplate,
  pingAppOpen, touchCart, clearCartTracking, findDueIdleNudges, markIdleNudgeSent, findDueCartNudges, markCartNudgeSent,
  recordBotChat, findDueWebappNudges, markWebappNudgeSent,
  logBotMessage, getBotChatUsers, getBotChatLogsForUser
};
