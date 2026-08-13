import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchCars, fmtPrice, fmtKm, fmtHand } from '../lib/cars'
import Header from '../components/Layout/Header'
import Spinner from '../components/UI/Spinner'
import LeadModal from '../components/Cars/LeadModal'

function Spec({ label, value }) {
  if (!value || value === '—') return null
  return (
    <div className="bg-slate-50 rounded-xl px-3 py-2.5">
      <p className="text-[11px] font-bold text-slate-400">{label}</p>
      <p className="text-sm font-extrabold text-slate-800 mt-0.5">{value}</p>
    </div>
  )
}

export default function CarDetailPage() {
  const { id } = useParams()
  const [car,     setCar]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [active,  setActive]  = useState(0)
  const [showLead, setShowLead] = useState(false)

  useEffect(() => {
    let alive = true
    fetchCars()
      .then(cars => {
        if (!alive) return
        setCar(cars.find(c => c.id === decodeURIComponent(id)) ?? null)
        setLoading(false)
      })
      .catch(err => { if (alive) { setError(err.message); setLoading(false) } })
    return () => { alive = false }
  }, [id])

  if (loading) return <><Header /><Spinner label="טוען את הרכב..." /></>

  if (error || !car) {
    return (
      <>
        <Header />
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <div className="text-4xl mb-3 opacity-30">🚐</div>
          <p className="font-bold text-slate-700">{error ?? 'הרכב לא נמצא'}</p>
          <Link to="/" className="inline-block mt-4 text-blue-600 font-bold text-sm">
            ← חזרה לקטלוג
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <Header />

      <main className="max-w-3xl mx-auto px-4 py-4 pb-28">
        <Link to="/" className="text-[13px] font-bold text-slate-400 hover:text-blue-600 transition-colors">
          ← חזרה לקטלוג
        </Link>

        {/* גלריה */}
        <div className="mt-3 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200">
          <div className="aspect-[4/3] sm:aspect-[16/10]">
            {car.images[active] ? (
              <img src={car.images[active]} alt={car.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-6xl opacity-20">🚐</div>
            )}
          </div>
        </div>

        {car.images.length > 1 && (
          <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
            {car.images.map((src, i) => (
              <button
                key={src + i}
                onClick={() => setActive(i)}
                className={`shrink-0 w-20 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                  i === active ? 'border-blue-500 ring-2 ring-blue-100' : 'border-transparent opacity-60'
                }`}
              >
                <img src={src} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {/* כותרת + מחיר */}
        <div className="mt-5">
          <h1 className="text-2xl font-black text-slate-900 leading-tight">{car.title}</h1>
          <div className="flex items-center gap-2 mt-1.5 text-sm text-slate-400 font-semibold">
            {car.year && <span>{car.year}</span>}
            {car.km != null && <><span>·</span><span>{fmtKm(car.km)}</span></>}
            {car.hand != null && <><span>·</span><span>{fmtHand(car.hand)}</span></>}
          </div>
          <p className="text-3xl font-black text-blue-700 mt-3 tabular-nums">{fmtPrice(car.price)}</p>
        </div>

        {/* מפרט */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-5">
          <Spec label="שנתון"        value={car.year} />
          <Spec label="קילומטראז׳"   value={car.km != null ? fmtKm(car.km) : null} />
          <Spec label="יד"           value={car.hand != null ? fmtHand(car.hand) : null} />
          <Spec label="תיבת הילוכים" value={car.transmission} />
          <Spec label="סוג מנוע"     value={car.fuel} />
          <Spec label="צבע"          value={car.color} />
          <Spec label="מספר מקומות"  value={car.seats ? `${car.seats} מקומות` : null} />
        </div>

        {/* תיאור */}
        {car.description && (
          <div className="mt-5 bg-white border border-slate-200 rounded-2xl p-4">
            <h2 className="text-sm font-black text-slate-800 mb-2">על הרכב</h2>
            <p className="text-[14px] text-slate-600 leading-relaxed whitespace-pre-line">
              {car.description}
            </p>
          </div>
        )}
      </main>

      {/* פס פעולה קבוע */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-slate-400 font-bold leading-tight truncate">{car.title}</p>
            <p className="text-base font-black text-blue-700 tabular-nums leading-tight">
              {fmtPrice(car.price)}
            </p>
          </div>
          <button
            onClick={() => setShowLead(true)}
            className="shrink-0 bg-emerald-500 hover:bg-emerald-600 text-white font-black
                       px-6 py-3 rounded-2xl transition-colors active:scale-95 flex items-center gap-2"
          >
            <span>💬</span> לפרטים נוספים
          </button>
        </div>
      </div>

      {showLead && <LeadModal car={car} onClose={() => setShowLead(false)} />}
    </>
  )
}
