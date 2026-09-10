import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type EmbeddedResumeFont = {
  baseFont: string;
  data: Buffer;
  widths: number[];
  ascent: number;
  descent: number;
  capHeight: number;
  bbox: [number, number, number, number];
  flags: number;
  italicAngle: number;
  stemV: number;
};

/**
 * The user's reference resume is a LaTeX/pdfTeX document set in Computer
 * Modern (CMR/CMBX/CMTI). CMU Serif is the Unicode TrueType distribution of
 * that family, so the server embeds it directly in every generated PDF rather
 * than substituting DejaVu Serif or Times.
 *
 * Read the fonts as filesystem assets instead of resolving them as modules.
 * Turbopack otherwise attempts to bundle .ttf files and fails with an unknown
 * module type error. next.config.ts explicitly traces this font directory into
 * the deployed server function.
 */
const fontDirectory = join(process.cwd(), 'node_modules', 'computer-modern', 'fonts');

function fontData(fileName: string) {
  return readFileSync(join(fontDirectory, fileName));
}

const regularWidths = [333,278,500,833,500,833,777,278,388,388,500,778,277,333,278,500,500,500,500,500,500,500,500,500,500,500,277,278,778,778,778,472,777,750,708,722,763,680,652,784,750,361,513,777,625,916,750,777,680,777,736,555,722,750,750,1027,750,750,611,278,500,278,611,778,500,500,555,444,555,444,305,500,555,277,305,527,277,833,555,500,555,527,391,394,388,555,527,722,527,527,444,500,278,500,611];
const boldWidths = [383,350,575,958,575,958,894,319,447,447,575,894,319,383,319,575,575,575,575,575,575,575,575,575,575,575,319,319,894,894,894,543,894,869,818,830,881,755,723,904,900,436,594,901,691,1091,900,863,786,863,862,638,800,884,869,1188,869,869,702,319,575,319,703,894,575,559,638,511,638,527,351,575,638,319,351,606,319,958,638,575,638,606,473,453,447,638,606,830,606,606,511,575,319,575,703];
const italicWidths = [358,307,511,818,511,817,766,307,408,408,511,766,306,358,307,511,511,511,511,511,511,511,511,511,511,511,306,307,766,766,766,511,766,743,703,715,755,678,652,773,743,385,525,768,627,896,743,766,678,766,729,562,715,743,743,998,743,743,613,307,511,307,613,766,511,511,460,460,511,460,306,460,511,306,306,460,255,817,562,511,511,460,421,408,332,536,460,664,463,485,408,511,307,511,613];
const boldItalicWidths = [414,386,591,944,591,944,885,355,473,473,591,885,355,414,355,591,591,591,591,591,591,591,591,591,591,591,355,355,885,885,885,591,885,865,816,826,875,756,727,895,896,472,610,895,698,1073,896,855,787,855,859,650,796,881,865,1160,865,865,709,356,591,356,709,885,591,591,532,532,591,532,400,532,591,355,355,532,297,944,650,591,591,532,502,487,385,620,532,768,560,562,490,591,355,591,709];

export const EMBEDDED_RESUME_FONTS: Record<'regular' | 'bold' | 'italic' | 'boldItalic', EmbeddedResumeFont> = {
  regular: {
    baseFont: 'CMUSerif-Roman',
    data: fontData('cmu-serif-500-roman.ttf'),
    widths: regularWidths,
    ascent: 935,
    descent: -250,
    capHeight: 678,
    bbox: [-1135, -387, 1495, 1094],
    flags: 34,
    italicAngle: 0,
    stemV: 80,
  },
  bold: {
    baseFont: 'CMUSerif-Bold',
    data: fontData('cmu-serif-700-roman.ttf'),
    widths: boldWidths,
    ascent: 937,
    descent: -308,
    capHeight: 686,
    bbox: [-1338, -401, 1738, 1115],
    flags: 34,
    italicAngle: 0,
    stemV: 120,
  },
  italic: {
    baseFont: 'CMUSerif-Italic',
    data: fontData('cmu-serif-500-italic.ttf'),
    widths: italicWidths,
    ascent: 930,
    descent: -250,
    capHeight: 677,
    bbox: [-1003, -354, 1459, 1110],
    flags: 98,
    italicAngle: -14.04,
    stemV: 80,
  },
  boldItalic: {
    baseFont: 'CMUSerif-BoldItalic',
    data: fontData('cmu-serif-700-italic.ttf'),
    widths: boldItalicWidths,
    ascent: 921,
    descent: -308,
    capHeight: 686,
    bbox: [-1197, -395, 1684, 1133],
    flags: 98,
    italicAngle: -14.04,
    stemV: 120,
  },
};
