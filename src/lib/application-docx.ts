import JSZip from 'jszip';
import type { ApplicationPack, CandidateProfile, Job } from './types';
import { formatResumeDateRange, resumeTemplateContactItems } from './resume-content';
import { normalizeText } from './utils';

function xml(value: string) {
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function run(text: string, options: { bold?: boolean; italic?: boolean; size?: number } = {}) {
  const properties = [
    '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/>',
    options.bold ? '<w:b/>' : '',
    options.italic ? '<w:i/>' : '',
    options.size ? `<w:sz w:val="${options.size}"/><w:szCs w:val="${options.size}"/>` : '',
  ].join('');
  return `<w:r><w:rPr>${properties}</w:rPr><w:t xml:space="preserve">${xml(text)}</w:t></w:r>`;
}

function tabRun() { return '<w:r><w:tab/></w:r>'; }

function paragraph(
  content: string | string[],
  options: { style?: string; align?: 'center' | 'left'; keepNext?: boolean; before?: number; after?: number; left?: number; hanging?: number; rightTab?: number } = {},
) {
  const properties = [
    options.style ? `<w:pStyle w:val="${options.style}"/>` : '',
    options.align ? `<w:jc w:val="${options.align}"/>` : '',
    options.keepNext ? '<w:keepNext/>' : '',
    options.before != null || options.after != null ? `<w:spacing w:before="${options.before ?? 0}" w:after="${options.after ?? 0}"/>` : '',
    options.left != null || options.hanging != null ? `<w:ind w:left="${options.left ?? 0}"${options.hanging != null ? ` w:hanging="${options.hanging}"` : ''}/>` : '',
    options.rightTab ? `<w:tabs><w:tab w:val="right" w:pos="${options.rightTab}"/></w:tabs>` : '',
  ].join('');
  const body = Array.isArray(content) ? content.join('') : run(content);
  return `<w:p>${properties ? `<w:pPr>${properties}</w:pPr>` : ''}${body}</w:p>`;
}

function section(label: string) {
  return paragraph(label, { style: 'SectionHeading', keepNext: true, before: 34, after: 12 });
}

function subBullet(text: string) {
  return paragraph([run('◦ '), run(text)], { style: 'SubBullet', after: 3 });
}

function sourceExperience(profile: CandidateProfile, organization: string, title: string) {
  return (profile.experience ?? []).find((item) => normalizeText(item.organization) === normalizeText(organization)
    && normalizeText(item.title) === normalizeText(title));
}

function pairedLine(left: string | string[], right: string, options: { style?: string; keepNext?: boolean; italicLeft?: boolean } = {}) {
  const leftRuns = Array.isArray(left) ? left : [run(left, { italic: options.italicLeft })];
  return paragraph([
    ...leftRuns,
    ...(right ? [tabRun(), run(right, { italic: options.italicLeft })] : []),
  ], { style: options.style, keepNext: options.keepNext, after: 0, rightTab: 11200 });
}

function skillsParagraphs(profile: CandidateProfile, pack: ApplicationPack) {
  const selected = new Set(pack.skills.map(normalizeText));
  const rendered = new Set<string>();
  const paragraphs: string[] = [];
  for (const group of profile.skillGroups ?? []) {
    const skills = group.skills.filter((skill) => selected.has(normalizeText(skill)) && !rendered.has(normalizeText(skill)));
    if (!skills.length) continue;
    skills.forEach((skill) => rendered.add(normalizeText(skill)));
    paragraphs.push(paragraph([run('• '), run(`${group.label}: `, { bold: true }), run(skills.join(', '))], { after: 3 }));
  }
  const extras = pack.skills.filter((skill) => !rendered.has(normalizeText(skill)));
  if (extras.length) paragraphs.push(paragraph([run('• '), run('Role-Aligned: ', { bold: true }), run(extras.join(', '))], { after: 3 }));
  return paragraphs;
}

function documentBody(profile: CandidateProfile, pack: ApplicationPack) {
  const body: string[] = [paragraph(profile.name, { style: 'Name', align: 'center', after: 18 })];
  if (pack.resumeHeadline.trim()) body.push(paragraph(pack.resumeHeadline, { style: 'Headline', align: 'center', after: 8 }));
  const contact = resumeTemplateContactItems(profile);
  if (contact.length) body.push(paragraph(contact.join('   '), { style: 'Contact', align: 'center', after: 18 }));

  body.push(section('Professional Summary'), paragraph(pack.resumeSummary, { after: 10 }));
  body.push(section('Experience'));
  for (const item of pack.experience.slice(0, 3)) {
    const source = sourceExperience(profile, item.organization, item.title);
    body.push(pairedLine([run('• '), run(item.organization, { bold: true })], source?.location ?? '', { keepNext: true }));
    body.push(pairedLine(item.title, formatResumeDateRange(source?.start, source?.end), { style: 'RoleLine', keepNext: true, italicLeft: true }));
    item.bullets.forEach((itemBullet) => body.push(subBullet(itemBullet)));
  }

  body.push(section('Skills'), ...skillsParagraphs(profile, pack));
  if (pack.projects.length) {
    body.push(section('Projects'));
    for (const project of pack.projects) {
      body.push(paragraph([run('• '), run(project.name, { bold: true })], { keepNext: true, after: 1 }));
      project.bullets.slice(0, 1).forEach((projectBullet) => body.push(subBullet(projectBullet)));
    }
  }

  body.push(section('Education'));
  for (const degree of profile.degrees ?? []) {
    body.push(pairedLine([run('• '), run(degree.institution, { bold: true })], degree.location ?? '', { keepNext: true }));
    const degreeText = [degree.degree, degree.field].filter(Boolean).join(' - ') + (degree.gpa ? `; GPA: ${degree.gpa}` : '');
    body.push(pairedLine(degreeText, formatResumeDateRange(degree.start, degree.end), { style: 'RoleLine', keepNext: true, italicLeft: true }));
  }

  if (pack.certifications?.length) {
    body.push(section('Certifications'));
    pack.certifications.forEach((certification) => body.push(paragraph([run('• '), run(certification)], { after: 1 })));
  }
  return body.join('');
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

const DOCUMENT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="19"/><w:szCs w:val="19"/><w:lang w:val="en-CA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="205" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
  <w:style w:type="paragraph" w:styleId="Name"><w:name w:val="Name"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:sz w:val="49"/><w:szCs w:val="49"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Headline"><w:name w:val="Headline"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Contact"><w:name w:val="Contact"/><w:basedOn w:val="Normal"/><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="SectionHeading"><w:name w:val="Section Heading"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="000000"/></w:pBdr></w:pPr><w:rPr><w:smallCaps/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="RoleLine"><w:name w:val="Role Line"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="220"/></w:pPr><w:rPr><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="SubBullet"><w:name w:val="Sub Bullet"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="500" w:hanging="180"/><w:spacing w:after="3"/></w:pPr><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:style>
</w:styles>`;

export async function resumeDocx(profile: CandidateProfile, _job: Job, pack: ApplicationPack): Promise<Buffer> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES);
  zip.folder('_rels')!.file('.rels', ROOT_RELS);
  zip.folder('word')!.file('styles.xml', STYLES);
  zip.folder('word')!.folder('_rels')!.file('document.xml.rels', DOCUMENT_RELS);
  zip.folder('word')!.file('document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${documentBody(profile, pack)}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="680" w:right="677" w:bottom="300" w:left="677" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`);
  const timestamp = new Date().toISOString();
  zip.folder('docProps')!.file('core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(profile.name)} Resume</dc:title><dc:creator>${xml(profile.name)}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:modified></cp:coreProperties>`);
  zip.folder('docProps')!.file('app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Job Application Dashboard</Application></Properties>`);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}
