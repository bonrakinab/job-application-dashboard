import assert from 'node:assert/strict';
import test from 'node:test';
import { deflateRawSync } from 'node:zlib';
import { linkedinProfileFilesForUpload } from './linkedin-browser-files';
import { mergeLinkedInProfile, parseLinkedInArchiveFiles } from './linkedin-import';
import type { CandidateProfile } from './types';

function crc32(value: Buffer) {
  let crc = 0xffffffff;
  for (const byte of value) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function testZip(files: Record<string, string>, method: 0 | 8 = 0) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;
  for (const [name, content] of Object.entries(files)) {
    const filename = Buffer.from(name);
    const body = Buffer.from(content);
    const payload = method === 8 ? deflateRawSync(body) : body;
    const checksum = crc32(body);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(body.length, 22);
    local.writeUInt16LE(filename.length, 26);
    localParts.push(local, filename, payload);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(body.length, 24);
    central.writeUInt16LE(filename.length, 28);
    central.writeUInt32LE(localOffset, 42);
    centralParts.push(central, filename);
    localOffset += local.length + filename.length + payload.length;
  }

  const localData = Buffer.concat(localParts);
  const centralData = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralData.length, 12);
  end.writeUInt32LE(localData.length, 16);
  return Buffer.concat([localData, centralData, end]);
}

test('LinkedIn ZIP import reads profile-focused CSV files and ignores unrelated archive data', async () => {
  const archive = testZip({
    'Profile.csv': 'First Name,Last Name,Headline,Summary,Industry,Geo Location\nArnob,Banik,"ERP and AI specialist","Enterprise and AI profile",Technology,"Windsor, Ontario"',
    'Skills.csv': 'Name\nPython\nOracle Fusion\nn8n',
    'Positions.csv': 'Company Name,Title,Description,Location,Started On,Finished On\nBanglalink,ERP Specialist,"Supported Oracle Fusion\nAutomated workflows",Dhaka,Sep 2023,Jun 2024',
    'Education.csv': 'School Name,Degree Name,Field Of Study,Start Date,End Date\nUniversity of Windsor,Master of Science,Computer Science,Sep 2024,Aug 2026',
    'Projects.csv': 'Title,Description,Url\nWorkflow Automation,"Built an n8n workflow",https://example.com/workflow',
    'Certifications.csv': 'Name,Authority\nData Science Professional,Oracle',
    'Languages.csv': 'Name,Proficiency\nEnglish,Professional working proficiency',
    'Honors.csv': 'Title,Issuer,Issued On\nDean List,VIT,2022',
    'Messages.csv': 'From,To,Content\nSomeone,Arnob,Private message that must be ignored',
  }, 8);
  const browserFiles = await linkedinProfileFilesForUpload([
    new File([Uint8Array.from(archive).buffer], 'Complete_LinkedInDataExport.zip', { type: 'application/zip' }),
  ]);
  assert.deepEqual(browserFiles.map((file) => file.name).sort(), [
    'Certifications.csv',
    'Education.csv',
    'Honors.csv',
    'Languages.csv',
    'Positions.csv',
    'Profile.csv',
    'Projects.csv',
    'Skills.csv',
  ]);
  const parsed = parseLinkedInArchiveFiles([{ name: 'Complete_LinkedInDataExport.zip', bytes: archive }]);
  assert.equal(parsed.name, 'Arnob Banik');
  assert.equal(parsed.headline, 'ERP and AI specialist');
  assert.deepEqual(parsed.skills, ['Python', 'Oracle Fusion', 'n8n']);
  assert.equal(parsed.experience[0].bullets.length, 2);
  assert.equal(parsed.degrees[0].institution, 'University of Windsor');
  assert.equal(parsed.projects[0].name, 'Workflow Automation');
  assert.equal(parsed.certifications[0], 'Data Science Professional · Oracle');
  assert.equal(parsed.languages[0], 'English · Professional working proficiency');
  assert.equal(parsed.awards[0], 'Dean List · VIT · 2022');
  assert.equal(parsed.sourceFiles.includes('Messages.csv'), false);
});

test('LinkedIn merge is additive and keeps existing resume facts when records overlap', () => {
  const current: CandidateProfile = {
    name: 'Arnob Banik',
    headline: 'Resume headline',
    summary: 'Verified resume summary.',
    targetTitles: ['ERP Analyst'],
    preferredLocations: ['Ontario'],
    skills: ['Python', 'SQL'],
    experience: [{
      organization: 'Banglalink',
      title: 'ERP Specialist',
      start: 'Sep 2023',
      end: 'Jun 2024',
      bullets: ['Verified résumé achievement.'],
      skills: ['Oracle Fusion'],
    }],
    links: { linkedin: 'https://www.linkedin.com/in/arnob-banik-377417232/' },
  };
  const imported = parseLinkedInArchiveFiles([
    { name: 'Skills.csv', bytes: Buffer.from('Name\npython\nn8n') },
    { name: 'Positions.csv', bytes: Buffer.from('Company Name,Title,Description,Started On,Finished On\nBanglalink,ERP Specialist,LinkedIn responsibility,Oct 2023,May 2024') },
    { name: 'Publications.csv', bytes: Buffer.from('Name,Publisher,Published On\nAI Retrieval,University,2026') },
  ]);
  imported.headline = 'LinkedIn headline';
  imported.summary = 'LinkedIn about section.';
  const merged = mergeLinkedInProfile(current, imported, '2026-08-26T03:03:49.000Z');

  assert.equal(merged.profile.headline, 'Resume headline');
  assert.equal(merged.profile.summary, 'Verified resume summary.');
  assert.deepEqual(merged.profile.skills, ['Python', 'SQL', 'n8n']);
  assert.equal(merged.profile.experience?.length, 1);
  assert.equal(merged.profile.experience?.[0].start, 'Sep 2023');
  assert.deepEqual(merged.profile.experience?.[0].bullets, ['Verified résumé achievement.', 'LinkedIn responsibility']);
  assert.equal(merged.profile.profileSources?.linkedin?.headline, 'LinkedIn headline');
  assert.equal(merged.profile.profileSources?.linkedin?.summary, 'LinkedIn about section.');
  assert.equal(merged.summary.added.skills, 1);
  assert.equal(merged.summary.added.experience, 0);
  assert.equal(merged.summary.added.publications, 1);
});
