import JoinClient from './JoinClient';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DemoJoinPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const codeValue = params.code;
  const initialCode = Array.isArray(codeValue) ? codeValue[0] ?? '' : codeValue ?? '';
  return <JoinClient initialCode={initialCode} />;
}
