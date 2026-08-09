const links = [
  { href: '/', label: 'Dashboard', icon: '⌂' },
  { href: '/recommended', label: 'Recommended Jobs', icon: '★' },
  { href: '/target-jobs', label: 'Target Company Jobs', icon: '◆' },
  { href: '/companies', label: 'Target Companies', icon: '◫' },
  { href: '/applications', label: 'Applications', icon: '◎' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
];

function NavigationLinks({ className }: { className: string }) {
  return <nav className={className} aria-label="Primary navigation">
    {links.map((link) => <a href={link.href} key={link.href}>
      <span aria-hidden="true">{link.icon}</span>{' '}
      <span>{link.label}</span>
    </a>)}
  </nav>;
}

export function Sidebar() {
  return <>
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="Job Agent dashboard">JOB<span>AGENT</span></a>
      <NavigationLinks className="nav" />
      <div className="side-foot">Human approval stays between AI preparation and application submission.</div>
    </aside>

    <header className="mobile-header">
      <a className="brand mobile-brand" href="/" aria-label="Job Agent dashboard">JOB<span>AGENT</span></a>
      <details className="mobile-menu">
        <summary aria-label="Open navigation menu">
          <span>Menu</span>
          <span className="mobile-menu-icon" aria-hidden="true">☰</span>
        </summary>
        <div className="mobile-menu-panel">
          <NavigationLinks className="mobile-nav" />
          <div className="mobile-menu-note">AI prepares. You review before applying or sending outreach.</div>
        </div>
      </details>
    </header>
  </>;
}
