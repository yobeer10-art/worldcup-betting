import { useEffect, useMemo, useState } from 'react'
import { fetchCars } from '../lib/cars'
import { SITE, WHATSAPP_NUMBER } from '../config'
import Header from '../components/Layout/Header'
import CarCard from '../components/Cars/CarCard'
import CarFilters, { EMPTY_FILTERS, PRICE_MIN, PRICE_MAX } from '../components/Cars/CarFilters'
import Spinner from '../components/UI/Spinner'

const TRUST = [
  { icon: '🔍', text: 'רכבים בדוקים' },
  { icon: '💰', text: 'מימון עד 100%' },
  { icon: '🔑', text: 'טרייד־אין' },
]

export default function CatalogPage() {
  const [cars,    setCars]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [filters, setFilters] = useState(EMPTY_FILTERS)

  useEffect(() => {
    let alive = true
    fetchCars()
      .then(data => { if (alive) { setCars(data); setLoading(false) } })
      .catch(err  => { if (alive) { setError(err.message); setLoading(false) } })
    return () => { alive = false }
  }, [])

  // רשימת היצרנים נגזרת ממה שקיים בפועל בגיליון
  const makes = useMemo(
    () => [...new Set(cars.map(c => c.make).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b, 'he')),
    [cars]
  )

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase()
    const [pMin, pMax] = filters.price
    return cars.filter(c => {
      if (q && !c.title.toLowerCase().includes(q)) return false
      if (filters.make && c.make !== filters.make) return false
      if (pMin > PRICE_MIN && (c.price == null || c.price < pMin)) return false
      if (pMax < PRICE_MAX && (c.price == null || c.price > pMax)) return false
      if (filters.maxKm && (c.km == null || c.km > +filters.maxKm)) return false
      if (filters.maxHand) {
        if (c.hand == null) return false
        // "יד 4" = 4 ומעלה
        if (+filters.maxHand < 4 && c.hand > +filters.maxHand) return false
      }
      return true
    })
  }, [cars, filters])

  return (
    <>
      <Header />

      {/* באנר מכירה */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 text-white">
        <div className="absolute -top-16 -right-10 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-10 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 py-10 text-center">
          <span className="inline-block bg-white/10 backdrop-blur-sm text-[11px] font-extrabold
                           tracking-wider px-3 py-1 rounded-full mb-3">
            🚐 מתמחים ברכבי 7 מקומות
          </span>

          <h1 className="text-3xl sm:text-4xl font-black leading-tight">
            הרכב המשפחתי הבא שלכם
            <br />
            <span className="text-amber-300">מחכה כאן</span>
          </h1>

          <p className="text-slate-300 text-sm sm:text-base mt-3 max-w-lg mx-auto leading-relaxed">
            רכבי 7 מקומות בדוקים ומטופלים · מחיר ללא תיווך · ליווי אישי עד למסירת הרכב
          </p>

          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white
                       font-black px-7 py-3 rounded-2xl mt-5 shadow-lg shadow-emerald-900/30
                       transition-colors active:scale-95"
          >
            <span>💬</span> דברו איתנו עכשיו
          </a>

          <div className="flex justify-center gap-2 mt-6">
            {TRUST.map(t => (
              <span key={t.text} className="bg-white/10 backdrop-blur-sm text-[11px] font-bold
                                            px-3 py-1.5 rounded-xl">
                {t.icon} {t.text}
              </span>
            ))}
          </div>
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-4 py-5 space-y-5">
        {!loading && !error && (
          <CarFilters
            filters={filters}
            setFilters={setFilters}
            makes={makes}
            resultCount={filtered.length}
          />
        )}

        {loading && <Spinner label="טוען את הרכבים..." />}

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-2">😕</div>
            <p className="font-bold text-rose-700 mb-1">לא הצלחנו לטעון את הרכבים</p>
            <p className="text-[13px] text-rose-500 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-rose-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl"
            >
              נסה שוב
            </button>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
            <div className="text-4xl mb-3 opacity-30">🔍</div>
            <p className="font-bold text-slate-700">לא מצאנו רכב שמתאים לסינון</p>
            <p className="text-[13px] text-slate-400 mt-1">
              דברו איתנו — נמצא לכם את הרכב שאתם מחפשים
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center mt-4">
              <button
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="text-blue-600 font-bold text-sm px-5 py-2.5"
              >
                נקה סינון
              </button>
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}`}
                target="_blank"
                rel="noreferrer"
                className="bg-emerald-500 text-white font-bold text-sm px-5 py-2.5 rounded-xl"
              >
                💬 ספרו לנו מה אתם מחפשים
              </a>
            </div>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {filtered.map(car => <CarCard key={car.id} car={car} />)}
          </div>
        )}
      </main>

      {/* פס סיום */}
      <footer className="mt-10 bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-8 text-center">
          <p className="text-xl font-black">{SITE.name}</p>
          <p className="text-[13px] text-slate-400 mt-1">{SITE.tagline}</p>
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600
                       font-bold text-sm px-6 py-2.5 rounded-xl mt-4 transition-colors"
          >
            💬 וואטסאפ
          </a>
          {SITE.phone && (
            <a href={`tel:${SITE.phone}`} className="block text-sm font-bold text-slate-300 mt-3">
              {SITE.phone}
            </a>
          )}
        </div>
      </footer>
    </>
  )
}
