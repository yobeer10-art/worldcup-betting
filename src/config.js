// ════════════════════════════════════════════════════════════════
//  הגדרות האתר — כל מה שצריך לשנות נמצא כאן
// ════════════════════════════════════════════════════════════════

// 1️⃣ כתובת ה-CSV של גיליון הרכבים (Google Sheets → פרסום באינטרנט → CSV)
//    צריכה להיראות כך:
//    https://docs.google.com/spreadsheets/d/e/2PACX-XXXX/pub?gid=0&single=true&output=csv
export const CARS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTqNi6o2fDIBg_thZWUMFUTTH4zkvYvaHfIGNT_7ImIpjyldnzF2SQ0sKPSpS-aJtHwAbSC98iDkV3D/pub?gid=0&single=true&output=csv'

// 2️⃣ כתובת ה-Web App של Google Apps Script (לשמירת לידים)
//    צריכה להיראות כך:
//    https://script.google.com/macros/s/AKfycbXXXX/exec
export const LEADS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbyCTE9kJSjyRzETbl2mYvUHFf30zwdM1KnNBA-nu4CY758O5DAE4jK4K0DJpKN90AVaOQ/exec'

// 3️⃣ מספר הוואטסאפ שאליו נשלחות הפניות (פורמט בינלאומי, בלי + ובלי אפס מוביל)
//    לדוגמה: 0501234567  ➜  972501234567
export const WHATSAPP_NUMBER = '972508118515'

// 4️⃣ פרטי העסק
export const SITE = {
  name:     'רכבי 7 מקומות',
  tagline:  'הקטלוג המוביל לרכבי 7 מקומות בישראל',
  phone:    '050-8118515',
  email:    '',
}
