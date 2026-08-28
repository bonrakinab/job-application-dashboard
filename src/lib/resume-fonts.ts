import { RESUME_FONT_BOLD_BASE64 } from './resume-font-bold';
import { RESUME_FONT_REGULAR_BASE64 } from './resume-font-regular';

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

const regularWidths = [318,402,460,838,636,950,890,275,390,390,500,838,318,338,318,337,636,636,636,636,636,636,636,636,636,636,337,337,838,838,838,536,1000,722,735,765,802,730,694,799,872,395,401,747,664,1024,875,820,673,820,753,685,667,843,722,1028,712,660,695,390,337,390,838,500,500,596,640,560,640,592,370,640,644,320,310,606,320,948,644,602,640,640,478,513,402,644,565,856,564,565,527,636,337,636,838];
const boldWidths = [348,439,521,838,696,950,903,306,473,473,523,838,348,415,348,365,696,696,696,696,696,696,696,696,696,696,369,369,838,838,838,586,1000,776,845,796,867,762,710,854,945,468,473,869,703,1107,914,871,752,871,831,722,744,872,776,1123,776,714,730,473,365,473,838,500,500,648,699,609,699,636,430,699,727,380,362,693,380,1058,727,667,699,699,527,563,462,727,581,861,596,581,568,643,364,643,838];

export const EMBEDDED_RESUME_FONTS: Record<'regular' | 'bold', EmbeddedResumeFont> = {
  regular: {
    baseFont: 'DejaVuSerif',
    data: Buffer.from(RESUME_FONT_REGULAR_BASE64, 'base64'),
    widths: regularWidths,
    ascent: 928,
    descent: -236,
    capHeight: 928,
    bbox: [-770, -347, 2105, 1109],
    flags: 34,
    italicAngle: 0,
    stemV: 80,
  },
  bold: {
    baseFont: 'DejaVuSerif-Bold',
    data: Buffer.from(RESUME_FONT_BOLD_BASE64, 'base64'),
    widths: boldWidths,
    ascent: 939,
    descent: -236,
    capHeight: 939,
    bbox: [-836, -389, 1854, 1145],
    flags: 34,
    italicAngle: 0,
    stemV: 120,
  },
};
