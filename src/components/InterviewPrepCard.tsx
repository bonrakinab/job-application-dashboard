import type { InterviewPrep } from '@/lib/types';

export function InterviewPrepCard({ prep }: { prep: InterviewPrep }) {
  return <div className="card">
    <div className="kicker">Job-specific interview preparation</div>
    <h3>Topics to prepare</h3>
    <div className="tag-list">{prep.topics.length ? prep.topics.map((topic) => <span className="tag" key={topic}>{topic}</span>) : <span className="small muted">No specific topics extracted yet.</span>}</div>

    <div className="divider"/>
    <h3>Likely questions</h3>
    <div className="grid" style={{ gap: 9 }}>{prep.likelyQuestions.map((question, index) => <div className="small" key={question}><b>{index + 1}.</b> {question}</div>)}</div>

    <div className="divider"/>
    <h3>Evidence to use</h3>
    <div className="grid" style={{ gap: 10 }}>{prep.evidence.length ? prep.evidence.map((item) => <div className="small" key={item.label}><b>{item.label}</b><br/><span className="muted">{item.detail}</span></div>) : <span className="small muted">Generate a current application pack to select the strongest role-specific evidence.</span>}</div>

    <div className="divider"/>
    <h3>STAR preparation</h3>
    <div className="grid" style={{ gap: 8 }}>{prep.starPrompts.map((prompt) => <div className="small" key={prompt}>• {prompt}</div>)}</div>

    <div className="divider"/>
    <h3>Questions to ask them</h3>
    <div className="grid" style={{ gap: 8 }}>{prep.questionsToAsk.map((question) => <div className="small" key={question}>• {question}</div>)}</div>
  </div>;
}
