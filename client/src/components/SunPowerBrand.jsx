export default function SunPowerBrand({ subtitle = 'Solar Installation Management' }) {
  return (
    <div className="brand-lockup">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32">
          <circle cx="16" cy="13" r="4.2" />
          <path d="M16 5.2v2.1M16 18.7v2.1M7.6 13H5.4M26.6 13h-2.2M9.4 6.6l1.5 1.5M21.1 18.3l1.5 1.5M22.6 6.6l-1.5 1.5M10.9 18.3 9.4 19.8" />
          <path d="M6.5 24.5h19l-2.2-4.2H8.7z" />
        </svg>
      </span>
      <span className="brand-copy">
        <strong>SunPower Solutions</strong>
        <span>{subtitle}</span>
      </span>
    </div>
  )
}
