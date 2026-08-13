import Papa from 'papaparse'
import { CARS_CSV_URL } from '../config'

/* ── מיפוי כותרות: תומך גם באנגלית וגם בעברית ──────────────── */
const HEADER_ALIASES = {
  id:           ['id', 'מזהה', 'קוד'],
  make:         ['make', 'manufacturer', 'יצרן'],
  model:        ['model', 'דגם'],
  year:         ['year', 'שנה', 'שנתון'],
  km:           ['km', 'mileage', 'קילומטראז', "קילומטראז'", 'קמ', 'ק"מ'],
  hand:         ['hand', 'owners', 'יד'],
  price:        ['price', 'מחיר'],
  transmission: ['transmission', 'gear', 'תיבה', 'תיבת הילוכים', 'הילוכים'],
  fuel:         ['fuel', 'דלק', 'סוג דלק', 'מנוע'],
  color:        ['color', 'colour', 'צבע'],
  seats:        ['seats', 'מקומות', 'מספר מקומות'],
  description:  ['description', 'notes', 'תיאור', 'הערות'],
  images:       ['images', 'image', 'photos', 'תמונות', 'תמונה', 'קישורי תמונות'],
  status:       ['status', 'סטטוס', 'מצב'],
}

function normalizeHeader(raw) {
  const key = String(raw ?? '').trim().toLowerCase().replace(/["']/g, '')
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.some(a => a.toLowerCase().replace(/["']/g, '') === key)) return field
  }
  return key
}

/* ── המרת מספרים: מסיר ₪ , רווחים וכו׳ ─────────────────────── */
function toNumber(value) {
  if (value == null || value === '') return null
  const cleaned = String(value).replace(/[^\d.-]/g, '')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

/* ── תמונות: תומך בפסיקים/שורות, וממיר קישורי Google Drive ── */
function driveDirectUrl(url) {
  const m = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([\w-]+)/)
  if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1600`
  return url
}

function parseImages(value) {
  if (!value) return []
  return String(value)
    .split(/[,\n|]+/)
    .map(s => s.trim())
    .filter(s => /^https?:\/\//i.test(s))
    .map(driveDirectUrl)
}

/* ── המרת שורת CSV לאובייקט רכב ────────────────────────────── */
function rowToCar(row, index) {
  const car = {}
  for (const [rawKey, rawVal] of Object.entries(row)) {
    car[normalizeHeader(rawKey)] = typeof rawVal === 'string' ? rawVal.trim() : rawVal
  }

  const make  = car.make  || ''
  const model = car.model || ''
  if (!make && !model) return null                       // שורה ריקה

  const status = String(car.status || '').toLowerCase()
  if (['sold', 'נמכר', 'hidden', 'מוסתר', 'לא פעיל', 'inactive'].includes(status)) return null

  return {
    id:           String(car.id || `${make}-${model}-${car.year || ''}-${index}`)
                    .replace(/\s+/g, '-'),
    make,
    model,
    title:        `${make} ${model}`.trim(),
    year:         toNumber(car.year),
    km:           toNumber(car.km),
    hand:         toNumber(car.hand),
    price:        toNumber(car.price),
    transmission: car.transmission || '',
    fuel:         car.fuel  || '',
    color:        car.color || '',
    seats:        toNumber(car.seats) ?? 7,
    description:  car.description || '',
    images:       parseImages(car.images),
  }
}

/* ── שליפת הקטלוג (עם מטמון בזיכרון) ───────────────────────── */
let cache = null

export function clearCarsCache() { cache = null }

export async function fetchCars({ force = false } = {}) {
  if (cache && !force) return cache

  if (!CARS_CSV_URL || CARS_CSV_URL.startsWith('PASTE_')) {
    throw new Error('לא הוגדרה כתובת גיליון הרכבים. יש לעדכן את CARS_CSV_URL בקובץ src/config.js')
  }

  const res = await fetch(CARS_CSV_URL, { cache: 'no-store' })
  if (!res.ok) throw new Error(`שגיאה בטעינת הקטלוג (${res.status})`)

  const text   = await res.text()
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })
  const cars   = (parsed.data || []).map(rowToCar).filter(Boolean)

  cache = cars
  return cars
}

/* ── עזרי תצוגה ─────────────────────────────────────────────── */
export const fmtPrice = n =>
  n == null ? 'לא צוין מחיר' : `₪${n.toLocaleString('he-IL')}`

export const fmtKm = n =>
  n == null ? '—' : `${n.toLocaleString('he-IL')} ק״מ`

export const fmtHand = n =>
  n == null ? '—' : (n === 0 ? 'יד 0 (חדש)' : `יד ${n}`)
