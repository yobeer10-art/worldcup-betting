export default function Spinner({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'w-5 h-5 border-2',
    md: 'w-9 h-9 border-[3px]',
    lg: 'w-14 h-14 border-4',
  }
  return (
    <div className={`flex justify-center items-center py-12 ${className}`}>
      <div
        className={`${sizes[size]} border-emerald-500 border-t-transparent rounded-full animate-spin`}
      />
    </div>
  )
}
