import {LANES} from '../game/rules.js';
import {worldToLocal} from '../multiplayer/device-layout.js';
export function render(canvas,state,device,skin){
  const rect=canvas.getBoundingClientRect(),dpr=globalThis.devicePixelRatio||1;
  const w=Math.round(rect.width*dpr),h=Math.round(rect.height*dpr);
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  const c=canvas.getContext('2d'),a=skin.assets;
  c.setTransform(dpr,0,0,dpr,0,0);c.fillStyle=a.terrain;c.fillRect(0,0,rect.width,rect.height);
  c.save();c.scale(rect.width/500,rect.height/800);c.translate(-(device-1)*500,0);
  // All geometry is in shared world coordinates, clipped only by the canvas.
  c.strokeStyle=a.laneGround;c.lineWidth=76;
  for(const y of LANES){c.beginPath();c.moveTo(0,y);c.lineTo(1000,y);c.stroke();}
  c.strokeStyle=a.timber;c.lineWidth=3;
  for(const y of LANES){for(const offset of [-40,40]){c.beginPath();c.moveTo(0,y+offset);c.lineTo(1000,y+offset);c.stroke();}}
  c.fillStyle=a.frontier;c.globalAlpha=.3;c.fillRect(485,0,30,800);c.globalAlpha=1;
  for(const y of LANES){c.fillStyle=a.bridge;c.fillRect(475,y-37,50,74);c.fillStyle=a.brass;for(let x=479;x<525;x+=10)c.fillRect(x,y-35,2,70);}
  for(const castle of state.castles){
    const x=castle.x,y=castle.y;c.fillStyle=castle.owner===1?a.blueCastle:a.redCastle;c.fillRect(x-26,y-52,52,104);
    for(let i=0;i<3;i++)c.fillRect(x-26+i*20,y-64,12,18);
    c.strokeStyle=a.brass;c.lineWidth=3;c.strokeRect(x-26,y-52,52,104);
    c.fillStyle=a.timber;c.fillRect(x-9,y+18,18,34);c.fillStyle=castle.owner===1?a.blueBanner:a.redBanner;c.fillRect(x-9,y-42,18,35);
  }
  for(const [index,key] of ['wood','stone','iron'].entries())for(const x of [55,945]){c.fillStyle=a[key];c.fillRect(x-9,715+index*23,18,15);}
  if(state.mode==='ball'){
    c.fillStyle=a.projectiles;c.strokeStyle=a.brass;c.lineWidth=4;c.beginPath();c.arc(state.ball.x,state.ball.y,state.ball.radius,0,Math.PI*2);c.fill();c.stroke();
  }else for(const u of state.units){
    c.fillStyle=u.owner===1?a.blueUnit:a.redUnit;c.beginPath();c.arc(u.x,u.y,u.radius,0,Math.PI*2);c.fill();c.strokeStyle=a.fabric;c.lineWidth=2;c.stroke();
    c.fillStyle=a.fabric;c.fillRect(u.x-12,u.y-22,24*(u.health/100),3);
  }
  c.restore();return worldToLocal(state.ball,device,rect.width,rect.height);
}
