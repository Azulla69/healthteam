// Ozon активно защищается от автоматических запросов (Cloudflare/антибот-проверки), поэтому
// 100% надёжности здесь нет — это лучшее, что можно сделать без headless-браузера/прокси.
// Если Ozon поменяет вёрстку или усилит защиту, парсинг может перестать находить цену —
// в интерфейсе это будет видно как статус "не удалось" с текстом ошибки.

async function fetchOzonPrice(url) {
  let res;
  try {
    res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8'
      }
    });
  } catch (e) {
    throw new Error(`network_error: ${e.message}`);
  }

  if (!res.ok) {
    throw new Error(`http_${res.status}${res.status === 403 || res.status === 429 ? ' (похоже, заблокировал антибот-защитой)' : ''}`);
  }

  const html = await res.text();

  // Стратегия 1: JSON-LD структурированные данные (часто есть у карточек товара для SEO)
  const ldJsonMatches = html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g);
  for (const m of ldJsonMatches) {
    try {
      const parsed = JSON.parse(m[1]);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        const price = item?.offers?.price || item?.offers?.[0]?.price;
        if (price) return Math.round(Number(price));
      }
    } catch (e) { /* пропускаем невалидный блок */ }
  }

  // Стратегия 2: Open Graph / meta-теги с ценой
  const ogPriceMatch = html.match(/<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([\d.]+)["']/i)
    || html.match(/<meta[^>]+content=["']([\d.]+)["'][^>]+property=["']product:price:amount["']/i);
  if (ogPriceMatch) return Math.round(Number(ogPriceMatch[1]));

  // Стратегия 3: встроенный JSON в __NEXT_DATA__ (типично для Next.js-приложений вроде Ozon) —
  // ищем правдоподобное поле цены рядом со словом price
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextDataMatch) {
    try {
      const json = JSON.parse(nextDataMatch[1]);
      const found = findPlausiblePrice(json);
      if (found) return found;
    } catch (e) { /* не смогли распарсить — идём дальше */ }
  }

  // Стратегия 4: грубый поиск паттерна "price":12345 где-то в теле страницы
  const rawPriceMatch = html.match(/"(?:cardPrice|price|finalPrice)"\s*:\s*"?(\d{2,7})"?/i);
  if (rawPriceMatch) return Math.round(Number(rawPriceMatch[1]));

  throw new Error('price_not_found (страница загрузилась, но цену найти не удалось — возможно, изменилась вёрстка Ozon)');
}

// Рекурсивно ищет в объекте правдоподобное числовое поле с ценой (от 50 до 500000 ₽)
function findPlausiblePrice(obj, depth = 0) {
  if (depth > 6 || !obj || typeof obj !== 'object') return null;
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (/price/i.test(key) && typeof val === 'number' && val >= 50 && val <= 500000) {
      return Math.round(val);
    }
    if (typeof val === 'object') {
      const nested = findPlausiblePrice(val, depth + 1);
      if (nested) return nested;
    }
  }
  return null;
}

module.exports = { fetchOzonPrice };
