import { importFileBaseName, isSupportedLinkedInCsvFile } from './linkedin-import-files';

const MAX_ARCHIVE_BYTES = 20 * 1024 * 1024;
const MAX_ENTRY_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_BYTES = 16 * 1024 * 1024;
const MAX_ENTRIES = 250;

function findZipDirectory(view: DataView) {
  const minimum = Math.max(0, view.byteLength - 65_557);
  for (let offset = view.byteLength - 22; offset >= minimum; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  return -1;
}

async function decompress(method: number, compressed: Uint8Array) {
  if (method === 0) return compressed;
  if (method !== 8) return undefined;
  const input = Uint8Array.from(compressed).buffer;
  const stream = new Blob([input]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function profileCsvFilesFromZip(file: File) {
  if (file.size > MAX_ARCHIVE_BYTES) throw new Error('The LinkedIn archive is larger than 20 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const endOffset = findZipDirectory(view);
  if (endOffset < 0) throw new Error('The LinkedIn ZIP archive is not valid.');
  const entries = view.getUint16(endOffset + 10, true);
  let centralOffset = view.getUint32(endOffset + 16, true);
  if (entries > MAX_ENTRIES) throw new Error('The LinkedIn archive contains too many files.');

  const decoder = new TextDecoder();
  const result: File[] = [];
  let total = 0;
  for (let index = 0; index < entries; index += 1) {
    if (centralOffset + 46 > view.byteLength || view.getUint32(centralOffset, true) !== 0x02014b50) throw new Error('The LinkedIn ZIP directory is invalid.');
    const method = view.getUint16(centralOffset + 10, true);
    const compressedSize = view.getUint32(centralOffset + 20, true);
    const uncompressedSize = view.getUint32(centralOffset + 24, true);
    const nameLength = view.getUint16(centralOffset + 28, true);
    const extraLength = view.getUint16(centralOffset + 30, true);
    const commentLength = view.getUint16(centralOffset + 32, true);
    const localOffset = view.getUint32(centralOffset + 42, true);
    const name = decoder.decode(bytes.subarray(centralOffset + 46, centralOffset + 46 + nameLength));
    centralOffset += 46 + nameLength + extraLength + commentLength;
    if (!isSupportedLinkedInCsvFile(name)) continue;
    if (uncompressedSize > MAX_ENTRY_BYTES || total + uncompressedSize > MAX_TOTAL_BYTES) throw new Error('The LinkedIn profile files exceed the safe import limit.');
    if (localOffset + 30 > view.byteLength || view.getUint32(localOffset, true) !== 0x04034b50) throw new Error('A LinkedIn ZIP entry is invalid.');
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.subarray(dataOffset, dataOffset + compressedSize);
    if (compressed.byteLength !== compressedSize) throw new Error('A LinkedIn ZIP entry is incomplete.');
    const content = await decompress(method, compressed);
    if (!content) continue;
    if (content.byteLength !== uncompressedSize || content.byteLength > MAX_ENTRY_BYTES) throw new Error('A LinkedIn ZIP entry has an invalid size.');
    total += content.byteLength;
    result.push(new File([Uint8Array.from(content).buffer], importFileBaseName(name), { type: 'text/csv' }));
  }
  return result;
}

export async function linkedinProfileFilesForUpload(files: File[]) {
  const profileFiles: File[] = [];
  for (const file of files) {
    if (file.name.toLowerCase().endsWith('.zip')) profileFiles.push(...await profileCsvFilesFromZip(file));
    else if (isSupportedLinkedInCsvFile(file.name)) profileFiles.push(file);
  }
  if (!profileFiles.length) throw new Error('No supported LinkedIn profile CSV files were found.');
  return profileFiles;
}
