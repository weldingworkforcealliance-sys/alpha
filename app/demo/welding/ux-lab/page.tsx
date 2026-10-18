import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import WeldingDemoAugmentedWorkspace from '../WeldingDemoAugmentedWorkspace';
import { WELDING_DEMO_PROGRAM } from '../../_data/welding-program';

export const metadata: Metadata = {
  title: 'LTG | FABTECH Teaching View v2 UX Lab',
  robots: { index: false, follow: false },
};

// Keep the original FABTECH/public welding demo untouched. The UX lab uses
// that demo's existing temporary course, attendance, and classroom state.
// No guest access to the actual instructor/gradebook tables is introduced.
export default function FabtechTeachingUxLabPage() {
  if (process.env.NEXT_PUBLIC_DEPLOYMENT_ENV !== 'staging') notFound();
  return <WeldingDemoAugmentedWorkspace program={WELDING_DEMO_PROGRAM} uxLab />;
}
