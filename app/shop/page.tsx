import {notFound} from 'next/navigation';
import ShopPageClient from './page-client';
export default function ShopPage(){
 if(process.env.NEXT_PUBLIC_WLD110_SHOP_ENABLED!=='true')notFound();
 return <ShopPageClient/>;
}
