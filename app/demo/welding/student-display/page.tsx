'use client';

import { useSearchParams } from 'next/navigation';
import StudentDisplayClient from './StudentDisplayClient';

export default function DemoStudentDisplayPage() {
  const params = useSearchParams();
  return (
    <StudentDisplayClient
      sessionId={params.get('session') ?? ''}
      activityKey={params.get('activity') ?? 'preclass_math'}
    />
  );
}
