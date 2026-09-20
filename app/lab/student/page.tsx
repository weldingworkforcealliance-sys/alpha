import {notFound} from 'next/navigation';
import LabStudentClient from './student-client';
export const metadata={title:'LTG student shop card',referrer:'no-referrer' as const};
export default function LabStudentPage(){
 if(process.env.NEXT_PUBLIC_TOWER_ENABLED!=='true')notFound();
 return <LabStudentClient/>;
}
