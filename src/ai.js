const db = require('./db');

// DeepSeek — основной провайдер (платный, но качественный и с высоким лимитом).
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';

// Groq остаётся бесплатным резервом на случай проблем с DeepSeek (баланс, сбой и т.п.).
// Можно указать несколько ключей через запятую в GROQ_API_KEYS (разные аккаунты Groq —
// лимит у Groq считается на аккаунт, поэтому несколько ключей одного аккаунта не помогут,
// а вот ключи от разных аккаунтов — да).
const GROQ_API_KEYS = (process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || '')
  .split(',').map(s => s.trim()).filter(Boolean);
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_PRIMARY_MODEL = 'llama-3.3-70b-versatile';
const GROQ_FALLBACK_MODEL = 'llama-3.1-8b-instant';

// Для обратной совместимости мест, где просто проверяется "есть ли вообще ИИ"
const GROQ_API_KEY = GROQ_API_KEYS[0];
const HAS_AI = !!(DEEPSEEK_API_KEY || GROQ_API_KEYS.length > 0);

const CONSULTANT_MARKER_RE = /\[\[РЕКОМЕНДАЦИЯ:\s*([^\]]+)\]\]/i;

// Достаёт числа из списка вида "1,2,3" или "#1, #4, #5" — терпимо к решёткам/пробелам
function parseIds(raw) {
  return raw.split(',').map(s => s.replace(/\D/g, '')).filter(Boolean).map(Number);
}

function buildSystemPrompt() {
  const products = db.getProducts({ onlyActive: true }).filter(p => p.stock > 0);
  const catalogText = products
    .map(p => `#${p.id} [${p.section}/${p.category}] ${p.brand ? p.brand + ' ' : ''}${p.name} — ${p.price}₽`)
    .join('\n');

  return `Ты — тёплый, дружелюбный и увлечённый своим делом консультант интернет-магазина HealthTeam (БАДы, витамины, спортивное питание). Ты не бот-анкета, а живой собеседник — как хороший продавец-консультант в оффлайн-магазине, который искренне интересуется человеком и любит рассказывать о добавках.

ВАЖНО: отвечай СТРОГО на русском языке. Никогда не вставляй иероглифы, английские слова или фрагменты других языков — только русский текст.

Тебе нужно по ходу беседы узнать 5 вещей (держи в голове, что из этого уже известно, а что ещё нет):
1) чем человек занимается по жизни (род занятий, уровень активности),
2) какая у него цель (похудение, набор массы, поддержание формы, энергия и т.д.),
3) каким спортом занимается, если занимается,
4) его рост,
5) его вес.

КАК ВЕСТИ РАЗГОВОР: не превращай это в сухой опрос. По ходу диалога делись короткими интересными фактами и пояснениями — например, почему магний важен при активных тренировках, как коллаген влияет на суставы, зачем нужен омега-3 при сидячей работе и т.п. Реагируй на ответы человека живо, с интересом, иногда шути. Пусть беседа ощущается как разговор с человеком, который разбирается в теме и рад поделиться знаниями — а не как заполнение анкеты.

ГЛАВНОЕ ПРАВИЛО: пока известны не все 5 пунктов — КАЖДОЕ твоё сообщение должно двигать беседу дальше и заканчиваться ОДНИМ конкретным вопросом про следующий неизвестный пункт. Нельзя просто согласиться и остановиться без вопроса — это ошибка. Сначала живо отреагируй на ответ (можно с интересным фактом по теме), затем задай следующий вопрос. Не задавай два вопроса сразу и не повторяй уже заданные.

Как только известны все 5 пунктов — вопросов больше не задавай. Вместо этого напиши рекомендацию: расскажи, почему именно эти добавки подходят под ситуацию человека и как их лучше принимать. Можно чуть подробнее, чем в обычном ответе — 5-8 предложений, живо и по делу, это сообщение в мессенджере, а не статья.

В самом конце этого сообщения с рекомендацией (и только тогда, когда рекомендация уже готова) добавь последней строкой маркер в ТОЧНО таком формате — просто числа через запятую, БЕЗ решёток (#) и без лишних символов, используя только реальные ID из каталога ниже, от 2 до 5 штук:
[[РЕКОМЕНДАЦИЯ: id1,id2,id3]]

Например, если рекомендуешь товары с ID 3, 7 и 12, последняя строка сообщения должна быть ровно такой:
[[РЕКОМЕНДАЦИЯ: 3,7,12]]

Это обязательное правило — без этой строки в точно таком формате рекомендация не будет обработана.

Не показывай и не упоминай этот маркер, пока не собрал все 5 пунктов и не дал полную развёрнутую рекомендацию.

Каталог доступных товаров (используй только эти ID):
${catalogText}`;
}

const PRIMARY_MODEL = GROQ_PRIMARY_MODEL; // оставлено для обратной совместимости экспорта

async function callProvider(messages, { url, key, model }) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 1500
    })
  });
  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new Error(`bad_response (status ${res.status}, не JSON)`);
  }
  if (!res.ok) {
    console.error(`Полный ответ ${model} при ошибке:`, JSON.stringify(data));
    const err = new Error(`provider_error (status ${res.status}): ${data.error?.message || JSON.stringify(data)}`);
    err.status = res.status;
    throw err;
  }
  if (!data.choices || !data.choices[0]) {
    console.error('Неожиданный формат ответа:', JSON.stringify(data));
    throw new Error('unexpected_format');
  }
  return sanitizeReply(data.choices[0].message.content);
}

// Оставлено для обратной совместимости (используется напрямую нигде не должно, но пусть будет)
async function callGroq(messages, model = GROQ_PRIMARY_MODEL, apiKey = GROQ_API_KEY) {
  return callProvider(messages, { url: GROQ_URL, key: apiKey, model });
}

function buildAttempts() {
  const attempts = [];
  if (DEEPSEEK_API_KEY) attempts.push({ url: DEEPSEEK_URL, key: DEEPSEEK_API_KEY, model: 'deepseek-v4-flash', label: 'DeepSeek' });
  GROQ_API_KEYS.forEach(key => attempts.push({ url: GROQ_URL, key, model: GROQ_PRIMARY_MODEL, label: `Groq 70B …${key.slice(-4)}` }));
  GROQ_API_KEYS.forEach(key => attempts.push({ url: GROQ_URL, key, model: GROQ_FALLBACK_MODEL, label: `Groq 8B …${key.slice(-4)}` }));
  return attempts;
}

// Пробуем провайдеров по очереди в порядке приоритета: DeepSeek → Groq (хорошая модель, все ключи) →
// Groq (лёгкая модель, все ключи). Переходим к следующему только при ошибке лимита (429) —
// любая другая ошибка означает реальную проблему, дальше пробовать бессмысленно.
async function callGroqSmart(messages) {
  const attempts = buildAttempts();
  if (attempts.length === 0) {
    const err = new Error('no_provider_configured');
    err.status = 503;
    throw err;
  }
  let lastError;
  for (const attempt of attempts) {
    try {
      return await callProvider(messages, attempt);
    } catch (e) {
      lastError = e;
      if (e.status !== 429) throw e;
      console.warn(`Лимит исчерпан (${attempt.label}) — пробую следующий вариант`);
    }
  }
  throw lastError;
}

// Подстраховка от известной особенности Llama — иногда вставляет случайные иероглифы
// (китайские/японские/корейские) прямо посреди русского текста. Вычищаем их.
function sanitizeReply(text) {
  return text
    .replace(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g, '')
    .replace(/[ \t]{2,}/g, ' ');
}

// Отправляет всю историю разговора в Groq и возвращает { text, productIds }
// productIds не null, только когда ИИ закончил подбор и вставил маркер рекомендации
async function askConsultant(historyMessages) {
  const raw = await callGroqSmart([{ role: 'system', content: buildSystemPrompt() }, ...historyMessages]);
  return extractRecommendation(raw);
}

function extractRecommendation(raw) {
  const match = raw.match(CONSULTANT_MARKER_RE);
  if (match) {
    return { text: raw.replace(CONSULTANT_MARKER_RE, '').trim(), productIds: parseIds(match[1]) };
  }
  // Модель иногда забывает обернуть список в [[РЕКОМЕНДАЦИЯ: ...]] и просто пишет числа последней строкой —
  // подстраховываемся: если последняя строка сообщения похожа на голый список ID, считаем это рекомендацией
  const lines = raw.trim().split('\n');
  const lastLine = (lines[lines.length - 1] || '').trim();
  if (/^[#\d\s,]+$/.test(lastLine) && /\d/.test(lastLine)) {
    const ids = parseIds(lastLine);
    if (ids.length >= 2) {
      lines.pop();
      return { text: lines.join('\n').trim(), productIds: ids };
    }
  }
  return { text: raw, productIds: null };
}

// Генерирует рекомендации по приёму (когда/сколько/до-после еды) для списка купленных товаров.
// Возвращает массив [{name, dosage_qty, dosage_unit, timing:['morning',...], food_relation}] либо null при сбое.
async function generateDosageAdvice(items) {
  const list = items.map(i => `- ${i.name}`).join('\n');
  const prompt = `Ты — консультант магазина БАДов и спортпита. Пользователь купил следующие товары:
${list}

Для КАЖДОГО товара дай рекомендацию по приёму. Ответь СТРОГО в виде JSON-массива, без пояснений до или после, без markdown-разметки — только сам массив. Формат каждого элемента:
{"name": "название товара как в списке выше", "dosage_qty": число_штук_за_один_приём, "dosage_unit": "капсула/таблетка/мерная ложка и т.п.", "timing": ["morning"] или ["morning","evening"] и т.д. (используй только "morning","day","evening"), "food_relation": "до еды" | "после еды" | "во время еды" | ""}

Если для товара обычно достаточно приёма один раз в день — используй один элемент timing. Если по инструкции приём несколько раз в день — укажи несколько значений timing. Основывайся на общепринятых рекомендациях для такого типа добавок.`;

  try {
    const raw = await callGroqSmart([{ role: 'user', content: prompt }]);
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter(p => p && p.name)
      .map(p => ({
        name: String(p.name),
        dosage_qty: Number(p.dosage_qty) || 1,
        dosage_unit: String(p.dosage_unit || 'шт.'),
        timing: Array.isArray(p.timing) ? p.timing.filter(t => ['morning', 'day', 'evening'].includes(t)) : ['morning'],
        food_relation: ['до еды', 'после еды', 'во время еды'].includes(p.food_relation) ? p.food_relation : ''
      }));
  } catch (e) {
    console.error('Ошибка генерации рекомендаций по приёму:', e.message);
    return null;
  }
}

module.exports = { GROQ_API_KEY, HAS_AI, buildSystemPrompt, callGroq, askConsultant, generateDosageAdvice, CONSULTANT_MARKER_RE };
