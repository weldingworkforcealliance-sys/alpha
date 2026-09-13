import DemoProgramWorkspace from '../_components/DemoProgramWorkspace';
import { WELDING_DEMO_PROGRAM } from '../_data/welding-program';

export default function WeldingDemoPage() {
  return <DemoProgramWorkspace program={WELDING_DEMO_PROGRAM} />;
}
