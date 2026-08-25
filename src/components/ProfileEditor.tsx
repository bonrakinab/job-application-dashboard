'use client';

import { useState } from 'react';
import type { CandidateProfile, EducationItem, ExperienceItem, ProjectItem } from '@/lib/types';

function cleanList(values?: string[]) {
  return [...new Set((values ?? []).map((item) => item.trim()).filter(Boolean))];
}

function linksToText(links?: Record<string, string>) {
  return Object.entries(links ?? {}).map(([label, url]) => `${label}=${url}`).join('\n');
}

function linksFromText(value: string) {
  return Object.fromEntries(value.split('\n').map((line) => {
    const separator = line.indexOf('=');
    return separator > 0 ? [line.slice(0, separator).trim(), line.slice(separator + 1).trim()] : ['', ''];
  }).filter(([label, url]) => label && url));
}

const emptyExperience = (): ExperienceItem => ({ organization: '', title: '', bullets: [] });
const emptyEducation = (): EducationItem => ({ institution: '', degree: '' });
const emptyProject = (): ProjectItem => ({ name: '', description: '', bullets: [] });

export function ProfileEditor({ initial }: { initial: CandidateProfile }) {
  const [profile, setProfile] = useState<CandidateProfile>({
    ...initial,
    targetTitles: initial.targetTitles ?? [],
    preferredLocations: initial.preferredLocations ?? [],
    skills: initial.skills ?? [],
    experience: initial.experience ?? [],
    degrees: initial.degrees ?? [],
    projects: initial.projects ?? [],
    certifications: initial.certifications ?? [],
    workAuthorization: initial.workAuthorization ?? [],
    excludedKeywords: initial.excludedKeywords ?? [],
  });
  const [linksText, setLinksText] = useState(linksToText(initial.links));
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  function updateExperience(index: number, patch: Partial<ExperienceItem>) {
    setProfile((current) => ({
      ...current,
      experience: (current.experience ?? []).map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
    }));
  }

  function updateEducation(index: number, patch: Partial<EducationItem>) {
    setProfile((current) => ({
      ...current,
      degrees: (current.degrees ?? []).map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
    }));
  }

  function updateProject(index: number, patch: Partial<ProjectItem>) {
    setProfile((current) => ({
      ...current,
      projects: (current.projects ?? []).map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
    }));
  }

  async function save() {
    setBusy(true);
    setMessage('');
    try {
      const cleanedProfile: CandidateProfile = {
        ...profile,
        targetTitles: cleanList(profile.targetTitles),
        preferredLocations: cleanList(profile.preferredLocations),
        skills: cleanList(profile.skills),
        experience: (profile.experience ?? []).map((item) => ({ ...item, bullets: cleanList(item.bullets), skills: cleanList(item.skills) })),
        degrees: (profile.degrees ?? []).map((item) => ({ ...item, coursework: cleanList(item.coursework) })),
        projects: (profile.projects ?? []).map((item) => ({ ...item, bullets: cleanList(item.bullets), skills: cleanList(item.skills) })),
        certifications: cleanList(profile.certifications),
        workAuthorization: cleanList(profile.workAuthorization),
        excludedKeywords: cleanList(profile.excludedKeywords),
        links: linksFromText(linksText),
      };
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanedProfile),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Could not save profile.');
      setProfile(cleanedProfile);
      setLinksText(linksToText(cleanedProfile.links));
      setMessage('Profile saved. New application documents will use these details.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return <div className="profile-editor">
    <section className="card profile-section">
      <div className="profile-section-head"><h2>Basic information</h2></div>
      <div className="form-grid">
        <label className="field-label">Full name<input className="input" value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></label>
        <label className="field-label">Professional headline<input className="input" value={profile.headline ?? ''} onChange={(event) => setProfile({ ...profile, headline: event.target.value })} placeholder="Software developer · AI and cloud" /></label>
        <label className="field-label">Email<input className="input" type="email" value={profile.email ?? ''} onChange={(event) => setProfile({ ...profile, email: event.target.value })} /></label>
        <label className="field-label">Phone<input className="input" value={profile.phone ?? ''} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} /></label>
        <label className="field-label wide">Location<input className="input" value={profile.location ?? ''} onChange={(event) => setProfile({ ...profile, location: event.target.value })} placeholder="Windsor, Ontario, Canada" /></label>
        <label className="field-label wide">Professional summary<textarea className="input" rows={4} value={profile.summary ?? ''} onChange={(event) => setProfile({ ...profile, summary: event.target.value })} /></label>
      </div>
    </section>

    <section className="card profile-section">
      <div className="profile-section-head"><h2>Job preferences and skills</h2></div>
      <div className="form-grid">
        <label className="field-label wide">Target job titles<textarea className="input" rows={4} value={profile.targetTitles.join('\n')} onChange={(event) => setProfile({ ...profile, targetTitles: event.target.value.split('\n') })} placeholder={'Software Developer\nData Analyst\nERP Analyst'} /></label>
        <label className="field-label wide">Skills<textarea className="input" rows={5} value={profile.skills.join('\n')} onChange={(event) => setProfile({ ...profile, skills: event.target.value.split('\n') })} placeholder={'Python\nSQL\nReact\nOracle Fusion\nAWS'} /></label>
        <label className="field-label">Years of experience<input className="input" type="number" min={0} step={0.5} value={profile.yearsExperience ?? ''} onChange={(event) => setProfile({ ...profile, yearsExperience: event.target.value ? Number(event.target.value) : undefined })} /></label>
        <label className="field-label">Preferred locations<textarea className="input" rows={3} value={profile.preferredLocations.join('\n')} onChange={(event) => setProfile({ ...profile, preferredLocations: event.target.value.split('\n') })} placeholder={'Ontario\nToronto\nRemote Canada'} /></label>
      </div>
    </section>

    <section className="card profile-section">
      <div className="profile-section-head"><h2>Work experience</h2><button className="btn ghost" type="button" onClick={() => setProfile({ ...profile, experience: [...(profile.experience ?? []), emptyExperience()] })}>Add experience</button></div>
      <div className="repeat-list">
        {(profile.experience ?? []).map((item, index) => <div className="repeat-item" key={`experience-${index}`}>
          <div className="profile-section-head"><h3>Experience {index + 1}</h3><button className="btn danger" type="button" onClick={() => setProfile({ ...profile, experience: (profile.experience ?? []).filter((_, itemIndex) => itemIndex !== index) })}>Remove</button></div>
          <div className="form-grid">
            <label className="field-label">Job title<input className="input" value={item.title} onChange={(event) => updateExperience(index, { title: event.target.value })} /></label>
            <label className="field-label">Company<input className="input" value={item.organization} onChange={(event) => updateExperience(index, { organization: event.target.value })} /></label>
            <label className="field-label">Start date<input className="input" value={item.start ?? ''} onChange={(event) => updateExperience(index, { start: event.target.value })} placeholder="Sep 2023" /></label>
            <label className="field-label">End date<input className="input" value={item.end ?? ''} onChange={(event) => updateExperience(index, { end: event.target.value })} placeholder="Jun 2024 or Present" /></label>
            <label className="field-label wide">Location<input className="input" value={item.location ?? ''} onChange={(event) => updateExperience(index, { location: event.target.value })} /></label>
            <label className="field-label wide">Description and achievements<textarea className="input" rows={5} value={item.bullets.join('\n')} onChange={(event) => updateExperience(index, { bullets: event.target.value.split('\n') })} placeholder="One responsibility or achievement per line" /></label>
            <label className="field-label wide">Skills used<textarea className="input" rows={3} value={(item.skills ?? []).join('\n')} onChange={(event) => updateExperience(index, { skills: event.target.value.split('\n') })} placeholder="One skill per line" /></label>
          </div>
        </div>)}
        {!profile.experience?.length ? <div className="small muted">Work experience is optional. Add as many entries as needed.</div> : null}
      </div>
    </section>

    <section className="card profile-section">
      <div className="profile-section-head"><h2>Education</h2><button className="btn ghost" type="button" onClick={() => setProfile({ ...profile, degrees: [...(profile.degrees ?? []), emptyEducation()] })}>Add education</button></div>
      <div className="repeat-list">
        {(profile.degrees ?? []).map((item, index) => <div className="repeat-item" key={`education-${index}`}>
          <div className="profile-section-head"><h3>Education {index + 1}</h3><button className="btn danger" type="button" onClick={() => setProfile({ ...profile, degrees: (profile.degrees ?? []).filter((_, itemIndex) => itemIndex !== index) })}>Remove</button></div>
          <div className="form-grid">
            <label className="field-label">Institution<input className="input" value={item.institution} onChange={(event) => updateEducation(index, { institution: event.target.value })} /></label>
            <label className="field-label">Degree<input className="input" value={item.degree} onChange={(event) => updateEducation(index, { degree: event.target.value })} /></label>
            <label className="field-label">Field of study<input className="input" value={item.field ?? ''} onChange={(event) => updateEducation(index, { field: event.target.value })} /></label>
            <label className="field-label">GPA<input className="input" value={item.gpa ?? ''} onChange={(event) => updateEducation(index, { gpa: event.target.value })} /></label>
            <label className="field-label">Start date<input className="input" value={item.start ?? ''} onChange={(event) => updateEducation(index, { start: event.target.value })} /></label>
            <label className="field-label">End date<input className="input" value={item.end ?? ''} onChange={(event) => updateEducation(index, { end: event.target.value })} /></label>
            <label className="field-label wide">Relevant coursework<textarea className="input" rows={3} value={(item.coursework ?? []).join('\n')} onChange={(event) => updateEducation(index, { coursework: event.target.value.split('\n') })} placeholder="One course per line" /></label>
          </div>
        </div>)}
      </div>
    </section>

    <section className="card profile-section">
      <div className="profile-section-head"><h2>Projects</h2><button className="btn ghost" type="button" onClick={() => setProfile({ ...profile, projects: [...(profile.projects ?? []), emptyProject()] })}>Add project</button></div>
      <div className="repeat-list">
        {(profile.projects ?? []).map((item, index) => <div className="repeat-item" key={`project-${index}`}>
          <div className="profile-section-head"><h3>Project {index + 1}</h3><button className="btn danger" type="button" onClick={() => setProfile({ ...profile, projects: (profile.projects ?? []).filter((_, itemIndex) => itemIndex !== index) })}>Remove</button></div>
          <div className="form-grid">
            <label className="field-label">Project name<input className="input" value={item.name} onChange={(event) => updateProject(index, { name: event.target.value })} /></label>
            <label className="field-label">Project link<input className="input" value={item.url ?? ''} onChange={(event) => updateProject(index, { url: event.target.value })} /></label>
            <label className="field-label wide">Description<textarea className="input" rows={3} value={item.description} onChange={(event) => updateProject(index, { description: event.target.value })} /></label>
            <label className="field-label wide">Key achievements<textarea className="input" rows={4} value={(item.bullets ?? []).join('\n')} onChange={(event) => updateProject(index, { bullets: event.target.value.split('\n') })} placeholder="One achievement per line" /></label>
            <label className="field-label wide">Skills used<textarea className="input" rows={3} value={(item.skills ?? []).join('\n')} onChange={(event) => updateProject(index, { skills: event.target.value.split('\n') })} placeholder="One skill per line" /></label>
          </div>
        </div>)}
      </div>
    </section>

    <details className="advanced-panel">
      <summary>Additional profile details</summary>
      <div className="advanced-panel-body form-grid">
        <label className="field-label wide">Certifications<textarea className="input" rows={3} value={(profile.certifications ?? []).join('\n')} onChange={(event) => setProfile({ ...profile, certifications: event.target.value.split('\n') })} placeholder="One certification per line" /></label>
        <label className="field-label wide">Work authorization<textarea className="input" rows={3} value={(profile.workAuthorization ?? []).join('\n')} onChange={(event) => setProfile({ ...profile, workAuthorization: event.target.value.split('\n') })} placeholder="One statement per line" /></label>
        <label className="field-label wide">Links<textarea className="input" rows={3} value={linksText} onChange={(event) => setLinksText(event.target.value)} placeholder={'LinkedIn=https://linkedin.com/in/...\nGitHub=https://github.com/...'} /></label>
        <label className="field-label wide">Exclude jobs containing<textarea className="input" rows={3} value={(profile.excludedKeywords ?? []).join('\n')} onChange={(event) => setProfile({ ...profile, excludedKeywords: event.target.value.split('\n') })} placeholder="One keyword per line" /></label>
      </div>
    </details>

    <div className="profile-savebar">
      <span className="small muted">{message || 'Changes affect future résumé and cover-letter generation.'}</span>
      <button className="btn primary" type="button" onClick={save} disabled={busy || !profile.name.trim() || !cleanList(profile.targetTitles).length || !cleanList(profile.skills).length}>{busy ? 'Saving…' : 'Save profile'}</button>
    </div>
  </div>;
}
