import WeldingDemoAugmentedWorkspace from './WeldingDemoAugmentedWorkspace';
import { WELDING_DEMO_PROGRAM } from '../_data/welding-program';

// Public welding demo entrypoint. Live Classroom and timekeeping remain isolated from live school records.
export default function WeldingDemoPage() {
  return <WeldingDemoAugmentedWorkspace program={WELDING_DEMO_PROGRAM} />;
}
