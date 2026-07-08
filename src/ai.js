const db = require('./db');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
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

Не показывай и не упоминай этот маркер, пока не собрал все 5 пунктов и не дал полную развёрнутую рекомендацию.

Каталог доступных товаров (используй только эти ID):
${catalogText}`;
}

async function callGroq(messages) {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
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
    throw new Error(`groq_error (status ${res.status}): ${data.error?.message || JSON.stringify(data)}`);
  }
  if (!data.choices || !data.choices[0]) {
    console.error('Неожиданный формат ответа Groq:', JSON.stringify(data));
    throw new Error('groq_unexpected_format');
  }
  return data.choices[0].message.content;
}

// Отправляет всю историю разговора в Groq и возвращает { text, productIds }
// productIds не null, только когда ИИ закончил подбор и вставил маркер рекомендации
async function askConsultant(historyMessages) {
  const raw = await callGroq([{ role: 'system', content: buildSystemPrompt() }, ...historyMessages]);
  const match = raw.match(CONSULTANT_MARKER_RE);
  let productIds = null;
  let text = raw;
  if (match) {
    productIds = parseIds(match[1]);
    text = raw.replace(CONSULTANT_MARKER_RE, '').trim();
  }
  return { text, productIds };
}

module.exports = { GROQ_API_KEY, buildSystemPrompt, callGroq, askConsultant, CONSULTANT_MARKER_RE };
