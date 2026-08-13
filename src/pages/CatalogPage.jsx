import { useEffect, useMemo, useState } from 'react'
import { fetchCars } from '../lib/cars'
import { SITE } from '../config'
import Header from '../components/Layout/Header'
import CarCard from '../components/Cars/CarCard'
import CarFilters, { EMPTY_FILTERS } from '../components/Cars/CarFilters'
import Spinner from '../components/UI/Spinner'

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

  const makes = useMemo(
    () => [...new Set(cars.map(c => c.make).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'he')),
    [cars]
  )

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase()
    return cars.filter(c => {
      if (q && !c.title.toLowerCase().includes(q)) return false
      if (filters.make     && c.make !== filters.make) return false
      if (filters.minPrice && (c.price == null || c.price < +filters.minPrice)) return false
      if (filters.maxPrice && (c.price == null || c.price > +filters.maxPrice)) return false
      if (filters.maxKm    && (c.km    == null || c.km    > +filters.maxKm))    return false
      if (filters.maxHand  && (c.hand  == null || c.hand  > +filters.maxHand))  return false
      return true
    })
  }, [cars, filters])

  return (
    <>
      <Header />

      {/* כותרת ראשית */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-9 text-center">
          <h1 className="text-2xl sm:text-3xl font-black leading-tight">
            רכבי 7 מקומות למשפחה
          </h1>
          <p className="text-slate-300 text-sm mt-2 max-w-md mx-auto">
            מבחר רכבים משפחתיים במצב מעולה · מחירים הוגנים · ליווי אישי עד לרכב
          </p>
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

        {loading && <Spinner label="טוען את הקטלוג..." />}

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-2">😕</div>
            <p className="font-bold text-rose-700 mb-1">לא הצלחנו לטעון את הקטלוג</p>
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
            <p className="font-bold text-slate-700">לא נמצאו רכבים מתאימים</p>
            <p className="text-[13px] text-slate-400 mt-1">נסו לשנות את הסינון</p>
            <button
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="mt-4 text-blue-600 font-bold text-sm"
            >
              נקה סינון
            </button>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {filtered.map(car => <CarCard key={car.id} car={car} />)}
          </div>
        )}
      </main>

      <footer className="mt-8 border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center">
          <p className="text-sm font-extrabold text-slate-700">{SITE.name}</p>
          <p className="text-[12px] text-slate-400 mt-1">{SITE.tagline}</p>
          {SITE.phone && (
            <a href={`tel:${SITE.phone}`} className="text-[13px] font-bold text-blue-600 mt-2 inline-block">
              {SITE.phone}
            </a>
          )}
        </div>
      </footer>
    </>
  )
}
