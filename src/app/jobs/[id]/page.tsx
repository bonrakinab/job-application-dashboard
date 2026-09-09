import { InterviewPrepCard } from '@/components/InterviewPrepCard';
import { JobActions } from '@/components/JobActions';
import { JobAnswerAssistant } from '@/components/JobAnswerAssistant';
import { JobDescription } from '@/components/JobDescription';
import { StatusPill } from '@/components/StatusPill';
import { applicationPackEligibility } from '@/lib/application-pack-eligibility';
import { getApplicationPackState, getCandidateProfileStateOptional } from '@/lib/application-pack-state';
import { externalApplicationProfile } from '@/lib/application-visibility';
import { scoreTailoredResumeWithCoursework } from '@/lib/ats-coursework';
import { profileWithTailoredCourseworkForResume } from '@/lib/education-tailoring';
import { buildInterviewPrep } from '@/lib/interview-prep';
import { emptyPartTimeProfile, PART_TIME_PROFILE_ID, profileIdForJob } from '@/lib/part-time-jobs';
import { projectTailoredApplicationProfile } from '@/lib/project-tailoring';
import { buildRequirementEvidenceMatrix } from '@/lib/requirement-evidence';
import { finalResumeArtifactState } from '@/lib/resume-generation-policy';
import { getJob, jobMatchNeedsRefresh } from '@/lib/store';
import type { JobValidityStatus, RequirementEvidence } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

function postingState(status?: JobValidityStatus) {
  if (status === 'active') return 'Active';
  if (status === 'likely_active') return 'Likely active';
  if (status === 'closed') return 'Closed';
  if (status === 'likely_closed') return 'Likely closed';
  return 'Not verified';
}

function supportLabel(item: RequirementEvidence) {
  if (item.support === 'supported') return 'Supported';
  if (item.support === 'partial') return 'Partial';
  return 'Gap';
}

function categoryLabel(item: RequirementEvidence) {
  const labels: Record<NonNullable<RequirementEvidence['category']>, string> = {
    'hard-skill': 'Hard skill',
    tool: 'Tool',
    certification: 'Certification',
    education: 'Education',
    experience: 'Experience',
    responsibility: 'Responsibility',
    'soft-skill': 'Soft skill',
    eligibility: 'Eligibility',
  };
  return item.category ? labels[item.category] : null;
}

function unique(values: string[]) {
  return values.filter((value, index, list) => value && list.indexOf(value) === index);
}

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) notFound();
  const profileId = profileIdForJob(job);
  const profileState = await getCandidateProfileStateOptional(profileId);
  const profileReady = Boolean(profileState);
  const packState = await getApplicationPackState(id, profileState?.updatedAt, profileId);
  const pack = packState.pack;
  const match = jobMatchNeedsRefresh(job.match, profileId) ? undefined : job.match;
  const eligibility = applicationPackEligibility(match);
  const packUsable = Boolean(profileReady && pack && !packState.stale);
  const sourceProfile = profileState?.profile ?? emptyPartTimeProfile();
  const applicationProfile = projectTailoredApplicationProfile(externalApplicationProfile(sourceProfile), job);
  const resumeProfile = packUsable && pack ? profileWithTailoredCourseworkForResume(applicationProfile, pack) : applicationProfile;
  const finalResume = packUsable && pack ? finalResumeArtifactState(resumeProfile, pack) : null;
  const reviewPack = finalResume?.pack ?? pack;
  const ats = finalResume ? scoreTailoredResumeWithCoursework(job, finalResume.profile, finalResume.pack, match) : null;
  const requirements = pack?.requirementEvidence?.length
    ? pack.requirementEvidence
    : buildRequirementEvidenceMatrix(job, applicationProfile, match);
  const strengths = unique(match?.strengths ?? []).slice(0, 3);
  const gaps = unique([...(match?.blockers ?? []), ...(match?.gaps ?? [])]).slice(0, 4);
  const interviewPrep = buildInterviewPrep(job, packUsable && pack ? pack : null);
  const metadata = [
    job.company,
    job.location || 'Location not listed',
    job.employmentType,
    job.workplaceType,
    formatDate(job.postedAt),
  ].filter(Boolean).join(' · ');

  return <>
    <div className="topbar simple-job-header">
      <div>
        <div className="eyebrow">{profileId === PART_TIME_PROFILE_ID ? 'Windsor part-time opportunity' : job.yc ? `Y Combinator startup${job.yc.batch ? ` · ${job.yc.batch}` : ''}` : 'Job opportunity'}</div>
        <h1 className="title">{job.title}</h1>
        <div className="sub">{metadata}</div>
      </div>
      <div className="row job-header-actions">
        {match ? <StatusPill value={match.recommendation}/> : null}
        {job.url && job.url !== '#' ? <a className="btn ghost" target="_blank" rel="noreferrer" href={job.url}>View original ↗</a> : null}
      </div>
    </div>

    <div className="grid detail-grid simple-job-grid">
      <main className="grid" style={{ alignContent: 'start' }}>
        <section className="card">
          <div className="job-fit-heading">
            <div>
              <div className="kicker">Should I apply?</div>
              <h2>{match ? `${match.overall}/100 job match` : 'Analysis needed'}</h2>
              <p className="small muted job-fit-copy">
                {match?.explanation || 'Run the job analysis to compare this role with your verified profile.'}
              </p>
            </div>
            <div className="job-readiness">
              <span>Posting <b>{postingState(job.validityStatus)}</b></span>
              <span>Documents <b>{packUsable ? 'Ready' : pack ? 'Regenerate' : 'Not generated'}</b></span>
              {ats ? <span>ATS estimate <b className={ats.targetReached ? 'text-success' : 'text-warning'}>{ats.overall}/100</b></span> : null}
              {match?.startupFit != null ? <span>Startup fit <b>{match.startupFit}/100</b></span> : null}
            </div>
          </div>

          {(strengths.length || gaps.length) ? <div className="fit-columns">
            <div>
              <div className="kicker">Best matches</div>
              {strengths.length ? <ul className="simple-list success-list">{strengths.map((item) => <li key={item}>{item}</li>)}</ul> : <span className="small muted">No clear strengths identified yet.</span>}
            </div>
            <div>
              <div className="kicker">Review before applying</div>
              {gaps.length ? <ul className="simple-list gap-list">{gaps.map((item) => <li key={item}>{item}</li>)}</ul> : <span className="small muted">No major gaps identified.</span>}
            </div>
          </div> : null}
        </section>

        <section className="card">
          <div className="section-head compact-section-head">
            <div>
              <div className="kicker">Requirements</div>
              <h2>What the job needs</h2>
            </div>
            {requirements.length ? <span className="small muted">{requirements.filter((item) => item.support === 'supported').length} of {requirements.length} supported</span> : null}
          </div>
          {requirements.length ? <div className="requirement-list">
            {requirements.map((item) => <div className="requirement-row" key={`${item.importance}-${item.requirement}`}>
              <div className="requirement-copy">
                <b>{item.requirement}</b>
                <span>{[item.importance === 'must-have' ? 'Required' : 'Preferred', categoryLabel(item), item.evidence[0]?.label].filter(Boolean).join(' · ')}</span>
              </div>
              <span className={`support-pill support-${item.support}`}>{supportLabel(item)}</span>
            </div>)}
          </div> : <p className="small muted">Run the analysis to extract and compare the role requirements.</p>}
          <p className="small muted requirement-note">Partial and gap items stay visible. The résumé uses transferable evidence but never invents missing qualifications.</p>
        </section>

        <details className="advanced-panel">
          <summary>Job description</summary>
          <div className="advanced-panel-body"><JobDescription description={job.description}/></div>
        </details>

        <details className="advanced-panel">
          <summary>More help: answers and interview prep</summary>
          <div className="advanced-panel-body job-help-grid">
            <JobAnswerAssistant jobId={id}/>
            <InterviewPrepCard prep={interviewPrep}/>
          </div>
        </details>
      </main>

      <aside className="grid" style={{ alignContent: 'start' }}>
        <JobActions
          id={id}
          applyUrl={job.applyUrl || job.url}
          hasPack={Boolean(pack)}
          packStale={packState.stale}
          status={job.application?.status || 'discovered'}
          canResearch={Boolean(process.env.OPENAI_API_KEY)}
          validityStatus={job.validityStatus}
          atsEligible={Boolean(ats?.targetReached)}
          atsScore={ats?.overall}
          packGenerationReason={eligibility.reason}
          packGenerationBlockers={eligibility.blockers}
          profileReady={profileReady}
          profileSetupUrl={profileId === PART_TIME_PROFILE_ID ? '/part-time-jobs/profile' : '/settings'}
        />
        {packUsable && pack && reviewPack ? <div className="card document-status-card">
          <div className="kicker">Application documents</div>
          <h3>Résumé and cover letter ready</h3>
          <div className="document-checks">
            <span>✓ Tailored to this job</span>
            <span>✓ Verified profile evidence only</span>
            <span>{pack.claimVerification?.status === 'pass' ? '✓ Claims checked' : '△ Claims need review'}</span>
            <span>✓ Reference-template DOCX and PDF</span>
            {pack.artifactValidation ? <span>✓ PDF and DOCX text checked</span> : <span>△ Export checks pending</span>}
          </div>
          {pack.generationMeta?.generatedAt ? <p className="small muted">Generated {formatDate(pack.generationMeta.generatedAt)}</p> : null}
          {pack.claimVerification?.replacedBullets || pack.claimVerification?.replacedFields.length ? <p className="small muted">Unsupported wording was replaced with source evidence. Review the final text below.</p> : null}
          <p className="small muted">The text below is derived from the same final resume state used by Preview final résumé, PDF, DOCX, and the ATS estimate.</p>
          <details className="advanced-panel">
            <summary>Review final résumé and source evidence</summary>
            <div className="advanced-panel-body">
              {reviewPack.resumeHeadline?.trim() ? <h4>{reviewPack.resumeHeadline}</h4> : null}
              <p>{reviewPack.resumeSummary}</p>
              <p><b>Skills:</b> {reviewPack.skills.join(', ')}</p>
              {[...reviewPack.experience.map((item) => ({ ...item, label: `${item.title} · ${item.organization}` })), ...reviewPack.projects.map((item) => ({ ...item, label: item.name }))].map((item, itemIndex) => <div key={`${itemIndex}:${item.label}`}>
                <h4>{item.label}</h4>
                <ul>{item.bullets.map((bullet, index) => {
                  const evidenceId = item.bulletEvidence?.[index]?.[0];
                  const parts = evidenceId?.split(':');
                  const source = parts?.[0] === 'EXP'
                    ? applicationProfile.experience?.[Number(parts[1])]?.bullets[Number(parts[2])]
                    : parts?.[0] === 'PROJ' ? applicationProfile.projects?.[Number(parts[1])]?.bullets?.[Number(parts[2])] : undefined;
                  return <li key={`${index}:${evidenceId ?? ''}`}>
                    <p>{bullet}</p>
                    {source ? <details><summary className="small muted">Source wording{source === bullet ? ' · unchanged' : ''}</summary><p className="small">{source}</p></details> : <p className="small muted">Source reference unavailable.</p>}
                  </li>;
                })}</ul>
              </div>)}
              <p className="small muted">Check the wording before applying. Correct facts in your profile and regenerate, or edit the Word download. Edits made outside the dashboard are not included in this audit.</p>
            </div>
          </details>
        </div> : null}
        {ats ? <details className="advanced-panel" open>
          <summary>ATS résumé audit</summary>
          <div className="advanced-panel-body">
            <div className="document-checks">
              <span>Requirement support <b>{ats.requirementCoverage}/100</b></span>
              <span>Exact JD terms <b>{ats.exactKeywordCoverage}/100</b></span>
              <span>Evidence relevance <b>{ats.evidenceRelevance}/100</b></span>
              <span>Keyword placement <b>{ats.keywordPlacement}/100</b></span>
              <span>Format hygiene <b>{ats.formatHygiene}/100</b></span>
              <span>Keyword use <b>{ats.keywordUse}</b></span>
            </div>
            {ats.missingKeywords.length ? <p className="small muted"><b>Remaining exact terms:</b> {ats.missingKeywords.slice(0, 8).join(', ')}</p> : null}
            {ats.formatIssues.length ? <p className="small muted"><b>Format review:</b> {ats.formatIssues.join(' ')}</p> : null}
            <p className="small muted">This is a transparent internal estimate with a {ats.targetScore}/100 optimization target, not a score from the employer’s proprietary ATS and not an interview guarantee.</p>
          </div>
        </details> : null}
        {job.yc && packUsable && pack?.outreachMessage ? <div className="card document-status-card">
          <div className="kicker">Founder outreach</div>
          <h3>Short founder note</h3>
          <p className="small">{pack.outreachMessage}</p>
          <p className="small muted">Review and send manually. The dashboard never contacts a founder automatically.</p>
        </div> : null}
      </aside>
    </div>
  </>;
}
