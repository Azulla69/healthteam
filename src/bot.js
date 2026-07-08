const ai = require('./ai');

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

const WELCOME_TEXT = `Привет! 👋 Я бот-помощник магазина <b>HealthTeam</b> — БАДы, витамины и спортивное питание.

Что у нас есть:
🌿 <b>Каталог</b> — БАДы и спортпит с поиском, фильтром по производителю и сортировкой
🎁 <b>Бонусная система</b> — кэшбек 3–10% с каждой покупки, действует 3 месяца
🤝 <b>Реферальная система</b> — приглашайте друзей и получайте 5% с их покупок навсегда
🎂 <b>Скидка на день рождения</b> — 15% на один заказ
🚚 <b>Доставка</b> — от 0 до 300₽, от 1500₽ — бесплатно

Жмите кнопку ниже, чтобы открыть магазин 👇

А ещё можно просто написать мне прямо сюда, чем вы занимаетесь и какая у вас цель — я подберу подходящие БАДы и спортпит и всё подробно расскажу, не выходя из этого чата 💬`;

const ASSISTANT_INTRO_TEXT = `Привет! Меня зовут Бот-помощник HealthTeam 🤖

Готов выслушать все твои пожелания и подобрать то, что реально нужно — БАДы, витамины или спортпит под твои цели.

Расскажи: чем занимаешься, какая цель (похудение, набор массы, энергия, форма), каким спортом занимаешься и какой у тебя рост и вес — и я всё подберу 💪`;

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

const TIMING_LABELS = { morning: 'утром', day: 'днём', evening: 'вечером' };

// Отправляется после доставки заказа — рассказывает, как принимать купленное, и предлагает напоминания
async function notifyDosageAdvice(telegramId, advice) {
  if (!advice || advice.length === 0) return;
  const lines = advice.map(a => {
    const timing = a.timing.map(t => TIMING_LABELS[t] || t).join(', ');
    const food = a.food_relation ? `, ${a.food_relation}` : '';
    return `💊 <b>${a.name}</b>\n${a.dosage_qty} ${a.dosage_unit} — ${timing}${food}`;
  }).join('\n\n');
  const text = `Как принимать то, что вы купили:\n\n${lines}\n\nМогу присылать напоминания в удобное время, чтобы вы точно не забыли 👇`;
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
  const text = `⏰ Напоминание (${slotLabel})\n\nВремя принять:\n${lines}`;
  await sendRaw(telegramId, text);
}

// ---------- Живой ИИ-диалог прямо в чате бота ----------
// История разговора храним в памяти процесса (сбрасывается при рестарте — это нормально для чата с рекомендациями)
const conversations = new Map(); // chatId -> [{role, content}]

async function handleUserMessage(chatId, text) {
  try {
    if (text.startsWith('/start')) {
      conversations.delete(chatId);
      const payload = text.split(' ')[1];
      if (payload === 'assistant') {
        await sendRaw(chatId, ASSISTANT_INTRO_TEXT);
      } else {
        await sendRaw(chatId, WELCOME_TEXT, keyboard());
      }
      return;
    }

    if (!ai.GROQ_API_KEY) {
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
          await handleUserMessage(update.message.chat.id, update.message.text);
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

module.exports = { startBot, stopBot, notifyOrderCompleted, notifyAdminsNewOrder, notifyDosageAdvice, sendReminder };
