// Ozon активно защищается от автоматических запросов (Cloudflare/антибот-проверки), поэтому
// 100% надёжности здесь нет — это лучшее, что можно сделать без headless-браузера/прокси.
// Если Ozon поменяет вёрстку или усилит защиту, парсинг может перестать находить цену —
// в интерфейсе это будет видно как статус "не удалось" с текстом ошибки.

async function fetchOzonPrice(url) {
  let res;
  try {
    res = await fetch(url, { headers: BROWSER_HEADERS });
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

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8'
};

// Ищет товар на Ozon по текстовому запросу (название + бренд) и возвращает наиболее похожий результат.
// Поиск у Ozon защищён ещё жёстче, чем страница товара — вероятность неудачи выше, поэтому
// результат всегда нужно показать пользователю на подтверждение, а не сохранять вслепую.
async function searchOzonProduct(query) {
  const searchUrl = `https://www.ozon.ru/search/?text=${encodeURIComponent(query)}`;
  let res;
  try {
    res = await fetch(searchUrl, { headers: BROWSER_HEADERS });
  } catch (e) {
    throw new Error(`network_error: ${e.message}`);
  }
  if (!res.ok) {
    throw new Error(`http_${res.status}${res.status === 403 || res.status === 429 ? ' (похоже, заблокировал антибот-защитой)' : ''}`);
  }

  const html = await res.text();
  const candidates = extractSearchCandidates(html);
  if (candidates.length === 0) {
    throw new Error('search_no_results (страница поиска загрузилась, но не удалось распознать результаты — возможно, изменилась вёрстка Ozon)');
  }

  const scored = candidates
    .map(c => ({ ...c, score: similarity(query, c.title) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (best.score < 0.25) {
    throw new Error('search_no_good_match (нашлись результаты, но ни один не похож на искомый товар — проверьте вручную)');
  }
  return { url: best.url, title: best.title, price: best.price, confidence: Math.round(best.score * 100) };
}

// Достаёт список {title, url, price} из HTML страницы поиска — пробуем несколько мест,
// где Ozon обычно хранит данные результатов (структурированные данные, встроенный JSON состояния)
function extractSearchCandidates(html) {
  const results = [];

  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextDataMatch) {
    try {
      const json = JSON.parse(nextDataMatch[1]);
      collectSearchItems(json, results);
    } catch (e) { /* не смогли распарсить — пробуем следующий способ */ }
  }

  return results.filter(r => r.title && r.url && r.price).slice(0, 20);
}

// Рекурсивно ищет в объекте состояния страницы элементы, похожие на карточки товара в выдаче
function collectSearchItems(obj, results, depth = 0) {
  if (depth > 8 || !obj || typeof obj !== 'object' || results.length >= 20) return;
  if (Array.isArray(obj)) {
    obj.forEach(item => collectSearchItems(item, results, depth + 1));
    return;
  }
  const title = obj.title || obj.name;
  const link = obj.link || obj.url;
  const priceField = obj.price?.price || obj.priceValue || obj.finalPrice || obj.cardPrice;
  if (typeof title === 'string' && title.length > 3 && typeof link === 'string' && link.includes('/product/')) {
    const price = Number(String(priceField).replace(/\D/g, '')) || null;
    results.push({
      title,
      url: link.startsWith('http') ? link : `https://www.ozon.ru${link}`,
      price
    });
  }
  Object.values(obj).forEach(v => { if (typeof v === 'object') collectSearchItems(v, results, depth + 1); });
}

// Простая оценка схожести двух текстов по общим словам (0..1)
function similarity(a, b) {
  const norm = s => s.toLowerCase().replace(/[^а-яa-z0-9\s]/gi, ' ').split(/\s+/).filter(w => w.length > 2);
  const wordsA = new Set(norm(a));
  const wordsB = new Set(norm(b));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let shared = 0;
  wordsA.forEach(w => { if (wordsB.has(w)) shared++; });
  return shared / Math.max(wordsA.size, wordsB.size);
}

module.exports = { fetchOzonPrice, searchOzonProduct };
