const API_BASE = ''; // пусто = тот же домен, где раздаётся фронтенд

const tg = window.Telegram ? window.Telegram.WebApp : null;

async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (tg && tg.initData) {
    headers['X-Telegram-Init-Data'] = tg.initData;
  }
  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    let err;
    try { err = await res.json(); } catch (e) { err = { error: 'network_error' }; }
    throw new Error(err.error || 'request_failed');
  }
  return res.json();
}
