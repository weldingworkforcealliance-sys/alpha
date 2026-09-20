export type PlannerCueTone = 'plain' | 'teach' | 'safety' | 'check' | 'homework';
export type PlannerCue = {
  label: string;
  tone: PlannerCueTone;
  lines: { text: string; bullet: boolean }[];
};

const cues: Record<string, PlannerCueTone> = {
  SAFETY: 'safety',
  'SAFE CLOSEOUT': 'safety',
  CHECK: 'check',
  'STUDENT PRACTICE': 'check',
  'DEMO + PRACTICE': 'teach',
  'TOUR + SHOW': 'teach',
  DEMONSTRATE: 'teach',
  APPLY: 'teach',
  HOMEWORK: 'homework',
  SEQUENCE: 'plain',
};

export function parsePlannerActivity(text: string, fallbackTitle = '') {
  const lines = text.replace(/\r\n?/g, '\n').trim().split('\n');
  const first = lines[0]?.trim() || '';
  const hasTitle = /^#{1,6}\s/.test(first) ||
    (first.length > 0 && first.length <= 140 && /[A-Z]/.test(first) &&
      first === first.toUpperCase() && !/^(?:🟥|🟦|🟩)/.test(first) &&
      !Object.keys(cues).some((label) => first === label || first.startsWith(label + ' —') || first.startsWith(label + ':')));
  const title = hasTitle ? first.replace(/^#{1,6}\s*/, '').replace(/\*\*/g, '') : fallbackTitle;
  if (hasTitle) lines.shift();

  const sections: PlannerCue[] = [];
  let current: PlannerCue | undefined;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const cleaned = line.replace(/^(?:🟥|🟦|🟩)\s*/, '').replace(/\*\*/g, '');
    const label = Object.keys(cues).find((candidate) =>
      cleaned === candidate || cleaned.startsWith(candidate + ' —') ||
      cleaned.startsWith(candidate + ':')
    );
    const markdownHeading = line.match(/^#{1,6}\s+(.+)$/);
    if (label || markdownHeading) {
      current = {
        label: label || markdownHeading![1].replace(/\*\*/g, ''),
        tone: label ? cues[label] : 'plain',
        lines: [],
      };
      sections.push(current);
      if (label) {
        const rest = cleaned.slice(label.length).replace(/^\s*[—:]\s*/, '').trim();
        if (rest) current.lines.push({ text: rest, bullet: false });
      }
      continue;
    }
    if (!current) {
      current = { label: '', tone: 'plain', lines: [] };
      sections.push(current);
    }
    const bullet = line.match(/^(?:[•*-]|\d+[.)])\s+(.+)$/);
    current.lines.push({ text: bullet ? bullet[1] : line, bullet: Boolean(bullet) });
  }
  return { title, sections };
}
