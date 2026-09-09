import JSZip from 'jszip';
import type { ApplicationPack, CandidateProfile, Job } from './types';
import { formatAtsDateRange, resumeContactLines, selectedProjectSkills } from './resume-content';
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
    options.bold ? '<w:b/>' : '',
    options.italic ? '<w:i/>' : '',
    options.size ? `<w:sz w:val="${options.size}"/><w:szCs w:val="${options.size}"/>` : '',
  ].join('');
  return `<w:r>${properties ? `<w:rPr>${properties}</w:rPr>` : ''}<w:t xml:space="preserve">${xml(text)}</w:t></w:r>`;
}

function tab() {
  return '<w:r><w:tab/></w:r>';
}

type ParagraphOptions = {
  style?: string;
  align?: 'center' | 'left';
  keepNext?: boolean;
  before?: number;
  after?: number;
  rightTab?: boolean;
};

function paragraph(content: string | string[], options: ParagraphOptions = {}) {
  const properties = [
    options.style ? `<w:pStyle w:val="${options.style}"/>` : '',
    options.align ? `<w:jc w:val="${options.align}"/>` : '',
    options.keepNext ? '<w:keepNext/>' : '',
    options.rightTab ? '<w:tabs><w:tab w:val="right" w:pos="11200"/></w:tabs>' : '',
    options.before != null || options.after != null
      ? `<w:spacing w:before="${options.before ?? 0}" w:after="${options.after ?? 0}"/>`
      : '',
  ].join('');
  const body = Array.isArray(content) ? content.join('') : run(content);
  return `<w:p>${properties ? `<w:pPr>${properties}</w:pPr>` : ''}${body}</w:p>`;
}

function paired(left: string | string[], right: string, options: ParagraphOptions = {}) {
  const leftRuns = Array.isArray(left) ? left : [run(left)];
  return paragraph([...leftRuns, ...(right ? [tab(), run(right)] : [])], { ...options, rightTab: Boolean(right) });
}

function section(label: string) {
  return paragraph(label.toUpperCase(), { style: 'SectionHeading', keepNext: true, before: 36, after: 18 });
}

function bullet(text: string) {
  return paragraph(`◦ ${text}`, { style: 'Bullet', after: 4 });
}

function sourceExperience(profile: CandidateProfile, organization: string, title: string) {
  return (profile.experience ?? []).find((item) => normalizeText(item.organization) === normalizeText(organization)
    && normalizeText(item.title) === normalizeText(title));
}

function skillsParagraphs(profile: CandidateProfile, pack: ApplicationPack) {
  const selected = new Set(pack.skills.map(normalizeText));
  const rendered = new Set<string>();
  const paragraphs: string[] = [];

  for (const group of profile.skillGroups ?? []) {
    const skills = group.skills.filter((skill) => selected.has(normalizeText(skill)));
    if (!skills.length) continue;
    skills.forEach((skill) => rendered.add(normalizeText(skill)));
    paragraphs.push(paragraph([
      run('• '),
      run(`${group.label}: `, { bold: true }),
      run(skills.join(', ')),
    ], { after: 4 }));
  }

  const extras = pack.skills.filter((skill) => !rendered.has(normalizeText(skill)));
  if (extras.length) {
    paragraphs.push(paragraph([
      run('• '),
      run(paragraphs.length ? 'Additional: ' : 'Skills: ', { bold: true }),
      run(extras.join(', ')),
    ], { after: 4 }));
  }
  return paragraphs;
}

function documentBody(profile: CandidateProfile, pack: ApplicationPack) {
  const contact = resumeContactLines(profile);
  const contactText = [...contact.primary, ...contact.links].join(' | ');
  const body: string[] = [paragraph(profile.name, { style: 'Name', align: 'center', after: 18 })];

  if (pack.resumeHeadline?.trim()) body.push(paragraph(pack.resumeHeadline, { style: 'Headline', align: 'center', after: 12 }));
  if (contactText) body.push(paragraph(contactText, { style: 'Contact', align: 'center', after: 18 }));

  body.push(section('Professional Summary'));
  body.push(paragraph(pack.resumeSummary, { after: 14 }));

  body.push(section('Experience'));
  for (const item of pack.experience) {
    const source = sourceExperience(profile, item.organization, item.title);
    body.push(paired([run('• '), run(item.organization, { bold: true })], source?.location ?? '', {
      style: 'Organization', keepNext: true, after: 0,
    }));
    body.push(paired([run(item.title, { italic: true })], formatAtsDateRange(source?.start, source?.end), {
      style: 'RoleLine', keepNext: true, after: 4,
    }));
    item.bullets.forEach((itemBullet) => body.push(bullet(itemBullet)));
  }

  body.push(section('Skills'), ...skillsParagraphs(profile, pack));

  if (pack.projects.length) {
    body.push(section('Projects'));
    for (const project of pack.projects) {
      body.push(paragraph([run('• '), run(project.name, { bold: true })], { keepNext: true, after: 2 }));
      const technologies = selectedProjectSkills(profile, pack, project.name);
      if (technologies.length) {
        body.push(paragraph([run('Technologies: ', { italic: true }), run(technologies.join(', '), { italic: true })], { after: 2 }));
      }
      project.bullets.forEach((projectBullet) => body.push(bullet(projectBullet)));
    }
  }

  body.push(section('Education'));
  for (const degree of profile.degrees ?? []) {
    body.push(paired([run('• '), run(degree.institution, { bold: true })], degree.location ?? '', {
      style: 'Organization', keepNext: true, after: 0,
    }));
    const degreeText = [degree.degree, degree.field].filter(Boolean).join(' - ') + (degree.gpa ? `; GPA: ${degree.gpa}` : '');
    body.push(paired([run(degreeText, { italic: true })], formatAtsDateRange(degree.start, degree.end), {
      style: 'RoleLine', keepNext: true, after: 3,
    }));
    if (degree.coursework?.length) {
      body.push(paragraph([run('Relevant Coursework: ', { italic: true }), run(degree.coursework.slice(0, 2).join(', '), { italic: true })], { after: 4 }));
    }
  }

  if (pack.certifications?.length) {
    body.push(section('Certifications'));
    pack.certifications.forEach((certification) => body.push(paragraph(`• ${certification}`, { after: 2 })));
  }

  if (pack.publications?.length) {
    body.push(section('Publications'));
    pack.publications.forEach((publication) => body.push(paragraph(`• ${publication}`, { after: 2 })));
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
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="17"/><w:szCs w:val="17"/><w:lang w:val="en-CA"/></w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="190" w:lineRule="auto"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
  <w:style w:type="paragraph" w:styleId="Name"><w:name w:val="Name"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="46"/><w:szCs w:val="46"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Headline"><w:name w:val="Headline"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Contact"><w:name w:val="Contact"/><w:basedOn w:val="Normal"/><w:rPr><w:sz w:val="15"/><w:szCs w:val="15"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="SectionHeading"><w:name w:val="Section Heading"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="36" w:after="18"/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="000000"/></w:pBdr></w:pPr><w:rPr><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Organization"><w:name w:val="Organization"/><w:basedOn w:val="Normal"/><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="RoleLine"><w:name w:val="Role Line"/><w:basedOn w:val="Normal"/><w:rPr><w:sz w:val="17"/><w:szCs w:val="17"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Bullet"><w:name w:val="Bullet"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="360" w:hanging="150"/><w:spacing w:after="4"/></w:pPr><w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:style>
</w:styles>`;

export async function resumeDocx(profile: CandidateProfile, _job: Job, pack: ApplicationPack): Promise<Buffer> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES);
  zip.folder('_rels')!.file('.rels', ROOT_RELS);
  zip.folder('word')!.file('styles.xml', STYLES);
  zip.folder('word')!.folder('_rels')!.file('document.xml.rels', DOCUMENT_RELS);
  zip.folder('word')!.file('document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${documentBody(profile, pack)}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="300" w:right="320" w:bottom="260" w:left="320" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`);

  const timestamp = new Date().toISOString();
  zip.folder('docProps')!.file('core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(profile.name)} Resume</dc:title><dc:creator>${xml(profile.name)}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:modified></cp:coreProperties>`);
  zip.folder('docProps')!.file('app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Job Application Dashboard</Application></Properties>`);

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}
