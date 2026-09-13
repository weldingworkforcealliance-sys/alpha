import StudentDisplayClient from './StudentDisplayClient';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DemoStudentDisplayPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const codeValue = params.code;
  const joinCode = Array.isArray(codeValue) ? codeValue[0] ?? '' : codeValue ?? '';

  return <StudentDisplayClient joinCode={joinCode} />;
}
