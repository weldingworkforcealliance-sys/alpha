import {createQR} from './qr-encoder.js';
export function drawInviteQR(canvas,url){
  const {modules}=createQR(url,{errorCorrectionLevel:'M'});
  const scale=6,margin=4,size=(modules.size+margin*2)*scale;
  canvas.width=canvas.height=size;
  const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,size,size);context.fillStyle='#000';
  for(let y=0;y<modules.size;y++)for(let x=0;x<modules.size;x++)if(modules.get(y,x))context.fillRect((x+margin)*scale,(y+margin)*scale,scale,scale);
}
