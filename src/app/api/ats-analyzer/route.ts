import { analyzeJobWithAI, extractPartTimeResumeProfile } from '@/lib/ai';
import { analyzeUploadedResume } from '@/lib/ats-analyzer';
import { extractDocumentFileText, inspectResumeFile } from '@/lib/resume-file-text';
import { partTimeProfileFromResumeExtraction } from '@/lib/resume-profile-import';
import { DEFAULT_ATS_LLM_MODEL, isAtsLlmModelId } from '@/lib/ats-models';
import type { Job } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

const SECTION_HEADINGS = /^(about (?:the )?(?:job|role|company)|overview|job description|responsibilities|requirements|qualifications|what you(?:'|’)ll do|who you are|benefits)$/i;

function value(form: FormData, key: string) {
  const item = form.get(key);
  return typeof item === 'string' ? item.trim() : '';
}

function inferredTitle(description: string) {
  const explicit = description.match(/(?:job title|position|role)\s*:\s*([^\n]{3,100})/i)?.[1]?.trim();
  if (explicit) return explicit;
  return description.split(/\r?\n/)
    .map((line) => line.replace(/^[-*•#\s]+/, '').trim())
    .find((line) => line.length >= 3 && line.length <= 90 && !SECTION_HEADINGS.test(line) && !/https?:\/\/|@/.test(line))
    ?? 'Target role';
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const resume = form.get('resume');
    if (!(resume instanceof File)) {
      return Response.json({ error: 'Choose a résumé file first.' }, { status: 400 });
    }

    const requestedModel = value(form, 'model');
    if (requestedModel && !isAtsLlmModelId(requestedModel)) {
      return Response.json({ error: 'Choose a supported ATS analysis model.' }, { status: 400 });
    }
    const selectedModel = isAtsLlmModelId(requestedModel) ? requestedModel : DEFAULT_ATS_LLM_MODEL;

    const jobDescriptionFile = form.get('jobDescriptionFile');
    const typedDescription = value(form, 'jobDescription');
    const jobDescriptionPromise = jobDescriptionFile instanceof File && jobDescriptionFile.size
      ? extractDocumentFileText(jobDescriptionFile, 'job description')
      : Promise.resolve(typedDescription);
    const [jobDescription, inspection] = await Promise.all([
      jobDescriptionPromise,
      inspectResumeFile(resume),
    ]);
    if (jobDescription.trim().length < 80) {
      return Response.json({ error: 'Upload or paste a complete job description (at least 80 characters).' }, { status: 400 });
    }

    const { extraction, model } = await extractPartTimeResumeProfile(inspection.text, resume.name, selectedModel);
    const title = value(form, 'jobTitle') || inferredTitle(jobDescription);
    const company = value(form, 'company') || 'Target employer';
    const suppliedLocation = value(form, 'location');
    const location = suppliedLocation || 'Anywhere';
    const imported = partTimeProfileFromResumeExtraction(extraction);
    const profile = {
      ...imported,
      profilePurpose: undefined,
      location: extraction.location.trim() || undefined,
      headline: extraction.headline.trim() || undefined,
      summary: extraction.summary.trim() || undefined,
      targetTitles: [title],
      preferredLocations: [location],
    };
    if (!profile.name.trim()) throw new Error('A candidate name could not be identified in the résumé.');
    if (!(profile.experience?.length || profile.skills.length || profile.degrees?.length)) {
      throw new Error('The résumé did not contain enough usable evidence for an ATS analysis.');
    }

    const job: Job = {
      externalId: 'ats-analyzer-upload',
      source: 'ats-analyzer',
      sourceKey: 'ats-analyzer-upload',
      url: '',
      title,
      company,
      location,
      description: jobDescription.slice(0, 60000),
      remote: !suppliedLocation,
    };
    const match = await analyzeJobWithAI(job, profile, selectedModel);
    const result = analyzeUploadedResume({
      job,
      profile,
      match,
      inspection,
      resumeFileName: resume.name,
      profileExtractionModel: model,
      selectedModel,
    });

    return Response.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
