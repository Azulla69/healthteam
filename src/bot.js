const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

const WELCOME_TEXT = `Привет! 👋 Добро пожаловать в <b>HealthTeam</b> — магазин БАДов и спортивного питания.

Что у нас есть:
🌿 <b>Каталог</b> — БАДы и спортпит с поиском, фильтром по производителю и сортировкой
🎁 <b>Бонусная система</b> — кэшбек 3–10% с каждой покупки в зависимости от вашего уровня, действует 3 месяца
🤝 <b>Реферальная система</b> — приглашайте друзей и получайте 5% с их покупок навсегда + бонусы за лесенку приглашений
🎂 <b>Скидка на день рождения</b> — 15% на один заказ, действует 15 дней вокруг вашего ДР
🚚 <b>Доставка</b> — от 0 до 300₽ в зависимости от суммы заказа, от 1500₽ — бесплатно
🧬 <b>Бот-консультант</b> — скоро поможет подобрать добавки именно под вас

Жмите кнопку ниже, чтобы открыть магазин 👇`;

function keyboard() {
  return {
    inline_keyboard: [[
      WEBAPP_URL
        ? { text: '🚀 Открыть HealthTeam', web_app: { url: WEBAPP_URL } }
        : { text: '🚀 Открыть HealthTeam', url: 'https://t.me' } // фолбэк, если WEBAPP_URL не задан
    ]]
  };
}

async function sendRaw(chatId, text, replyMarkup) {
  if (!BOT_TOKEN || BOT_TOKEN.includes('Example')) return; // бот не настроен — тихо выходим
  try {
    await fetch(`${API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', reply_markup: replyMarkup })
    });
  } catch (e) {
    console.error('Ошибка отправки сообщения ботом:', e.message);
  }
}

async function sendMessage(chatId) {
  await sendRaw(chatId, WELCOME_TEXT, keyboard());
}

// Отправляется автоматически, когда заказ переходит в статус "Выполнено"
async function notifyOrderCompleted(telegramId, orderId) {
  const text = `Заказ №${orderId} доставлен! 🎉\n\nСпасибо, что выбрали HealthTeam. Будем рады, если оцените заказ — это займёт минуту, а за отзыв начислим <b>50 бонусов</b> на ваш счёт.`;
  const reviewUrl = WEBAPP_URL ? `${WEBAPP_URL}?review=${orderId}` : null;
  const replyMarkup = reviewUrl
    ? { inline_keyboard: [[{ text: '⭐ Оценить заказ', web_app: { url: reviewUrl } }]] }
    : undefined;
  await sendRaw(telegramId, text, replyMarkup);
}

// Уведомляет всех админов (ADMIN_IDS) о новом заказе
async function notifyAdminsNewOrder(order, buyer) {
  const adminIds = (process.env.ADMIN_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (adminIds.length === 0) return;
  const itemsList = (order.items || []).map(i => `• ${i.name} × ${i.qty}`).join('\n');
  const text = `🛒 <b>Новый заказ №${order.id}</b>\n\n` +
    `${buyer.first_name || ''} ${buyer.last_name || ''} · @${buyer.username || '—'}\n` +
    `Телефон: ${order.phone || '—'}\n\n${itemsList}\n\n` +
    `Сумма: ${order.total} ₽`;
  const replyMarkup = WEBAPP_URL ? { inline_keyboard: [[{ text: '📋 Открыть управление', web_app: { url: WEBAPP_URL } }]] } : undefined;
  for (const adminId of adminIds) {
    await sendRaw(adminId, text, replyMarkup);
  }
}

let offset = 0;
let stopped = false;

async function poll() {
  if (stopped) return;
  try {
    const res = await fetch(`${API}/getUpdates?offset=${offset}&timeout=25`);
    const data = await res.json();
    if (data.ok) {
      for (const update of data.result) {
        offset = update.update_id + 1;
        // Отвечаем на любое входящее сообщение (в т.ч. /start при первом входе в чат)
        if (update.message) {
          sendMessage(update.message.chat.id);
        }
      }
    }
  } catch (e) {
    console.error('Ошибка опроса Telegram (getUpdates):', e.message);
  }
  setTimeout(poll, 1000);
}

function startBot() {
  if (!BOT_TOKEN || BOT_TOKEN.includes('Example')) {
    console.warn('⚠️  BOT_TOKEN не настроен — бот-приветствие не запущен (веб-приложение при этом работает как обычно)');
    return;
  }
  if (!WEBAPP_URL) {
    console.warn('⚠️  WEBAPP_URL не задан — кнопка в приветствии бота будет вести на t.me вместо вашего магазина');
  }
  console.log('🤖 Бот-приветствие запущен (long polling)');
  poll();
}

function stopBot() { stopped = true; }

module.exports = { startBot, stopBot, notifyOrderCompleted, notifyAdminsNewOrder };
