const db = require('../db');
const { validateInitData } = require('../telegramAuth');

const BOT_TOKEN = process.env.BOT_TOKEN;
const DEV_MODE = process.env.DEV_MODE === 'true';
const ADMIN_IDS = (process.env.ADMIN_IDS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

/**
 * Читает заголовок X-Telegram-Init-Data на каждом запросе, проверяет подпись
 * и подтягивает / создаёт пользователя. Ставит req.user и req.isAdmin.
 * Если заголовка нет — запрос идёт как "гость" (req.user = null).
 */
function telegramAuth(req, res, next) {
  const initData = req.header('X-Telegram-Init-Data');

  // DEV_MODE позволяет тестировать в обычном браузере без Telegram (только локально!)
  if (!initData && DEV_MODE) {
    const devId = req.header('X-Dev-Telegram-Id') || '111111111';
    req.user = db.upsertUser({
      telegram_id: devId,
      username: 'dev_user',
      first_name: 'Dev',
      last_name: 'User'
    });
    req.isAdmin = ADMIN_IDS.includes(devId);
    return next();
  }

  if (!initData) {
    req.user = null;
    req.isAdmin = false;
    return next();
  }

  const result = validateInitData(initData, BOT_TOKEN);
  if (!result.valid) {
    return res.status(401).json({ error: 'invalid_telegram_data', reason: result.reason });
  }

  const tgUser = result.user;
  req.user = db.upsertUser({
    telegram_id: String(tgUser.id),
    username: tgUser.username || null,
    first_name: tgUser.first_name || null,
    last_name: tgUser.last_name || null
  });
  req.isAdmin = ADMIN_IDS.includes(String(tgUser.id));
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'auth_required' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.isAdmin) return res.status(403).json({ error: 'admin_only' });
  next();
}

module.exports = { telegramAuth, requireAuth, requireAdmin };
