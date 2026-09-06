import { JobsNav } from '@/components/JobsNav';
import { ManualJobForm } from '@/components/ManualJobForm';
import styles from '@/components/ManualJobForm.module.css';

export default async function NewJobPage({ searchParams }: { searchParams: Promise<{ profile?: string }> }) {
  const { profile } = await searchParams;
  return <>
    <div className="topbar simple-topbar">
      <div>
        <div className="eyebrow">Manual job</div>
        <h1 className="title">Paste a job description</h1>
        <div className="sub">Add a role that the dashboard did not discover, then generate its tailored résumé and cover letter.</div>
      </div>
    </div>

    <JobsNav />
    <div className={styles.page}>
      <ManualJobForm initialProfileId={profile === 'part-time' ? 'part-time' : 'default'} />
    </div>
  </>;
}
