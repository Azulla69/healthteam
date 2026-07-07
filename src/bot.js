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

async function sendMessage(chatId) {
  try {
    await fetch(`${API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: WELCOME_TEXT,
        parse_mode: 'HTML',
        reply_markup: keyboard()
      })
    });
  } catch (e) {
    console.error('Ошибка отправки сообщения ботом:', e.message);
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

module.exports = { startBot, stopBot };
