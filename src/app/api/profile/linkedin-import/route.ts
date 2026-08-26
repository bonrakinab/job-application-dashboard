import { parseLinkedInArchiveFiles, mergeLinkedInProfile } from '@/lib/linkedin-import';
import { getCandidateProfile, logActivity, saveCandidateProfile } from '@/lib/store';

export const runtime = 'nodejs';

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_BYTES + 512_000) {
      return Response.json({ error: 'The LinkedIn import must be 20 MB or smaller.' }, { status: 413 });
    }
    const form = await request.formData();
    const files = form.getAll('files').filter((entry): entry is File => typeof entry !== 'string' && Boolean(entry.name));
    if (!files.length) return Response.json({ error: 'Choose a LinkedIn ZIP archive or LinkedIn CSV files.' }, { status: 400 });
    if (files.length > 20) return Response.json({ error: 'Select no more than 20 files at once.' }, { status: 400 });
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > MAX_UPLOAD_BYTES) return Response.json({ error: 'The LinkedIn import must be 20 MB or smaller.' }, { status: 413 });

    const [current, importFiles] = await Promise.all([
      getCandidateProfile(),
      Promise.all(files.map(async (file) => ({
        name: file.name,
        bytes: new Uint8Array(await file.arrayBuffer()),
      }))),
    ]);
    const linkedin = parseLinkedInArchiveFiles(importFiles);
    const merged = mergeLinkedInProfile(current, linkedin);
    await saveCandidateProfile(merged.profile);
    await logActivity('profile.linkedin.imported', undefined, {
      sourceFiles: merged.summary.sourceFiles,
      added: merged.summary.added,
      importedAt: merged.summary.importedAt,
    });
    return Response.json({ ok: true, profile: merged.profile, import: merged.summary });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : 'Could not import the LinkedIn archive.',
    }, { status: 400 });
  }
}
