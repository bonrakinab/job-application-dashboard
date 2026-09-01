const links = [
  { href: '/recommended', label: 'Best matches' },
  { href: '/fresh-openings', label: 'Fresh' },
  { href: '/jobs', label: 'All jobs' },
  { href: '/target-jobs', label: 'Target companies' },
  { href: '/jobs/new', label: 'Add job' },
];

export function JobsNav() {
  return <nav className="subnav" aria-label="Job views">
    {links.map((link) => <a href={link.href} key={link.href}>{link.label}</a>)}
  </nav>;
}
