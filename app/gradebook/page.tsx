import GradebookWorkspace from './workspace';

export default function GradebookPage() {
  if (process.env.NEXT_PUBLIC_GRADEBOOK_ENABLED !== 'true') {
    return <main className="panel"><h1>Gradebooks</h1><p>The gradebook foundation is awaiting activation for this environment.</p></main>;
  }
  return <GradebookWorkspace />;
}
