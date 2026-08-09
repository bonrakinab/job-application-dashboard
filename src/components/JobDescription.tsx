import { formatJobDescription } from '@/lib/job-description';

export function JobDescription({ description }: { description?: string }) {
  const blocks = formatJobDescription(description ?? '');
  if (!blocks.length) return <div className="job-description">No description supplied by source.</div>;

  return (
    <div className="job-description readable-job-description">
      {blocks.map((block, index) => {
        const key = `${index}-${block.text}`;
        if (block.type === 'heading') return <h3 key={key}>{block.text}</h3>;
        if (block.type === 'bullet') return <div className="job-description-bullet" key={key}><span>•</span><span>{block.text}</span></div>;
        return <p key={key}>{block.text}</p>;
      })}
    </div>
  );
}
