import WeldingDemoLiveWorkspace from './WeldingDemoLiveWorkspace';
import { WELDING_DEMO_PROGRAM } from '../_data/welding-program';

// Public welding demo entrypoint. Live Classroom remains isolated from live school records.
export default function WeldingDemoPage() {
  return <WeldingDemoLiveWorkspace program={WELDING_DEMO_PROGRAM} />;
}
