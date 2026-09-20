import { Fragment } from 'react';
import { parsePlannerActivity } from '@/lib/planner-activity';

function emphasis(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={index}>{part.slice(2, -2)}</strong>
      : <Fragment key={index}>{part}</Fragment>
  );
}

export default function PlannerActivity({
  text,
  fallbackTitle = '',
  headingLevel = 5,
}: {
  text: string;
  fallbackTitle?: string;
  headingLevel?: 4 | 5;
}) {
  const { title, sections } = parsePlannerActivity(text, fallbackTitle);
  const Heading = headingLevel === 4 ? 'h4' : 'h5';
  return (
    <div className="planner-activity" data-planner-activity>
      {title && <Heading className="planner-activity-title">{title}</Heading>}
      {sections.map((section, index) => (
        <section className={'planner-cue planner-cue-' + section.tone} key={index}>
          {section.label && <h6 className="planner-cue-label">{section.label}</h6>}
          {section.lines.map((line, lineIndex) => {
            if (!line.bullet) return <p key={lineIndex}>{emphasis(line.text)}</p>;
            if (lineIndex > 0 && section.lines[lineIndex - 1].bullet) return null;
            const following = section.lines.slice(lineIndex);
            const firstNonBullet = following.findIndex((item) => !item.bullet);
            const group = firstNonBullet < 0 ? following : following.slice(0, firstNonBullet);
            return (
              <ul key={lineIndex}>
                {group.map((item, itemIndex) => <li key={itemIndex}>{emphasis(item.text)}</li>)}
              </ul>
            );
          })}
        </section>
      ))}
    </div>
  );
}
