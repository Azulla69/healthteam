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

// Загрузка файла (фото товара) — отдельная функция, т.к. нужен multipart/form-data, а не JSON
async function apiUploadFile(path, file) {
  const headers = {};
  if (tg && tg.initData) headers['X-Telegram-Init-Data'] = tg.initData;
  const formData = new FormData();
  formData.append('image', file);
  const res = await fetch(API_BASE + path, { method: 'POST', headers, body: formData });
  if (!res.ok) {
    let err;
    try { err = await res.json(); } catch (e) { err = { error: 'network_error' }; }
    throw new Error(err.error || 'request_failed');
  }
  return res.json();
}
