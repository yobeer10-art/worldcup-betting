import { useState } from 'react'
import { saveLead, whatsappUrl, isValidPhone } from '../../lib/leads'
import { fmtPrice } from '../../lib/cars'

export default function LeadModal({ car, onClose }) {
  const [name,    setName]    = useState('')
  const [phone,   setPhone]   = useState('')
  const [sending, setSending] = useState(false)
  const [error,   setError]   = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (sending) return

    if (name.trim().length < 2)  return setError('נא להזין שם מלא')
    if (!isValidPhone(phone))    return setError('נא להזין מספר טלפון תקין')

    setError(null)
    setSending(true)

    // פותחים את החלון מיד — כדי שדפדפני מובייל לא יחסמו אותו כפופ-אפ
    const win = window.open('', '_blank')

    await saveLead({ name: name.trim(), phone: phone.trim(), car })

    const url = whatsappUrl({ name: name.trim(), car })
    if (win) win.location.href = url
    else     window.location.href = url

    setSending(false)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center
                 justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* ידית גרירה במובייל */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4 sm:hidden" />

        <h3 className="text-lg font-black text-slate-900 text-center">מעוניינים בפרטים?</h3>
        <p className="text-[13px] text-slate-400 text-center mt-1 mb-4">
          נשמח לחזור אליכם עם כל המידע
        </p>

        {/* הרכב שנבחר */}
        {car && (
          <div className="flex items-center gap-3 bg-slate-50 rounded-2xl p-3 mb-4">
            {car.images[0] && (
              <img
                src={car.images[0]}
                alt={car.title}
                className="w-16 h-14 object-cover rounded-xl shrink-0"
              />
            )}
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-slate-800 truncate">{car.title}</p>
              <p className="text-[12px] text-slate-400">
                {car.year ? `${car.year} · ` : ''}{fmtPrice(car.price)}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-[11px] font-bold text-slate-400 block mb-1">שם מלא</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="ישראל ישראלי"
              autoFocus
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-sm
                         font-semibold text-slate-700 placeholder:text-slate-300 placeholder:font-normal
                         focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-400 block mb-1">טלפון</label>
            <input
              type="tel"
              inputMode="tel"
              dir="ltr"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="050-1234567"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-sm
                         font-semibold text-slate-700 placeholder:text-slate-300 placeholder:font-normal
                         text-right focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
            />
          </div>

          {error && (
            <p className="text-[12px] font-bold text-rose-500 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={sending}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white
                       font-black py-3.5 rounded-2xl transition-colors active:scale-[0.98]
                       flex items-center justify-center gap-2"
          >
            {sending ? 'שולח...' : <><span>💬</span> המשך לוואטסאפ</>}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full text-slate-400 font-bold text-sm py-1"
          >
            ביטול
          </button>
        </form>

        <p className="text-[10px] text-slate-300 text-center mt-2">
          הפרטים נשמרים אצלנו לצורך חזרה אליכם בלבד
        </p>
      </div>
    </div>
  )
}
