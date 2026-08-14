import { useEffect, useState } from 'react'

/* תמונת רכב עמידה: כתובת לא תקינה / תמונה שנכשלה ➜ פלייסהולדר נקי */
export default function CarImage({ src, alt = '', className = '', iconSize = 'text-4xl' }) {
  const [failed, setFailed] = useState(false)

  useEffect(() => { setFailed(false) }, [src])

  const usable = typeof src === 'string' && /^https?:\/\//i.test(src)

  if (!usable || failed) {
    return (
      <div className={`bg-slate-100 flex flex-col items-center justify-center gap-1 ${className}`}>
        <span className={`${iconSize} opacity-25`}>🚐</span>
        <span className="text-[10px] text-slate-300 font-semibold">אין תמונה</span>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  )
}
