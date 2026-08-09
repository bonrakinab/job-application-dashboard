import { formatJobDescription } from '@/lib/job-description';

export function JobDescription({ description }: { description?: string }) {
  const blocks = formatJobDescription(description ?? '');
  if (!blocks.length) return <div className="job-description">No description supplied by source.</div>;

  return (
    <div className="job-description" style={{ lineHeight: 1.72 }}>
      {blocks.map((block, index) => {
        const key = `${index}-${block.text}`;
        if (block.type === 'heading') {
          return <h3 key={key} style={{ margin: index ? '20px 0 8px' : '4px 0 8px', fontSize: 16 }}>{block.text}</h3>;
        }
        if (block.type === 'bullet') {
          return <div key={key} style={{ display: 'grid', gridTemplateColumns: '16px minmax(0, 1fr)', gap: 7, margin: '7px 0' }}><span aria-hidden="true">•</span><span>{block.text}</span></div>;
        }
        return <p key={key} style={{ margin: '0 0 12px' }}>{block.text}</p>;
      })}
    </div>
  );
}
