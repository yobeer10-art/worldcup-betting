// ── רשימת יצרנים המייצרים רכבי 7 מקומות ──────────────────────
// שם עברי קנוני + כינויים (עברית/אנגלית) לזיהוי מהגיליון
export const MAKES = [
  { he: 'טויוטה',      aliases: ['toyota'] },
  { he: 'מיצובישי',    aliases: ['mitsubishi'] },
  { he: 'יונדאי',      aliases: ['hyundai', 'הyundai', 'הונדאי'] },
  { he: 'קיה',         aliases: ['kia'] },
  { he: 'פורד',        aliases: ['ford'] },
  { he: 'שברולט',      aliases: ['chevrolet', 'chevy'] },
  { he: 'פולקסווגן',   aliases: ['volkswagen', 'vw', 'פולקסוואגן'] },
  { he: 'סקודה',       aliases: ['skoda', 'škoda'] },
  { he: 'סיאט',        aliases: ['seat', 'קופרה', 'cupra'] },
  { he: 'פיג׳ו',       aliases: ['peugeot', "פיג'ו", 'פיזו'] },
  { he: 'סיטרואן',     aliases: ['citroen', 'citroën'] },
  { he: 'רנו',         aliases: ['renault'] },
  { he: 'דאצ׳יה',      aliases: ['dacia', "דאצ'יה", 'דאציה'] },
  { he: 'ניסאן',       aliases: ['nissan', 'ניסן'] },
  { he: 'מאזדה',       aliases: ['mazda', 'מזדה'] },
  { he: 'הונדה',       aliases: ['honda'] },
  { he: 'סוזוקי',      aliases: ['suzuki'] },
  { he: 'סובארו',      aliases: ['subaru'] },
  { he: 'וולוו',       aliases: ['volvo', 'ולוו'] },
  { he: 'מרצדס',       aliases: ['mercedes', 'mercedes-benz', 'benz', 'מרצדס בנץ'] },
  { he: 'ב.מ.וו',      aliases: ['bmw', 'במוו', 'ב.מ.וו.'] },
  { he: 'אאודי',       aliases: ['audi', 'אודי'] },
  { he: 'לנד רובר',    aliases: ['land rover', 'landrover', 'range rover'] },
  { he: 'ג׳יפ',        aliases: ['jeep', "ג'יפ"] },
  { he: 'טסלה',        aliases: ['tesla'] },
  { he: 'BYD',         aliases: ['byd', 'ב.י.די', 'בי.וואי.די'] },
  { he: 'צ׳רי',        aliases: ['chery', "צ'רי", 'צירי'] },
  { he: 'MG',          aliases: ['mg', 'אם.ג׳י', "אם.ג'י"] },
  { he: 'סאנגיונג',    aliases: ['ssangyong', 'סאנגyong', 'סנגיונג'] },
  { he: 'אופל',        aliases: ['opel'] },
  { he: 'פיאט',        aliases: ['fiat'] },
  { he: 'לקסוס',       aliases: ['lexus'] },
  { he: 'אינפיניטי',   aliases: ['infiniti'] },
  { he: 'קרייזלר',     aliases: ['chrysler'] },
  { he: 'דודג׳',       aliases: ['dodge', "דודג'"] },
  { he: 'GMC',         aliases: ['gmc'] },
  { he: 'קדילק',       aliases: ['cadillac'] },
  { he: 'איסוזו',      aliases: ['isuzu'] },
  { he: 'ג׳ילי',       aliases: ['geely', "ג'ילי"] },
  { he: 'גרייט וול',   aliases: ['great wall', 'gwm', 'haval', 'האוול'] },
  { he: 'לינק אנד קו', aliases: ['lynk', 'lynk & co', 'lynk&co'] },
  { he: 'אלפא רומיאו', aliases: ['alfa romeo', 'alfa'] },
  { he: 'פורשה',       aliases: ['porsche'] },
  { he: 'טאטא',        aliases: ['tata'] },
  { he: 'מקסוס',       aliases: ['maxus', 'ldv'] },
  { he: 'סאיק',        aliases: ['saic'] },
  { he: 'אקסיד',       aliases: ['exeed'] },
  { he: 'ג׳אק',        aliases: ['jac', "ג'אק"] },
  { he: 'פורד טרנזיט', aliases: ['transit'] },
]

// מפה מהירה: כינוי (lowercase) ➜ שם עברי קנוני
const LOOKUP = new Map()
for (const { he, aliases } of MAKES) {
  LOOKUP.set(he.toLowerCase(), he)
  LOOKUP.set(he.replace(/[׳']/g, '').toLowerCase(), he)
  for (const a of aliases) {
    LOOKUP.set(a.toLowerCase(), he)
    LOOKUP.set(a.replace(/[׳']/g, '').toLowerCase(), he)
  }
}

/** מנרמל שם יצרן מהגיליון לשם עברי קנוני. לא מזוהה ➜ מוחזר כמו שהוא. */
export function normalizeMake(raw) {
  const key = String(raw ?? '').trim()
  if (!key) return ''
  return LOOKUP.get(key.toLowerCase())
      ?? LOOKUP.get(key.replace(/[׳']/g, '').toLowerCase())
      ?? key
}

/** כל השמות הקנוניים, ממוינים בעברית */
export const ALL_MAKE_NAMES = MAKES.map(m => m.he)
  .sort((a, b) => a.localeCompare(b, 'he'))
