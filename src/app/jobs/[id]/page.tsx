import { InterviewPrepCard } from '@/components/InterviewPrepCard';
import { JobActions } from '@/components/JobActions';
import { JobAnswerAssistant } from '@/components/JobAnswerAssistant';
import { JobDescription } from '@/components/JobDescription';
import { StatusPill } from '@/components/StatusPill';
import { aiStatus } from '@/lib/ai';
import { getApplicationPackState, getCandidateProfileState } from '@/lib/application-pack-state';
import { scoreTailoredResume } from '@/lib/ats-score';
import { buildInterviewPrep } from '@/lib/interview-prep';
import { getCompanyIntelligence, getJob } from '@/lib/store';
import { formatDate } from '@/lib/utils';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) notFound();
  const profileState = await getCandidateProfileState();
  const [packState, research] = await Promise.all([
    getApplicationPackState(id, profileState.updatedAt),
    getCompanyIntelligence(job.company),
  ]);
  const pack = packState.pack;
  const match = job.match;
  const ats = pack && !packState.stale ? scoreTailoredResume(job, profileState.profile, pack, match) : null;
  const interviewPrep = buildInterviewPrep(job, pack && !packState.stale ? pack : null);
  const ai = aiStatus();
  const canResearch = ai.openai;

  return <>
    <div className="topbar">
      <div>
        <div className="eyebrow">Opportunity review</div>
        <h1 className="title">{job.title}</h1>
        <div className="sub">{job.company} · {job.location || 'Location not listed'} · {formatDate(job.postedAt)}</div>
      </div>
      <div className="row">{match ? <><span className="score">{match.overall}/100</span><StatusPill value={match.recommendation}/></> : null}</div>
    </div>

    <div className="grid detail-grid">
      <div className="grid">
        {match?.blockers?.length ? <div className="card"><div className="kicker">Hard blockers</div>{match.blockers.map((blocker) => <div className="blocker" key={blocker}>{blocker}</div>)}</div> : null}

        {match ? <div className="card">
          <div className="kicker">Fit breakdown</div>
          <div className="grid score-grid">{[['Skills', match.skills], ['Experience', match.experience], ['Education', match.education], ['Domain', match.domain], ['Location', match.location]].map(([label, value]) => <div className="score-box" key={String(label)}><b>{value}</b><span>{label}</span><div className="progress"><span style={{ width: `${value}%` }}/></div></div>)}</div>
          <div className="divider"/>
          <p className="small muted" style={{ lineHeight: 1.6 }}>{match.explanation}</p>
          <div className="row">
            <div><div className="kicker">Strengths</div><div className="tag-list">{match.strengths.map((item) => <span className="tag" key={item}>{item}</span>)}</div></div>
            <div><div className="kicker">Gaps</div><div className="tag-list">{match.gaps.map((item) => <span className="tag" key={item}>{item}</span>)}</div></div>
          </div>
        </div> : <div className="notice">This job has not been analyzed yet.</div>}

        {research ? <div className="card">
          <div className="kicker">Company + hiring-team intelligence</div>
          <p className="small" style={{ lineHeight: 1.7 }}>{research.summary}</p>
          <div className="divider"/>
          <div className="kicker">Recent signals</div>
          <div className="tag-list">{research.recentSignals.map((item) => <span className="tag" key={item}>{item}</span>)}</div>
          <div className="divider"/>
          <div className="kicker">Potential public contacts</div>
          {research.contacts.length ? research.contacts.map((contact) => <div className="small" key={`${contact.name}-${contact.title}`} style={{ marginBottom: 12 }}><b>{contact.name}</b> · {contact.title}<br/><span className="muted">{contact.whyRelevant}</span><br/><a href={contact.publicProfileUrl} target="_blank" rel="noreferrer">Public profile ↗</a></div>) : <span className="small muted">No sufficiently supported public contact was found.</span>}
          <div className="divider"/>
          <div className="kicker">Research sources</div>
          {research.sources.map((source) => <div className="small" key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a></div>)}
        </div> : null}

        {packState.stale ? <div className="notice">
          <b>Application pack is outdated.</b> {packState.reasons.join(' ')} Regenerate it before downloading or using it for an application.
        </div> : null}

        {pack ? <div className="card">
          <div className="kicker">Generated application pack{packState.stale ? ' · outdated' : ''}</div>
          <h3>{pack.resumeHeadline}</h3>
          <p className="small" style={{ lineHeight: 1.7 }}>{pack.resumeSummary}</p>
          <div className="divider"/>
          <div className="kicker">Selected resume evidence</div>
          <div className="tag-list">{pack.skills.slice(0, 20).map((item) => <span className="tag" key={item}>{item}</span>)}</div>
          <div className="divider"/>
          <div className="kicker">Cover letter body</div>
          <p className="small" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{pack.coverLetter}</p>
          <div className="divider"/>
          <div className="kicker">Outreach draft</div>
          <p className="small" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{pack.outreachMessage}</p>
          <div className="divider"/>
          <div className="kicker">Interview themes</div>
          <div className="tag-list">{pack.interviewThemes.map((item) => <span className="tag" key={item}>{item}</span>)}</div>
          <div className="divider"/>
          <div className="kicker">Claims audit</div>
          {pack.claimsAudit.length ? pack.claimsAudit.slice(0, 10).map((item, index) => <div className="small" style={{ marginBottom: 9 }} key={index}><b>{item.claim}</b><br/><span className="muted">Evidence: {item.evidence}</span></div>) : <span className="small muted">No authored claims required additional evidence entries.</span>}
        </div> : null}

        <div className="card"><div className="kicker">Job description</div><JobDescription description={job.description}/></div>
      </div>

      <div className="grid" style={{ alignContent: 'start' }}>
        {ats ? <div className="card">
          <div className="kicker">ATS match estimate · tailored resume vs this JD</div>
          <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <div><span className="score">{ats.overall}/100</span> <StatusPill value={ats.label === 'strong' ? 'strong' : ats.label === 'good' ? 'reasonable' : ats.label === 'moderate' ? 'stretch' : 'skip'}/></div>
          </div>
          <p className="small muted" style={{ lineHeight: 1.55 }}>{ats.explanation}</p>
          <div className="grid score-grid">
            {[
              ['JD skills', ats.skillCoverage],
              ['Requirements', ats.requirementCoverage],
              ['Evidence', ats.evidenceRelevance],
              ['ATS format', ats.formatHygiene],
            ].map(([label, value]) => <div className="score-box" key={String(label)}><b>{value}</b><span>{label}</span><div className="progress"><span style={{ width: `${value}%` }}/></div></div>)}
          </div>
          {ats.matchedKeywords.length ? <><div className="divider"/><div className="kicker">Matched JD terms</div><div className="tag-list">{ats.matchedKeywords.map((item) => <span className="tag" key={item}>{item}</span>)}</div></> : null}
          {ats.missingKeywords.length ? <><div className="divider"/><div className="kicker">Missing / gap terms</div><div className="tag-list">{ats.missingKeywords.map((item) => <span className="tag" key={item}>{item}</span>)}</div><p className="small muted">These are not automatically inserted. They remain gaps unless the master profile contains truthful evidence for them.</p></> : null}
        </div> : packState.stale ? <div className="notice"><b>ATS score pending.</b> Regenerate the outdated pack first so the score reflects the current resume and JD.</div> : null}

        <JobActions id={id} applyUrl={job.applyUrl || job.url} hasPack={Boolean(pack)} packStale={packState.stale} status={job.application?.status || 'discovered'} canResearch={canResearch}/>
        <JobAnswerAssistant jobId={id} />
        <InterviewPrepCard prep={interviewPrep} />
        <div className="card"><div className="kicker">Requirements extracted</div><h3>Must-have</h3><div className="tag-list">{match?.mustHave?.length ? match.mustHave.map((item) => <span className="tag" key={item}>{item}</span>) : <span className="muted small">Run AI analysis to extract.</span>}</div><div className="divider"/><h3>Preferred</h3><div className="tag-list">{match?.preferred?.length ? match.preferred.map((item) => <span className="tag" key={item}>{item}</span>) : <span className="muted small">No preferred requirements extracted.</span>}</div></div>
        <div className="card"><div className="kicker">Source</div><div className="small"><b>{job.source}</b> · {job.sourceKey}</div><div className="divider"/><a className="btn ghost" target="_blank" rel="noreferrer" href={job.url}>Open original posting ↗</a></div>
      </div>
    </div>
  </>;
}