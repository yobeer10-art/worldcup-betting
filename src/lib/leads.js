import { LEADS_WEBAPP_URL, WHATSAPP_NUMBER } from '../config'

/* ── שמירת ליד בגיליון Google Sheets דרך Apps Script ────────
   שולחים כ-text/plain כדי להימנע מבקשת preflight (CORS),
   ו-no-cors כי Apps Script לא מחזיר כותרות CORS.
   התשובה לא נקראת — אנחנו לא חוסמים את המשתמש בגללה.       */
export async function saveLead({ name, phone, car }) {
  if (!LEADS_WEBAPP_URL || LEADS_WEBAPP_URL.startsWith('PASTE_')) {
    console.warn('[leads] LEADS_WEBAPP_URL לא הוגדר — הליד לא נשמר')
    return false
  }

  try {
    await fetch(LEADS_WEBAPP_URL, {
      method:  'POST',
      mode:    'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body:    JSON.stringify({
        name,
        phone,
        car:       car ? `${car.title}${car.year ? ` ${car.year}` : ''}` : '',
        carId:     car?.id ?? '',
        price:     car?.price ?? '',
        timestamp: new Date().toISOString(),
        source:    'אתר קטלוג',
      }),
    })
    return true
  } catch (err) {
    console.error('[leads] שמירת הליד נכשלה', err)
    return false
  }
}

/* ── בניית קישור וואטסאפ עם הודעה מוכנה ────────────────────── */
export function whatsappUrl({ name, car }) {
  const lines = [
    `שלום! מדבר/ת ${name || ''}`.trim(),
    car
      ? `ראיתי באתר את ${car.title}${car.year ? ` שנת ${car.year}` : ''} ואשמח לפרטים נוספים.`
      : 'אשמח לפרטים נוספים על הרכבים שלכם.',
  ]
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join('\n'))}`
}

/* ── ולידציה של טלפון ישראלי ────────────────────────────────── */
export function isValidPhone(phone) {
  const digits = String(phone).replace(/\D/g, '')
  return digits.length >= 9 && digits.length <= 11
}
