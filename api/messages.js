const rateBuckets = globalThis.__syriaJobsMessageRateBuckets || new Map();
globalThis.__syriaJobsMessageRateBuckets = rateBuckets;

const escapeTelegramHtml = (value) => String(value).replace(/[&<>]/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;'
}[character]));

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(payload));
}

function allowRequest(ip) {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const timestamps = (rateBuckets.get(ip) || []).filter((timestamp) => now - timestamp < windowMs);
  if (timestamps.length >= 3) {
    rateBuckets.set(ip, timestamps);
    return false;
  }
  timestamps.push(now);
  rateBuckets.set(ip, timestamps);
  if (rateBuckets.size > 5000) {
    for (const [key, values] of rateBuckets) {
      if (!values.length || now - values[values.length - 1] >= windowMs) rateBuckets.delete(key);
    }
  }
  return true;
}

module.exports = async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendJson(response, 405, { error: 'الطريقة غير مسموحة.' });
  }

  let body = request.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return sendJson(response, 400, { error: 'صيغة الطلب غير صحيحة.' }); }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return sendJson(response, 400, { error: 'البيانات غير صحيحة.' });
  }

  // Honeypot field: accept silently without storing or notifying.
  if (typeof body.website === 'string' && body.website.trim()) {
    return sendJson(response, 201, { ok: true });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const contact = typeof body.contact === 'string' ? body.contact.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (name.length < 2 || name.length > 100 || contact.length < 3 || contact.length > 180 || message.length < 5 || message.length > 3000) {
    return sendJson(response, 400, { error: 'تحقق من الاسم ووسيلة التواصل والرسالة.' });
  }

  const forwardedFor = request.headers['x-forwarded-for'];
  const ip = String(Array.isArray(forwardedFor) ? forwardedFor[0] : (forwardedFor || request.socket?.remoteAddress || 'unknown')).split(',')[0].trim();
  if (!allowRequest(ip)) return sendJson(response, 429, { error: 'وصلت رسائل كثيرة من اتصالك. حاول بعد قليل.' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_LEGACY_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('Message storage is not configured:', JSON.stringify({ hasUrl: Boolean(supabaseUrl), hasServiceKey: Boolean(serviceKey) }));
    return sendJson(response, 503, { error: 'خدمة الرسائل غير مهيأة بعد.' });
  }

  let headers = {
    apikey: serviceKey,
    'Content-Type': 'application/json',
    Prefer: 'return=representation'
  };
  if (serviceKey.startsWith('eyJ')) {
    let role = '';
    try { role = JSON.parse(Buffer.from(serviceKey.split('.')[1], 'base64url').toString('utf8')).role || ''; } catch {}
    if (role !== 'service_role') {
      console.error('Message storage key is not a legacy service_role JWT.');
      console.error('If SUPABASE_KEY is configured, confirm it is a service_role key.');
      return sendJson(response, 503, { error: 'مفتاح حفظ الرسائل غير صالح. استخدم service_role أو sb_secret.' });
    }
    headers.Authorization = `Bearer ${serviceKey}`;
  } else if (!serviceKey.startsWith('sb_secret_')) {
    console.error('Message storage key format is not recognized.');
    return sendJson(response, 503, { error: 'صيغة مفتاح Supabase غير مدعومة.' });
  }

  let savedMessage;
  try {
    const databaseResponse = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/messages?select=id,created_at`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name, contact, message }),
      signal: AbortSignal.timeout(10000)
    });
    if (!databaseResponse.ok) {
      let errorCode = 'unknown';
      try { errorCode = (await databaseResponse.json()).code || 'unknown'; } catch {}
      console.error('Message insert failed:', JSON.stringify({ status: databaseResponse.status, code: String(errorCode).slice(0, 80) }));
      return sendJson(response, 502, { error: 'تعذر حفظ رسالتك الآن. حاول مجددًا لاحقًا.' });
    }
    const rows = await databaseResponse.json();
    savedMessage = rows[0];
    if (!savedMessage) throw new Error('Database returned no message record');
  } catch (error) {
    console.error('Message storage request failed:', error.name || 'Error');
    return sendJson(response, 502, { error: 'تعذر حفظ رسالتك الآن. حاول مجددًا لاحقًا.' });
  }

  let notification = 'not_configured';
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (botToken && chatId) {
    try {
      const text = [
        '<b>رسالة تواصل جديدة — وظائف سوريا</b>',
        `<b>الاسم:</b> ${escapeTelegramHtml(name)}`,
        `<b>وسيلة التواصل:</b> ${escapeTelegramHtml(contact)}`,
        `<b>الرسالة:</b> ${escapeTelegramHtml(message)}`
      ].join('\n');
      const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
        signal: AbortSignal.timeout(10000)
      });
      notification = telegramResponse.ok ? 'sent' : 'failed';
      if (!telegramResponse.ok) console.error('Telegram notification failed with status:', telegramResponse.status);
    } catch (error) {
      notification = 'failed';
      console.error('Telegram notification request failed:', error.name || 'Error');
    }
  }

  return sendJson(response, 201, { ok: true, notification, id: savedMessage.id });
};
