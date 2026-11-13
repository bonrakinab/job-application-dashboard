'use client';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/recommended', label: 'Best matches' },
  { href: '/fresh-openings', label: 'Recent' },
  { href: '/customer-service', label: 'Customer Service' },
  { href: '/part-time-jobs', label: 'Part-time' },
  { href: '/jobs', label: 'All jobs' },
  { href: '/target-jobs', label: 'Fortune 500' },
  { href: '/jobs/new', label: 'Add job' },
];

export function JobsNav() {
  const pathname = usePathname();
  return <nav className="subnav" aria-label="Job views">
    {links.map((link) => <a href={link.href} key={link.href} aria-current={pathname === link.href ? 'page' : undefined}>{link.label}</a>)}
  </nav>;
}
