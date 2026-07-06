require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const { telegramAuth } = require('./middleware/auth');
const catalogRoutes = require('./routes/catalog');
const ordersRoutes = require('./routes/orders');
const profileRoutes = require('./routes/profile');

const app = express();

app.use(cors());
app.use(express.json());
app.use(telegramAuth); // на каждом запросе проверяем, кто пришёл (гость / юзер / админ)

app.use('/api/catalog', catalogRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/profile', profileRoutes);

// Отдаём фронтенд как статику (удобно для деплоя одним куском на Railway/Render)
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Сервер запущен на порту ${PORT}`);
  if (!process.env.BOT_TOKEN || process.env.BOT_TOKEN.includes('Example')) {
    console.warn('⚠️  BOT_TOKEN не настроен в .env — авторизация через Telegram работать не будет');
  }
});
