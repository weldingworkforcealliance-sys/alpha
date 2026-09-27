import {Session} from './multiplayer/session.js';
import {SoloSession} from './solo/solo-session.js';
import {SnapshotBuffer} from './multiplayer/sync.js';
import {viewport} from './multiplayer/device-layout.js';
import {resolveSkin} from './skins/registry.js';
import {render} from './rendering/renderer.js';
import {drawInviteQR} from './ui/invite-qr.js';

const $=id=>document.getElementById(id),params=new URLSearchParams(location.hash.slice(1));
const devPreview=new URLSearchParams(location.search).get('dev')==='1';
const buffer=new SnapshotBuffer();

let skin=resolveSkin('living-kingdoms');
let latest=null;
let device=1;
let lastReceived=0;
let activeSession=null;

const status=message=>$('status').textContent=message;
const onState=s=>{latest=s;lastReceived=performance.now();buffer.push(s,lastReceived);};
const onlineSession=new Session(onState,status);
const soloSession=new SoloSession(onState,status);
activeSession=onlineSession;

function ready(credentials){
  device=credentials.device;
  $('lobby').hidden=true;
  $('play').hidden=false;

  const solo=Boolean(credentials.solo);
  document.body.classList.toggle('solo-mode',solo);
  $('hostControls').hidden=!(device===1||solo);
  $('modeControl').hidden=!(device===1||solo);
  $('guestHelp').hidden=device!==2;
  $('soloHelp').hidden=!solo;
  $('sharing').hidden=true;
  $('launch').hidden=solo;
  $('showQR').hidden=solo;

  if(solo){
    $('placement').textContent='SOLO · Full battlefield · You are Blue vs Red AI';
  }else{
    $('placement').textContent=device===1
      ?'Phone A · LEFT · inside edge →'
      :'Phone B · RIGHT · ← inside edge';
  }

  if(credentials.invite){
    $('sharing').hidden=false;
    const url=new URL(location.href);
    url.hash=new URLSearchParams({id:credentials.id,invite:credentials.invite});
    $('share').value=url.href;
    drawInviteQR($('inviteQR'),url.href);
  }

  history.replaceState(null,'',location.pathname+location.search);
}

async function safely(action){
  try{await action();}
  catch(error){status(error.message);}
}

$('solo').onclick=()=>safely(async()=>{
  if(activeSession?.credentials)return;
  activeSession=soloSession;
  ready(await soloSession.create());
});

$('create').onclick=()=>safely(async()=>{
  if(activeSession?.credentials)return;
  activeSession=onlineSession;
  ready(await onlineSession.create());
});

if(params.has('invite'))$('invite').value=location.href;

$('join').onclick=()=>safely(async()=>{
  if(activeSession?.credentials)return;
  const url=new URL($('invite').value);
  const p=new URLSearchParams(url.hash.slice(1));
  if(!p.get('id')||!p.get('invite'))throw new Error('Paste a complete TwinLane v2 invitation link.');
  activeSession=onlineSession;
  ready(await onlineSession.join(p.get('id'),p.get('invite')));
});

$('launch').onclick=()=>safely(()=>activeSession.send({type:'launch'}));
$('showQR').onclick=()=>$('inviteDialog').showModal();
$('closeQR').onclick=()=>$('inviteDialog').close();
$('pause').onclick=()=>safely(()=>activeSession.send({type:'run',value:!latest?.running}));
$('mode').onchange=()=>safely(()=>activeSession.send({type:'mode',value:$('mode').value}));
$('unit').onclick=()=>safely(()=>activeSession.send({type:'unit',lane:Number($('lane').value)}));

$('leave').onclick=()=>{
  activeSession?.close();
  onlineSession.close();
  soloSession.close();
  location.href=location.pathname+location.search;
};

if(devPreview){
  $('skin').options[1].disabled=false;
  $('skin').options[1].textContent='Ironhold · development preview';
  $('preview').hidden=false;
}

$('skin').onchange=()=>{
  skin=resolveSkin($('skin').value,{devPreview});
  $('skin').value=skin.id;
  document.querySelector('h1').textContent=skin.name;
};

$('create').disabled=true;
$('join').disabled=true;

void safely(async()=>{
  try{
    const saved=await onlineSession.restore(params.get('id'));
    if(saved){
      activeSession=onlineSession;
      ready(saved);
    }
  }finally{
    $('create').disabled=false;
    $('join').disabled=false;
  }
});

function frame(now){
  const state=buffer.sample(now);
  if(state){
    const local=render($('battlefield'),state,device,skin),v=viewport(device);
    $('pause').textContent=latest?.running?'Pause':'Resume';
    $('mode').value=latest.mode;
    const sessionId=activeSession?.credentials?.id||'none';
    const modeLabel=device===0?'Solo vs AI':`Device ${device}`;
    $('debug').textContent=`${modeLabel}
Viewport X: ${v.x0}–${v.x1}; Y: 0–800
Session: ${sessionId}
Skin: ${skin.id}
Shared ball X/Y: ${state.ball.x.toFixed(2)} / ${state.ball.y.toFixed(2)}
Local pixels X/Y: ${local.x.toFixed(2)} / ${local.y.toFixed(2)}
Tick: ${state.tick}
Snapshot age: ${Math.round(now-lastReceived)} ms
Render buffer: 120 ms`;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

$('restart').onclick=()=>safely(async()=>{
  await activeSession.send({type:'restart'});
  status(device===0?'Solo game restarted.':'Test restarted on both phones.');
});
