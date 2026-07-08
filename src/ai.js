const db = require('./db');

// Можно указать несколько ключей через запятую в GROQ_API_KEYS (разные аккаунты Groq —
// лимит у Groq считается на аккаунт, поэтому несколько ключей одного аккаунта не помогут,
// а вот ключи от разных аккаунтов — да). Для обратной совместимости читаем и старую GROQ_API_KEY.
const GROQ_API_KEYS = (process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || '')
  .split(',').map(s => s.trim()).filter(Boolean);
const GROQ_API_KEY = GROQ_API_KEYS[0]; // для обратной совместимости мест, где просто проверяется "ключ есть"
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

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

  return `Ты — тёплый, дружелюбный и профессиональный бот-консультант интернет-магазина HealthTeam (БАДы, витамины, спортивное питание). Общайся с покупателем на "ты", живо и по-человечески, без канцелярита.

ВАЖНО: отвечай СТРОГО на русском языке. Никогда не вставляй иероглифы, английские слова или фрагменты других языков — только русский текст.

Тебе нужно по очереди узнать 5 вещей (держи в голове, что из этого уже известно, а что ещё нет):
1) чем человек занимается по жизни (род занятий, уровень активности),
2) какая у него цель (похудение, набор массы, поддержание формы, энергия и т.д.),
3) каким спортом занимается, если занимается,
4) его рост,
5) его вес.

ГЛАВНОЕ ПРАВИЛО: пока известны не все 5 пунктов — КАЖДОЕ твоё сообщение должно заканчиваться ОДНИМ конкретным вопросом про следующий неизвестный пункт. Нельзя просто согласиться, прокомментировать ответ человека и остановиться без вопроса — это ошибка. Коротко отреагируй на ответ (одна фраза, по-человечески), затем сразу задай следующий вопрос. Не задавай два вопроса сразу и не повторяй уже заданные.

Как только известны все 5 пунктов — вопросов больше не задавай. Вместо этого сразу напиши рекомендацию: объясни, почему именно эти добавки подходят под ситуацию человека и как их лучше принимать. Пиши по существу, без воды — 4-6 предложений достаточно, это сообщение в мессенджере, а не статья.

В самом конце этого сообщения с рекомендацией (и только тогда, когда рекомендация уже готова) добавь последней строкой маркер в ТОЧНО таком формате — просто числа через запятую, БЕЗ решёток (#) и без лишних символов, используя только реальные ID из каталога ниже, от 2 до 5 штук:
[[РЕКОМЕНДАЦИЯ: id1,id2,id3]]

Например, если рекомендуешь товары с ID 3, 7 и 12, последняя строка сообщения должна быть ровно такой:
[[РЕКОМЕНДАЦИЯ: 3,7,12]]

Это обязательное правило — без этой строки в точно таком формате рекомендация не будет обработана.

Не показывай и не упоминай этот маркер, пока не собрал все 5 пунктов и не дал полную развёрнутую рекомендацию.

Каталог доступных товаров (используй только эти ID):
${catalogText}`;
}

const PRIMARY_MODEL = 'llama-3.3-70b-versatile'; // качественная модель, но лимит по токенам скромнее
const FALLBACK_MODEL = 'llama-3.1-8b-instant';    // подключается автоматически, если у основной кончился дневной лимит

async function callGroq(messages, model = PRIMARY_MODEL, apiKey = GROQ_API_KEY) {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
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
    throw new Error(`groq_bad_response (status ${res.status}, не JSON)`);
  }
  if (!res.ok) {
    console.error('Полный ответ Groq при ошибке:', JSON.stringify(data));
    const err = new Error(`groq_error (status ${res.status}): ${data.error?.message || JSON.stringify(data)}`);
    err.status = res.status;
    throw err;
  }
  if (!data.choices || !data.choices[0]) {
    console.error('Неожиданный формат ответа Groq:', JSON.stringify(data));
    throw new Error('groq_unexpected_format');
  }
  return sanitizeReply(data.choices[0].message.content);
}

// Пробуем все ключи на качественной модели по очереди; если ВСЕ упёрлись в лимит —
// пробуем их же на резервной (более лёгкой) модели, у которой лимит обычно выше
async function callGroqSmart(messages) {
  const attempts = [
    ...GROQ_API_KEYS.map(key => ({ key, model: PRIMARY_MODEL })),
    ...GROQ_API_KEYS.map(key => ({ key, model: FALLBACK_MODEL }))
  ];
  let lastError;
  for (const { key, model } of attempts) {
    try {
      return await callGroq(messages, model, key);
    } catch (e) {
      lastError = e;
      if (e.status !== 429) throw e; // не лимит — значит реальная ошибка, дальше пробовать бессмысленно
      console.warn(`Лимит исчерпан (ключ …${key.slice(-4)}, модель ${model}) — пробую следующий вариант`);
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

module.exports = { GROQ_API_KEY, buildSystemPrompt, callGroq, askConsultant, generateDosageAdvice, CONSULTANT_MARKER_RE };
