const db = require('./db');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

const CONSULTANT_MARKER_RE = /\[\[РЕКОМЕНДАЦИЯ:\s*([\d,\s]+)\]\]/i;

function buildSystemPrompt() {
  const products = db.getProducts({ onlyActive: true }).filter(p => p.stock > 0);
  const catalogText = products
    .map(p => `#${p.id} [${p.section}/${p.category}] ${p.brand ? p.brand + ' ' : ''}${p.name} — ${p.price}₽`)
    .join('\n');

  return `Ты — тёплый, дружелюбный и профессиональный бот-консультант интернет-магазина HealthTeam (БАДы, витамины, спортивное питание). Общайся с покупателем на "ты", живо и по-человечески, без канцелярита.

Твоя задача — провести короткую беседу и узнать:
1) чем человек занимается по жизни (род занятий, уровень активности),
2) какие у него цели (похудение, набор массы, поддержание формы, энергия и т.д.),
3) каким спортом занимается, если занимается,
4) его рост и вес.

Задавай вопросы по одному-два за раз, не вываливай всё сразу. Реагируй на ответы человека, проявляй интерес.

Когда соберёшь достаточно информации (обычно после 3-5 вопросов) — напиши подробную рекомендацию: объясни, почему именно эти добавки подходят под его ситуацию и как их лучше принимать.

В конце этого сообщения с рекомендацией (и только тогда, когда рекомендация готова) добавь последней строкой маркер в ТОЧНО таком формате, используя только реальные ID из каталога ниже, от 2 до 5 штук через запятую:
[[РЕКОМЕНДАЦИЯ: id1,id2,id3]]

Не показывай и не упоминай этот маркер, пока не закончил сбор информации и не дал полную развёрнутую рекомендацию. До этого момента в сообщениях маркера быть не должно.

Каталог доступных товаров (используй только эти ID):
${catalogText}`;
}

async function callGemini(messages) {
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GEMINI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gemini-2.5-flash',
      messages,
      temperature: 0.7,
      max_tokens: 700
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'gemini_error');
  return data.choices[0].message.content;
}

// Отправляет всю историю разговора в Gemini и возвращает { text, productIds }
// productIds не null, только когда ИИ закончил подбор и вставил маркер рекомендации
async function askConsultant(historyMessages) {
  const raw = await callGemini([{ role: 'system', content: buildSystemPrompt() }, ...historyMessages]);
  const match = raw.match(CONSULTANT_MARKER_RE);
  let productIds = null;
  let text = raw;
  if (match) {
    productIds = match[1].split(',').map(s => Number(s.trim())).filter(Boolean);
    text = raw.replace(CONSULTANT_MARKER_RE, '').trim();
  }
  return { text, productIds };
}

module.exports = { GEMINI_API_KEY, buildSystemPrompt, callGemini, askConsultant, CONSULTANT_MARKER_RE };
