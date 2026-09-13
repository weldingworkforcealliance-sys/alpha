import StudentDisplayClient from './StudentDisplayClient';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DemoStudentDisplayPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const sessionValue = params.session;
  const activityValue = params.activity;
  const sessionId = Array.isArray(sessionValue) ? sessionValue[0] ?? '' : sessionValue ?? '';
  const activityKey = Array.isArray(activityValue) ? activityValue[0] ?? 'preclass_math' : activityValue ?? 'preclass_math';

  return <StudentDisplayClient sessionId={sessionId} activityKey={activityKey} />;
}
