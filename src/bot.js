const ai = require('./ai');
const db = require('./db');

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

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
  db.logBotMessage(String(chatId), 'assistant', text);
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

// Отправляется автоматически, когда заказ переходит в статус "Выполнено"
async function notifyOrderCompleted(telegramId, orderId) {
  const text = db.renderTemplate('order_review_request', { order_id: orderId });
  const reviewUrl = WEBAPP_URL ? `${WEBAPP_URL}?review=${orderId}` : null;
  const replyMarkup = reviewUrl
    ? { inline_keyboard: [[{ text: '⭐ Оценить заказ', web_app: { url: reviewUrl } }]] }
    : undefined;
  await sendRaw(telegramId, text, replyMarkup);
}

// Отправляется сразу при оформлении заказа (не путать с уведомлением о доставке)
async function notifyOrderPlaced(telegramId, orderId) {
  const text = db.renderTemplate('order_placed_thankyou', { order_id: orderId });
  await sendRaw(telegramId, text);
}

// Уведомляет всех админов (ADMIN_IDS) о новом заказе
async function notifyAdminsNewOrder(order, buyer) {
  const adminIds = (process.env.ADMIN_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (adminIds.length === 0) return;
  const itemsList = (order.items || []).map(i => `• ${i.name} × ${i.qty}`).join('\n');
  const text = db.renderTemplate('admin_new_order', {
    order_id: order.id,
    buyer_name: `${buyer.first_name || ''} ${buyer.last_name || ''}`.trim() || 'Без имени',
    buyer_username: buyer.username || '—',
    phone: order.phone || '—',
    items: itemsList,
    total: order.total
  });
  const replyMarkup = WEBAPP_URL ? { inline_keyboard: [[{ text: '📋 Открыть управление', web_app: { url: WEBAPP_URL } }]] } : undefined;
  for (const adminId of adminIds) {
    await sendRaw(adminId, text, replyMarkup);
  }
}

const TIMING_LABELS = { morning: 'утром', day: 'днём', evening: 'вечером' };

// Отправляется после доставки заказа — рассказывает, как принимать купленное, и предлагает напоминания
async function notifyDosageAdvice(telegramId, advice) {
  if (!advice || advice.length === 0) return;
  const lines = advice.map(a => {
    const timing = a.timing.map(t => TIMING_LABELS[t] || t).join(', ');
    const food = a.food_relation ? `, ${a.food_relation}` : '';
    return `💊 <b>${a.name}</b>\n${a.dosage_qty} ${a.dosage_unit} — ${timing}${food}`;
  }).join('\n\n');
  const header = db.getTemplate('dosage_advice_header');
  const footer = db.getTemplate('dosage_advice_footer');
  const text = `${header}\n\n${lines}\n\n${footer}`;
  const url = WEBAPP_URL ? `${WEBAPP_URL}?reminders=1` : null;
  const replyMarkup = url ? { inline_keyboard: [[{ text: '🔔 Включить напоминания', web_app: { url } }]] } : undefined;
  await sendRaw(telegramId, text, replyMarkup);
}

// Отправка напоминания о приёме (вызывается планировщиком)
async function sendReminder(telegramId, slotLabel, items) {
  const lines = items.map(i => {
    const food = i.food_relation ? `, ${i.food_relation}` : '';
    return `💊 ${i.name} — ${i.dosage_qty} ${i.dosage_unit}${food}`;
  }).join('\n');
  const text = db.renderTemplate('reminder_message', { slot: slotLabel, items: lines });
  await sendRaw(telegramId, text);
}

// "Ты посмотрел каталог, но ничего не выбрал" — вызывается планировщиком
async function notifyIdleNudge(telegramId) {
  await sendRaw(telegramId, db.getTemplate('idle_nudge'), keyboard());
}

// "Корзина собрана, но заказ не оформлен" — вызывается планировщиком
async function notifyCartNudge(telegramId) {
  await sendRaw(telegramId, db.getTemplate('cart_nudge'), keyboard());
}

// "Пообщались, а ты даже не открыл приложение" — вызывается планировщиком (через час после чата)
async function notifyWebappNudge(telegramId) {
  await sendRaw(telegramId, db.getTemplate('webapp_nudge'), keyboard());
}

// ---------- Живой ИИ-диалог прямо в чате бота ----------
// История разговора храним в памяти процесса (сбрасывается при рестарте — это нормально для чата с рекомендациями)
const conversations = new Map(); // chatId -> [{role, content}]
const lastStartAt = new Map(); // chatId -> timestamp, защита от повторных /start подряд

async function handleUserMessage(chatId, text, from = {}) {
  // Регистрируем пользователя в базе при ЛЮБОМ сообщении (даже если он никогда не открывал приложение) +
  // ставим таймер напоминания "открой приложение", если он его ещё не открывал
  db.recordBotChat({
    telegram_id: String(chatId),
    username: from.username || null,
    first_name: from.first_name || null,
    last_name: from.last_name || null
  });
  db.logBotMessage(String(chatId), 'user', text);

  try {
    if (text.startsWith('/start')) {
      const now = Date.now();
      const last = lastStartAt.get(chatId) || 0;
      if (now - last < 3000) return; // защита от дублей — Telegram иногда доставляет апдейт повторно
      lastStartAt.set(chatId, now);

      conversations.delete(chatId);
      const payload = text.split(' ')[1];
      const reply = payload === 'assistant' ? db.getTemplate('assistant_intro') : db.getTemplate('welcome');
      await sendRaw(chatId, reply, payload === 'assistant' ? undefined : keyboard());
      return;
    }

    if (!ai.HAS_AI) {
      await sendRaw(chatId, 'ИИ-консультант сейчас недоступен — но вы можете открыть магазин кнопкой ниже 👇', keyboard());
      return;
    }

    const history = conversations.get(chatId) || [];
    history.push({ role: 'user', content: text.slice(0, 2000) });
    if (history.length > 16) history.splice(0, history.length - 16);

    const { text: reply, productIds } = await ai.askConsultant(history);
    history.push({ role: 'assistant', content: reply });
    conversations.set(chatId, history);

    await sendRaw(chatId, reply);

    if (productIds && productIds.length > 0 && WEBAPP_URL) {
      const url = `${WEBAPP_URL}?consultant_ids=${productIds.join(',')}`;
      await sendRaw(chatId, 'Собрал для вас подборку со скидкой 10% 👇', {
        inline_keyboard: [[{ text: '🛒 Добавить в корзину со скидкой', web_app: { url } }]]
      });
    }
  } catch (e) {
    console.error('Ошибка обработки сообщения ботом:', e.message);
    await sendRaw(chatId, 'Извините, не получилось ответить — попробуйте ещё раз чуть позже 🙏');
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
        if (update.message && update.message.text) {
          await handleUserMessage(update.message.chat.id, update.message.text, update.message.from || {});
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
    console.warn('⚠️  BOT_TOKEN не настроен — бот не запущен (веб-приложение при этом работает как обычно)');
    return;
  }
  if (!WEBAPP_URL) {
    console.warn('⚠️  WEBAPP_URL не задан — кнопка в приветствии бота будет вести на t.me вместо вашего магазина');
  }
  console.log('🤖 Бот запущен (long polling)');
  poll();
}

function stopBot() { stopped = true; }

module.exports = {
  startBot, stopBot,
  notifyOrderCompleted, notifyOrderPlaced, notifyAdminsNewOrder, notifyDosageAdvice,
  sendReminder, notifyIdleNudge, notifyCartNudge, notifyWebappNudge
};
