import assert from 'node:assert/strict';
import test from 'node:test';
import { profileWithTailoredCourseworkForResume, tailorRelevantCoursework } from './education-tailoring';
import type { ApplicationPack, CandidateProfile, Job } from './types';

const profile: CandidateProfile = {
  name: 'Arnob Banik',
  targetTitles: [],
  preferredLocations: [],
  skills: ['Python', 'Machine Learning', 'TypeScript', 'PostgreSQL'],
  degrees: [
    {
      institution: 'University of Windsor',
      degree: 'Master of Science in Computer Science',
      field: 'Artificial Intelligence Specialization',
      start: 'Sept 2024',
      end: 'Aug 2026 (Expected)',
      coursework: [
        'Statistical Learning',
        'Introduction to Artificial Intelligence',
        'Neural Networks and Deep Learning',
        'Topics: Applied Artificial Intelligence',
        'Software Engineering / Distributed Systems',
      ],
    },
    {
      institution: 'Vellore Institute of Technology',
      degree: 'Bachelor of Technology',
      field: 'Computer Science and Engineering',
      start: 'July 2019',
      end: 'July 2023',
      coursework: [
        'Data Structures and Algorithms',
        'Database Management Systems',
        'Operating Systems',
        'Java Programming',
        'Software Engineering',
        'Principles of Cloud Computing',
        'Cyber Security',
        'Artificial Intelligence',
        'Applied Linear Algebra',
      ],
    },
  ],
};

function job(title: string, description: string): Job {
  return {
    externalId: title,
    source: 'test',
    sourceKey: 'test',
    url: 'https://example.com',
    title,
    company: 'Example',
    description,
  };
}

test('AI roles select only verified AI/data coursework from the transcript catalog', () => {
  const selected = tailorRelevantCoursework(job(
    'Machine Learning Engineer',
    'Build machine learning and deep learning systems using neural networks, Python, statistics, and data science methods.',
  ), profile);
  const courses = selected.flatMap((item) => item.coursework);
  assert.ok(courses.includes('Neural Networks and Deep Learning'));
  assert.ok(courses.includes('Statistical Learning'));
  assert.ok(courses.every((course) => profile.degrees!.some((degree) => degree.coursework!.includes(course))));
  assert.equal(courses.includes('Java Programming'), false);
});

test('software/backend roles promote software, algorithms, database, or Java coursework rather than AI filler', () => {
  const selected = tailorRelevantCoursework(job(
    'Backend Software Engineer',
    'Develop backend services and APIs with Java, PostgreSQL databases, distributed systems, algorithms, and software engineering practices.',
  ), profile);
  const courses = selected.flatMap((item) => item.coursework);
  assert.ok(courses.includes('Software Engineering / Distributed Systems'));
  assert.ok(courses.includes('Java Programming') || courses.includes('Database Management Systems'));
  assert.equal(courses.includes('Neural Networks and Deep Learning'), false);
});

test('resume education preserves degree text and carries at most two selected courses separately', () => {
  const pack = {
    summary: '', resumeHeadline: '', resumeSummary: '', skills: [], experience: [], projects: [],
    education: [
      { institution: 'University of Windsor', degree: 'Master of Science in Computer Science', field: 'Artificial Intelligence Specialization', coursework: ['Neural Networks and Deep Learning', 'Statistical Learning', 'Topics: Applied Artificial Intelligence'] },
      { institution: 'Vellore Institute of Technology', degree: 'Bachelor of Technology', field: 'Computer Science and Engineering', coursework: ['Data Structures and Algorithms', 'Software Engineering', 'Database Management Systems'] },
    ],
    coverLetter: '', outreachMessage: '', interviewThemes: [], claimsAudit: [],
  } satisfies ApplicationPack;
  const rendered = profileWithTailoredCourseworkForResume(profile, pack);
  assert.equal(rendered.degrees?.[0].end, 'Aug 2026 (Expected)');
  assert.equal(rendered.degrees?.[0].field, 'AI Specialization');
  assert.deepEqual(rendered.degrees?.[0].coursework, ['Neural Networks and Deep Learning', 'Statistical Learning']);
  assert.equal(rendered.degrees?.[1].field, 'Computer Science and Engineering');
  assert.deepEqual(rendered.degrees?.[1].coursework, ['Data Structures and Algorithms', 'Software Engineering']);
});
