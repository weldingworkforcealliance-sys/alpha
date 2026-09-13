import WeldingDemoLiveWorkspace from './WeldingDemoLiveWorkspace';
import { WELDING_DEMO_PROGRAM } from '../_data/welding-program';

export default function WeldingDemoPage() {
  return <WeldingDemoLiveWorkspace program={WELDING_DEMO_PROGRAM} />;
}
