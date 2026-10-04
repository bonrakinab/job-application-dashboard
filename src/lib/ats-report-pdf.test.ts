import assert from 'node:assert/strict';
import test from 'node:test';
import { PDFParse } from 'pdf-parse';
import { atsAnalyzerReportPdf, isAtsAnalyzerResult } from './ats-report-pdf';
import type { AtsAnalyzerResult } from './ats-analyzer';

const result: AtsAnalyzerResult = {
  combinedScore: 82,
  targetScore: 90,
  label: 'Strong',
  job: { title: 'Systems Analyst', company: 'Example Employer', location: 'Windsor, Ontario' },
  resume: { name: 'resume.pdf', format: 'PDF', pages: 2 },
  models: { selected: 'google/gemini-3.8-flash', profileExtraction: 'test-extractor', jobAnalysis: 'test-analyzer' },
  checkers: [{
    id: 'readiness',
    name: 'System ATS readiness',
    score: 82,
    summary: 'Complete readiness summary.',
    metrics: [{ label: 'Requirement support', score: 80 }],
    good: ['Strong systems evidence'],
    needsWork: ['Missing cloud certification'],
    improvements: ['Add verified cloud project evidence.'],
  }],
  matchedKeywords: ['SQL', 'systems analysis'],
  missingKeywords: ['Azure'],
  requirements: [{
    requirement: 'SQL reporting',
    importance: 'must-have',
    category: 'hard-skill',
    exactTerms: ['SQL'],
    support: 'supported',
    confidence: 92,
    evidence: [{ id: 'EXP:0:0', label: 'Example Employer', excerpt: 'Built SQL reports.', score: 95 }],
  }],
  analyzedAt: '2026-10-04T02:00:00.000Z',
  disclaimer: 'Internal estimate only.',
};

test('ATS report validation accepts a complete analyzer result', () => {
  assert.equal(isAtsAnalyzerResult(result), true);
  assert.equal(isAtsAnalyzerResult({ combinedScore: 82 }), false);
});

test('ATS report PDF is readable and contains the complete report sections', async () => {
  const pdf = atsAnalyzerReportPdf(result);
  assert.equal(pdf.toString('latin1', 0, 8), '%PDF-1.4');
  assert.ok(pdf.length > 3_000);
  const parser = new PDFParse({ data: pdf });
  try {
    const parsed = await parser.getText();
    assert.match(parsed.text, /ATS Analyzer - Full Report/);
    assert.match(parsed.text, /System ATS readiness/i);
    assert.match(parsed.text, /Keyword analysis/i);
    assert.match(parsed.text, /Requirement evidence/i);
    assert.match(parsed.text, /Built SQL reports/);
    assert.match(parsed.text, /Analysis details/i);
  } finally {
    await parser.destroy();
  }
});
