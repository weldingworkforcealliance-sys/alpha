import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Wld205ReadOnlyReview from './ReviewClient';

export const metadata: Metadata = {
  title: 'LTG | WLD 205 Instructor Layout Review',
  robots: { index: false, follow: false },
};

// This is intentionally NOT an anonymous bypass of a teaching section.
// The public preview renders only static, non-sensitive sample material.
// In live production the route is unavailable.
export default function Wld205ReviewPage() {
  if (process.env.NEXT_PUBLIC_DEPLOYMENT_ENV !== 'staging') notFound();
  return <Wld205ReadOnlyReview />;
}
