const primaryLinks = [
  { href: '/', label: 'Home' },
  { href: '/recommended', label: 'Jobs' },
  { href: '/applications', label: 'Applications' },
  { href: '/settings', label: 'Profile & settings' },
  { href: '/workspace', label: 'More' },
];

function NavigationLinks({ className }: { className: string }) {
  return <nav className={className} aria-label="Primary navigation">
    {primaryLinks.map((link) => <a href={link.href} key={link.href}>{link.label}</a>)}
  </nav>;
}

export function Sidebar() {
  return <>
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="Job dashboard">JOB <span>DASHBOARD</span></a>
      <NavigationLinks className="nav" />
      <div className="side-foot">Find jobs, prepare documents, and track applications.</div>
    </aside>

    <header className="mobile-header">
      <a className="brand mobile-brand" href="/" aria-label="Job dashboard">JOB <span>DASHBOARD</span></a>
      <details className="mobile-menu">
        <summary aria-label="Open navigation menu">
          <span>Menu</span>
          <span className="mobile-menu-icon" aria-hidden="true">☰</span>
        </summary>
        <div className="mobile-menu-panel">
          <NavigationLinks className="mobile-nav" />
          <div className="mobile-menu-note">Everything needed for your job search, in one place.</div>
        </div>
      </details>
    </header>
  </>;
}
