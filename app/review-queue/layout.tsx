import type { ReactNode } from 'react';
import DayCompletionReviewQueue from './day-completion-review';

export default function ReviewQueueLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <DayCompletionReviewQueue />
      {children}
    </>
  );
}
