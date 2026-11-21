export default function Icon({ name, className = 'icon' }) {
  const props = {
    viewBox: '0 0 24 24',
    className,
    'aria-hidden': 'true',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.8',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }

  switch (name) {
    case 'overview':
      return (
        <svg {...props}>
          <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
        </svg>
      )
    case 'customers':
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="3.2" />
          <path d="M5.5 19.2c1.4-3 3.7-4.4 6.5-4.4s5.1 1.4 6.5 4.4" />
        </svg>
      )
    case 'surveys':
      return (
        <svg {...props}>
          <path d="M4 11.5 12 4l8 7.5" />
          <path d="M7 10.5V20h10v-9.5" />
          <path d="M10 20v-5h4v5" />
        </svg>
      )
    case 'quotations':
      return (
        <svg {...props}>
          <path d="M7 3.5h7l5 5V20.5H7z" />
          <path d="M14 3.5V9h5" />
          <path d="M10 13h6M10 16.5h4" />
        </svg>
      )
    case 'inventory':
      return (
        <svg {...props}>
          <path d="M3.5 8 12 4l8.5 4L12 12z" />
          <path d="M3.5 8v8L12 20l8.5-4V8" />
          <path d="M12 12v8" />
        </svg>
      )
    case 'installations':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3.2" />
          <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18" />
        </svg>
      )
    case 'technicians':
      return (
        <svg {...props}>
          <circle cx="9" cy="9" r="2.6" />
          <circle cx="16" cy="10" r="2.2" />
          <path d="M4.5 18.5c.9-2.4 2.6-3.6 4.5-3.6s3.6 1.2 4.5 3.6" />
          <path d="M14 14.8c1.3-.5 2.4-.4 3.4.2 1 .7 1.6 1.8 1.9 3.5" />
        </svg>
      )
    case 'warranties':
      return (
        <svg {...props}>
          <path d="M12 3.5 5.5 6v5.4c0 3.8 2.5 6.4 6.5 8.1 4-1.7 6.5-4.3 6.5-8.1V6z" />
          <path d="m9 12 2 2 4-4.2" />
        </svg>
      )
    case 'service':
      return (
        <svg {...props}>
          <path d="M14.5 6.5a3.2 3.2 0 0 0-4.4 4.4L4.5 16.5l3 3 5.6-5.6a3.2 3.2 0 0 0 4.4-4.4l-2.2 2.2-2.1-2.1z" />
        </svg>
      )
    case 'reports':
      return (
        <svg {...props}>
          <path d="M4.5 19.5h15" />
          <path d="M7 16.5v-4M12 16.5V7.5M17 16.5v-6.5" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6.1 6.1l1.5 1.5M16.4 16.4l1.5 1.5M17.9 6.1l-1.5 1.5M7.6 16.4l-1.5 1.5" />
        </svg>
      )
    case 'search':
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="6" />
          <path d="m16 16 4 4" />
        </svg>
      )
    case 'bell':
      return (
        <svg {...props}>
          <path d="M6 16.5h12l-1.2-2V10a4.8 4.8 0 0 0-9.6 0v4.5z" />
          <path d="M10 18.5a2 2 0 0 0 4 0" />
        </svg>
      )
    case 'menu':
      return (
        <svg {...props}>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      )
    case 'close':
      return (
        <svg {...props}>
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      )
    default:
      return null
  }
}
