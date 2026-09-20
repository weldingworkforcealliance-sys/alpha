import QRCode from 'qrcode';

// Keep one personal link per class and student for the lifetime of a workspace.
export class StudentQrCache {
 private links=new Map<string,{url:string;image?:string}>();
 url(key:string){return this.links.get(key)?.url??'';}
 async prepare(key:string,issue:()=>Promise<string>){
  let cached=this.links.get(key);
  if(!cached){cached={url:await issue()};this.links.set(key,cached);}
  if(!cached.image)cached.image=await QRCode.toDataURL(cached.url,{width:280,margin:4,errorCorrectionLevel:'M',color:{dark:'#000000',light:'#ffffff'}});
  return {url:cached.url,image:cached.image};
 }
}
