import TowerWorkspace from './workspace';
import {notFound} from 'next/navigation';
export default function TowerPage() {
 if(process.env.NEXT_PUBLIC_TOWER_ENABLED!=='true')notFound();
 return <TowerWorkspace />;
}
