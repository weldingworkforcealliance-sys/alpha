import {notFound} from 'next/navigation';
import StudentPageClient from './student-client';
export const metadata={title:'WLD 110 shop card',referrer:'no-referrer' as const};
export default function StudentPage(){
 if(process.env.NEXT_PUBLIC_WLD110_SHOP_ENABLED!=='true')notFound();
 return <StudentPageClient/>;
}
