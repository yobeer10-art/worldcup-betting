import { Link } from 'react-router-dom'
import { fmtPrice, fmtKm, fmtHand } from '../../lib/cars'

export default function CarCard({ car }) {
  const cover = car.images[0]

  return (
    <Link
      to={`/car/${encodeURIComponent(car.id)}`}
      className="group bg-white rounded-2xl overflow-hidden border border-slate-200/80 shadow-sm
                 hover:shadow-lg hover:border-blue-200 transition-all duration-200 flex flex-col"
    >
      {/* תמונה */}
      <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
        {cover ? (
          <img
            src={cover}
            alt={car.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl opacity-20">🚐</div>
        )}

        {car.year && (
          <span className="absolute top-2.5 right-2.5 bg-slate-900/75 backdrop-blur-sm text-white
                           text-[11px] font-bold px-2.5 py-1 rounded-lg">
            {car.year}
          </span>
        )}
        {car.images.length > 1 && (
          <span className="absolute bottom-2.5 left-2.5 bg-black/55 backdrop-blur-sm text-white
                           text-[10px] font-semibold px-2 py-0.5 rounded-md">
            📷 {car.images.length}
          </span>
        )}
      </div>

      {/* פרטים */}
      <div className="p-3.5 flex flex-col flex-1">
        <h3 className="font-extrabold text-slate-900 leading-tight line-clamp-1">{car.title}</h3>

        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-[12px] text-slate-500">
          {car.km   != null && <span>{fmtKm(car.km)}</span>}
          {car.hand != null && <span>{fmtHand(car.hand)}</span>}
          {car.transmission && <span>{car.transmission}</span>}
        </div>

        <div className="mt-auto pt-3 flex items-baseline justify-between gap-2">
          <span className="text-lg font-black text-blue-700 tabular-nums">
            {fmtPrice(car.price)}
          </span>
          <span className="text-[12px] font-bold text-slate-400 group-hover:text-blue-600 transition-colors">
            לפרטים ←
          </span>
        </div>
      </div>
    </Link>
  )
}
