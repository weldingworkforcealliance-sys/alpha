import type { ReactNode } from 'react';
import AttendanceNav from './attendance-nav';

export default function AttendanceLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AttendanceNav />
      {children}
    </>
  );
}
