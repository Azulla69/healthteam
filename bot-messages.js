const crypto = require('crypto');

/**
 * Проверяет, что initData действительно пришла от Telegram и не была подделана.
 * Алгоритм описан в официальной документации Telegram Mini Apps.
 */
function validateInitData(initData, botToken, maxAgeSeconds = 86400) {
  if (!initData) return { valid: false, reason: 'empty initData' };

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return { valid: false, reason: 'no hash' };
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (computedHash !== hash) return { valid: false, reason: 'bad signature' };

  const authDate = Number(params.get('auth_date'));
  if (authDate && Date.now() / 1000 - authDate > maxAgeSeconds) {
    return { valid: false, reason: 'expired' };
  }

  let user = null;
  try {
    user = JSON.parse(params.get('user'));
  } catch (e) {
    return { valid: false, reason: 'bad user payload' };
  }

  return { valid: true, user };
}

module.exports = { validateInitData };
