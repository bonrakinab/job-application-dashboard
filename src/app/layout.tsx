import type { Metadata, Viewport } from 'next';
import './globals.css';
import './mobile.css';
import './job-detail.css';
import './simple-ui.css';
import { Sidebar } from '@/components/Sidebar';

export const metadata: Metadata = { title: 'Job Dashboard', description: 'Find jobs, prepare application documents, and track applications.' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><div className="shell"><Sidebar/><main className="content">{children}</main></div></body></html>;
}
