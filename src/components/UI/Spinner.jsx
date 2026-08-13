export default function Spinner({ label = 'טוען...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-9 h-9 border-[3px] border-slate-200 border-t-blue-600 rounded-full animate-spin" />
      <p className="text-sm text-slate-400 font-medium">{label}</p>
    </div>
  )
}
