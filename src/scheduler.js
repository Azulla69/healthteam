const db = require('./db');

const SLOT_LABELS = { morning: 'утро', day: 'день', evening: 'вечер' };

// Время считаем по Москве (UTC+3) — большинство пользователей в этом поясе,
// и так понятнее задавать время в интерфейсе без выбора часового пояса
function moscowNow() {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcMs + 3 * 3600000);
}

function pad(n) { return String(n).padStart(2, '0'); }

async function tick() {
  const bot = require('./bot'); // ленивый require, чтобы избежать циклической зависимости при старте

  try {
    const mskNow = moscowNow();
    const currentHHMM = `${pad(mskNow.getHours())}:${pad(mskNow.getMinutes())}`;
    const todayStr = `${mskNow.getFullYear()}-${pad(mskNow.getMonth() + 1)}-${pad(mskNow.getDate())}`;

    const due = db.findDueReminders(currentHHMM, todayStr);
    for (const { user, slot, items } of due) {
      await bot.sendReminder(user.telegram_id, SLOT_LABELS[slot], items);
      db.markReminderSent(user.id, slot, todayStr);
    }
  } catch (e) {
    console.error('Ошибка планировщика напоминаний:', e.message);
  }

  try {
    const idleUsers = db.findDueIdleNudges();
    for (const user of idleUsers) {
      await bot.notifyIdleNudge(user.telegram_id);
      db.markIdleNudgeSent(user.id);
    }
  } catch (e) {
    console.error('Ошибка планировщика "бросил каталог":', e.message);
  }

  try {
    const cartUsers = db.findDueCartNudges();
    for (const user of cartUsers) {
      await bot.notifyCartNudge(user.telegram_id);
      db.markCartNudgeSent(user.id);
    }
  } catch (e) {
    console.error('Ошибка планировщика "брошенная корзина":', e.message);
  }

  try {
    const webappUsers = db.findDueWebappNudges();
    for (const user of webappUsers) {
      await bot.notifyWebappNudge(user.telegram_id);
      db.markWebappNudgeSent(user.id);
    }
  } catch (e) {
    console.error('Ошибка планировщика "не открыл приложение":', e.message);
  }

  // Не ждём — сверка может занять больше минуты, если товаров много, а планировщик не должен из-за этого тормозить
  checkOzonPricesOnceADay().catch(e => console.error('Ошибка планировщика сверки цен с Ozon:', e.message));
}

// Раз в сутки (по московской дате) проходим по всем товарам со ссылкой на Ozon и сверяем цену
let lastOzonCheckDate = null;
async function checkOzonPricesOnceADay() {
  const mskNow = moscowNow();
  const todayStr = `${mskNow.getFullYear()}-${pad(mskNow.getMonth() + 1)}-${pad(mskNow.getDate())}`;
  if (lastOzonCheckDate === todayStr) return; // уже проверяли сегодня
  lastOzonCheckDate = todayStr;

  const { checkOne } = require('./routes/ozon');
  const withUrl = db.getProducts({}).filter(p => p.ozon_url);
  if (withUrl.length === 0) return;
  console.log(`🛒 Сверка цен с Ozon: начинаю проверку ${withUrl.length} товаров`);
  for (const p of withUrl) {
    await checkOne(p.id);
    await new Promise(r => setTimeout(r, 2000)); // не долбим Ozon запросами подряд
  }
  console.log('🛒 Сверка цен с Ozon: завершено');
}

function startScheduler() {
  console.log('⏰ Планировщик напоминаний запущен');
  setInterval(tick, 60 * 1000);
}

module.exports = { startScheduler };
