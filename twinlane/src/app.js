import {Session} from './multiplayer/session.js';
import {SnapshotBuffer} from './multiplayer/sync.js';
import {viewport} from './multiplayer/device-layout.js';
import {resolveSkin} from './skins/registry.js';
import {render} from './rendering/renderer.js';
import {drawInviteQR} from './ui/invite-qr.js';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.hash.slice(1));
const devPreview=new URLSearchParams(location.search).get('dev')==='1';
const buffer=new SnapshotBuffer();let skin=resolveSkin('living-kingdoms'),latest=null,device=1,lastReceived=0;
const status=message=>$('status').textContent=message;
const session=new Session(s=>{latest=s;lastReceived=performance.now();buffer.push(s,lastReceived);},status);
function ready(credentials){
  device=credentials.device;$('lobby').hidden=true;$('play').hidden=false;$('hostControls').hidden=device!==1;
  $('modeControl').hidden=device!==1;$('guestHelp').hidden=device!==2;
  $('placement').textContent=device===1?'Phone A · LEFT · inside edge →':'Phone B · RIGHT · ← inside edge';
  if(credentials.invite){
    $('sharing').hidden=false;const url=new URL(location.href);url.hash=new URLSearchParams({id:credentials.id,invite:credentials.invite});$('share').value=url.href;
    drawInviteQR($('inviteQR'),url.href);
  }
  history.replaceState(null,'',location.pathname+location.search);
}
async function safely(action){try{await action();}catch(error){status(error.message);}}
$('create').onclick=()=>safely(async()=>{if(session.credentials)return;ready(await session.create());});
if(params.has('invite'))$('invite').value=location.href;
$('join').onclick=()=>safely(async()=>{if(session.credentials)return;const url=new URL($('invite').value);const p=new URLSearchParams(url.hash.slice(1));if(!p.get('id')||!p.get('invite'))throw new Error('Paste a complete TwinLane v2 invitation link.');ready(await session.join(p.get('id'),p.get('invite')));});
$('launch').onclick=()=>safely(()=>session.send({type:'launch'}));
$('showQR').onclick=()=>$('inviteDialog').showModal();
$('closeQR').onclick=()=>$('inviteDialog').close();
$('pause').onclick=()=>safely(()=>session.send({type:'run',value:!latest?.running}));
$('mode').onchange=()=>safely(()=>session.send({type:'mode',value:$('mode').value}));
$('unit').onclick=()=>safely(()=>session.send({type:'unit',lane:Number($('lane').value)}));
$('leave').onclick=()=>{session.close();location.href=location.pathname+location.search;};
if(devPreview){$('skin').options[1].disabled=false;$('skin').options[1].textContent='Ironhold · development preview';$('preview').hidden=false;}
$('skin').onchange=()=>{skin=resolveSkin($('skin').value,{devPreview});$('skin').value=skin.id;document.querySelector('h1').textContent=skin.name;};
const saved=session.restore();if(saved)ready(saved);
function frame(now){
  const state=buffer.sample(now);
  if(state){
    const local=render($('battlefield'),state,device,skin),v=viewport(device);
    $('pause').textContent=latest?.running?'Pause':'Resume';$('mode').value=latest.mode;
    $('debug').textContent=`Device: ${device}\nViewport X: ${v.x0}–${v.x1}; Y: 0–800\nSession: ${session.credentials?.id}\nSkin: ${skin.id}\nShared ball X/Y: ${state.ball.x.toFixed(2)} / ${state.ball.y.toFixed(2)}\nLocal pixels X/Y: ${local.x.toFixed(2)} / ${local.y.toFixed(2)}\nTick: ${state.tick}\nSnapshot age: ${Math.round(now-lastReceived)} ms\nRender buffer: 120 ms`;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
$('restart').onclick=()=>safely(async()=>{await session.send({type:'restart'});status('Test restarted on both phones.');});
