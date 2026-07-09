require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const { telegramAuth } = require('./middleware/auth');
const catalogRoutes = require('./routes/catalog');
const ordersRoutes = require('./routes/orders');
const profileRoutes = require('./routes/profile');
const usersRoutes = require('./routes/users');
const ledgerRoutes = require('./routes/ledger');
const statsRoutes = require('./routes/stats');
const consultantRoutes = require('./routes/consultant');
const reviewsRoutes = require('./routes/reviews');
const remindersRoutes = require('./routes/reminders');
const activityRoutes = require('./routes/activity');
const botMessagesRoutes = require('./routes/bot-messages');
const botLogsRoutes = require('./routes/bot-logs');
const ozonRoutes = require('./routes/ozon').router;

const app = express();

app.use(cors());
app.use(express.json());
app.use(telegramAuth); // на каждом запросе проверяем, кто пришёл (гость / юзер / админ)

app.use('/api/catalog', catalogRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/consultant', consultantRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/reminders', remindersRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/bot-messages', botMessagesRoutes);
app.use('/api/bot-logs', botLogsRoutes);
app.use('/api/ozon', ozonRoutes);

// Отдаём фронтенд как статику (удобно для деплоя одним куском на Railway/Render)
app.use(express.static(path.join(__dirname, '..', 'frontend')));
// Отдаём загруженные фото товаров (хранятся на подключённом Volume вместе с data.json)
const db = require('./db');
app.use('/uploads', express.static(path.join(db.DATA_DIR, 'uploads')));

app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/api/config', (req, res) => {
  const db = require('./db');
  res.json({ botUsername: process.env.BOT_USERNAME || '', deliveryTiers: db.DELIVERY_TIERS });
});

const { startBot } = require('./bot');
const { startScheduler } = require('./scheduler');

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Сервер запущен на порту ${PORT}`);
  if (!process.env.BOT_TOKEN || process.env.BOT_TOKEN.includes('Example')) {
    console.warn('⚠️  BOT_TOKEN не настроен в .env — авторизация через Telegram работать не будет');
  }
  startBot();
  startScheduler();
});
