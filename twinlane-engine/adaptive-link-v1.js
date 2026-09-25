/* Corvu Mor TwinLane Adaptive Link Engine v1
 * Required engine add-on for cross-device motion games.
 * Physical reference build: Bocce commit 234b9eb3ef1a893b359fb3bb7d3c6bdb0fb420b7
 */
(function(global){
'use strict';

const VERSION='1.0.0';
const CONTRACT='adaptive-link-v1-physical-approved';

function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function median(values){
  const a=values.filter(Number.isFinite).slice().sort((x,y)=>x-y);
  if(!a.length)return null;
  const m=Math.floor(a.length/2);
  return a.length%2?a[m]:(a[m-1]+a[m])/2;
}
function percentile(values,p){
  const a=values.filter(Number.isFinite).slice().sort((x,y)=>x-y);
  if(!a.length)return null;
  const idx=(a.length-1)*p,lo=Math.floor(idx),hi=Math.ceil(idx);
  return lo===hi?a[lo]:a[lo]+(a[hi]-a[lo])*(idx-lo);
}
async function measureRefreshRate(){
  return await new Promise(resolve=>{
    const samples=[];let last=performance.now(),done=false;
    const finish=(hz)=>{if(done)return;done=true;resolve(hz)};
    const step=(now)=>{
      const d=now-last;last=now;
      if(d>5&&d<80)samples.push(d);
      if(samples.length>=24){
        finish(clamp(1000/(median(samples)||16.67),20,144));
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    setTimeout(()=>finish(60),1100);
  });
}

function create(options={}){
  const signalSend=typeof options.signalSend==='function'?options.signalSend:()=>{};
  const onGameEvent=typeof options.onGameEvent==='function'?options.onGameEvent:()=>{};
  const onStatus=typeof options.onStatus==='function'?options.onStatus:()=>{};
  const onEvent=typeof options.onEvent==='function'?options.onEvent:()=>{};
  const isHost=()=>Boolean(typeof options.isHost==='function'?options.isHost():options.isHost);
  const isMoving=()=>Boolean(typeof options.isMoving==='function'?options.isMoving():false);
  const role=()=>String(typeof options.role==='function'?options.role():options.role||'');
  const position=()=>String(typeof options.position==='function'?options.position():options.position||'');

  const FALLBACK=Object.freeze({
    mode:'realtime',profile:'cloud',direct:false,ready:true,
    playbackDelayMs:60,predictMs:55,
    motionIntervalNear:32,motionIntervalFar:24,
    medianRttMs:null,jitterMs:null,loss:null,
    peerRefreshHz:60,senderRefreshHz:60,peerOffsetMs:0
  });

  let config={...FALLBACK,ready:false};
  let pendingConfig=null;
  let pc=null,control=null,motion=null;
  let iceQueue=[];
  let readyTimer=null,fallbackTimer=null,healthTimer=null;
  let negotiationStarted=false,calibrating=false;
  let localRefreshHz=60,peerRefreshHz=60,peerMeta=null;
  let pendingPings=new Map(),samples=[],lastPongPerf=0;

  function emit(type,payload={}){try{onEvent(type,payload)}catch{}}
  function status(extra={}){
    try{onStatus({...config,version:VERSION,contract:CONTRACT,...extra})}catch{}
  }
  function current(){return {...config}}
  function ready(){return Boolean(config.ready)}
  function direct(){return Boolean(config.direct&&config.ready)}
  function playbackDelayMs(){return ready()?config.playbackDelayMs:FALLBACK.playbackDelayMs}
  function predictMs(){return ready()?config.predictMs:FALLBACK.predictMs}
  function motionInterval(y){
    const c=ready()?config:FALLBACK;
    return Number(y)>=42?c.motionIntervalFar:c.motionIntervalNear;
  }
  function senderRefreshHz(){
    const remote=clamp(Number(peerMeta?.refreshHz||peerRefreshHz)||60,20,144);
    return position()==='first'?localRefreshHz:remote;
  }

  function choose(samplesIn,refreshIn=60,expected=12){
    const rtts=samplesIn.map(s=>s.rtt).filter(Number.isFinite);
    const offsets=samplesIn.map(s=>s.offset).filter(Number.isFinite);
    const med=median(rtts)??50;
    const p90=percentile(rtts,.90)??med;
    const jitter=Math.max(0,p90-med);
    const loss=Math.max(0,1-rtts.length/Math.max(1,expected));
    const refresh=clamp(Number(refreshIn)||60,20,144);
    const senderFrameMs=1000/refresh;

    let profile='variable';
    let playbackDelay=28,predict=38,near=24,far=20;
    if(med<=18&&jitter<=6&&loss<=.08){
      profile='excellent';playbackDelay=8;predict=22;near=16;far=16;
    }else if(med<=38&&jitter<=14&&loss<=.16){
      profile='good';playbackDelay=16;predict=30;near=20;far=18;
    }else if(med<=75&&jitter<=28&&loss<=.28){
      profile='variable';playbackDelay=30;predict=42;near=24;far=22;
    }else{
      profile='poor';playbackDelay=44;predict=52;near=28;far=24;
    }

    if(refresh<=30)predict=Math.max(predict,50);
    else if(refresh<=45)predict=Math.max(predict,40);

    const floor=Math.max(12,Math.round(senderFrameMs));
    near=Math.max(near,floor);far=Math.max(far,floor);

    return {
      mode:'webrtc',profile,direct:true,ready:true,
      playbackDelayMs:playbackDelay,predictMs:predict,
      motionIntervalNear:near,motionIntervalFar:far,
      medianRttMs:med,jitterMs:jitter,loss,
      peerRefreshHz:refresh,senderRefreshHz:refresh,
      peerOffsetMs:median(offsets)??0
    };
  }

  function apply(next,fromPeer=false){
    if(!next)return;
    const cfg={...next,ready:true};
    if(isMoving()){
      pendingConfig={cfg,fromPeer};
      return;
    }
    config=cfg;
    status();
    emit('profile',{...config,fromPeer});
  }
  function applyPending(){
    if(!pendingConfig||isMoving())return;
    const p=pendingConfig;pendingConfig=null;apply(p.cfg,p.fromPeer);
  }
  function fallback(reason='fallback'){
    config={...FALLBACK,ready:true};
    pendingConfig=null;
    status({reason});
    emit('fallback',{reason});
  }

  function rawChannelSend(channel,event,payload){
    if(!channel||channel.readyState!=='open')return false;
    try{
      channel.send(JSON.stringify({type:'game',event,payload}));
      return true;
    }catch{return false}
  }
  function send(event,payload,kind='control'){
    const ch=kind==='motion'?motion:control;
    if(direct()&&rawChannelSend(ch,event,payload))return 'webrtc';
    signalSend(event,payload);
    return 'realtime';
  }

  function handleData(raw,kind){
    let msg;try{msg=JSON.parse(raw)}catch{return}
    if(!msg||typeof msg!=='object')return;
    if(msg.type==='game'){
      onGameEvent(msg.event,msg.payload,'webrtc');
      emit('game_event',{event:msg.event,kind});
      return;
    }
    if(msg.type==='ping'){
      const t1=Date.now();
      try{control?.send(JSON.stringify({type:'pong',id:msg.id,t0:Number(msg.t0),t1,t2:Date.now(),mode:msg.mode||'cal'}))}catch{}
      return;
    }
    if(msg.type==='pong'){
      const t3=Date.now(),p=pendingPings.get(msg.id);
      if(!p)return;
      pendingPings.delete(msg.id);
      const t0=Number(msg.t0??p.t0),t1=Number(msg.t1),t2=Number(msg.t2);
      const rtt=Math.max(0,(t3-t0)-(t2-t1));
      const offset=((t1-t0)+(t2-t3))/2;
      lastPongPerf=performance.now();
      samples.push({rtt,offset,health:msg.mode==='health'});
      if(samples.length>32)samples.splice(0,samples.length-32);
      if(msg.mode==='health'&&isHost()){
        const health=samples.filter(s=>s.health).slice(-6);
        if(health.length>=6){
          const cfg=choose(health,senderRefreshHz(),health.length);
          const meaningful=cfg.profile!==config.profile||
            !Number.isFinite(config.medianRttMs)||
            Math.abs(cfg.medianRttMs-config.medianRttMs)>12||
            Math.abs(cfg.jitterMs-config.jitterMs)>8;
          if(meaningful){
            apply(cfg,false);
            try{control?.send(JSON.stringify({type:'cal_result',config:{...cfg,peerOffsetMs:undefined},peerOffsetMs:cfg.peerOffsetMs}))}catch{}
          }
        }
      }
      return;
    }
    if(msg.type==='cal_meta'){
      peerMeta=msg;
      peerRefreshHz=clamp(Number(msg.refreshHz)||60,20,144);
      emit('peer_meta',{refreshHz:peerRefreshHz,role:msg.role||'',position:msg.position||''});
      return;
    }
    if(msg.type==='cal_result'){
      apply({...msg.config,peerOffsetMs:Number(msg.peerOffsetMs||0)},true);
      startHealth();
    }
  }

  function setupChannel(ch,kind){
    if(kind==='control')control=ch;else motion=ch;
    ch.addEventListener('open',()=>{
      emit('channel_open',{kind});
      if(kind==='control'){
        void measureRefreshRate().then(hz=>{
          localRefreshHz=hz;
          try{ch.send(JSON.stringify({type:'cal_meta',refreshHz:hz,role:role(),position:position()}))}catch{}
          if(isHost())void calibrate();
        });
      }
      if(control?.readyState==='open'&&motion?.readyState==='open'){
        if(readyTimer){clearInterval(readyTimer);readyTimer=null}
        if(fallbackTimer){clearTimeout(fallbackTimer);fallbackTimer=null}
        config={...config,direct:true,ready:false,mode:'webrtc',profile:'calibrating'};
        status();
      }
    });
    ch.addEventListener('message',e=>handleData(e.data,kind));
    ch.addEventListener('close',()=>{emit('channel_close',{kind});if(config.direct)fallback('datachannel_closed')});
  }

  function ensurePeer(initiator=false){
    if(pc&&!['closed','failed'].includes(pc.connectionState))return pc;
    if(pc){try{pc.close()}catch{}}
    pc=new RTCPeerConnection({
      iceServers:[
        {urls:'stun:stun.cloudflare.com:3478'},
        {urls:'stun:stun.l.google.com:19302'}
      ]
    });
    iceQueue=[];
    pc.addEventListener('icecandidate',e=>{
      if(e.candidate)signalSend('peer_ice',{candidate:e.candidate.toJSON?.()||e.candidate});
    });
    pc.addEventListener('datachannel',e=>setupChannel(e.channel,e.channel.label==='twinlane-motion'?'motion':'control'));
    pc.addEventListener('connectionstatechange',()=>{
      emit('state',{state:pc.connectionState});
      if(['failed','closed'].includes(pc.connectionState))fallback('peer_'+pc.connectionState);
      if(pc.connectionState==='disconnected')setTimeout(()=>{
        if(pc?.connectionState==='disconnected')fallback('peer_disconnected');
      },1200);
    });
    if(initiator){
      setupChannel(pc.createDataChannel('twinlane-control',{ordered:true}),'control');
      setupChannel(pc.createDataChannel('twinlane-motion',{ordered:false,maxRetransmits:0}),'motion');
    }
    return pc;
  }

  async function flushIce(){
    if(!pc?.remoteDescription)return;
    while(iceQueue.length){
      const c=iceQueue.shift();
      try{await pc.addIceCandidate(c)}catch{}
    }
  }
  async function sendOffer(){
    if(!isHost())return;
    const p=ensurePeer(true);
    if(p.signalingState==='have-local-offer'&&p.localDescription){
      signalSend('peer_offer',{sdp:p.localDescription,refreshHz:localRefreshHz,role:role(),position:position(),resend:true});
      emit('signal',{type:'offer_resend'});
      return;
    }
    if(p.signalingState!=='stable')return;
    try{
      const offer=await p.createOffer();
      await p.setLocalDescription(offer);
      signalSend('peer_offer',{sdp:p.localDescription,refreshHz:localRefreshHz,role:role(),position:position()});
      emit('signal',{type:'offer'});
    }catch{}
  }

  async function handleSignal(event,payload={}){
    if(event==='peer_ready'){
      if(Number.isFinite(Number(payload.refreshHz)))peerRefreshHz=clamp(Number(payload.refreshHz),20,144);
      emit('signal',{type:'peer_ready',refreshHz:peerRefreshHz});
      if(isHost()&&!direct())await sendOffer();
      return true;
    }
    if(event==='peer_offer'){
      if(isHost())return true;
      if(Number.isFinite(Number(payload.refreshHz)))peerRefreshHz=clamp(Number(payload.refreshHz),20,144);
      const p=ensurePeer(false);
      try{
        if(p.signalingState==='stable'||!p.remoteDescription)await p.setRemoteDescription(payload.sdp);
        await flushIce();
        const answer=await p.createAnswer();
        await p.setLocalDescription(answer);
        signalSend('peer_answer',{sdp:p.localDescription,refreshHz:localRefreshHz,role:role(),position:position()});
        emit('signal',{type:'answer'});
      }catch{}
      return true;
    }
    if(event==='peer_answer'){
      if(!isHost()||!pc)return true;
      if(Number.isFinite(Number(payload.refreshHz)))peerRefreshHz=clamp(Number(payload.refreshHz),20,144);
      try{await pc.setRemoteDescription(payload.sdp);await flushIce()}catch{}
      emit('signal',{type:'answer'});
      return true;
    }
    if(event==='peer_ice'){
      if(!pc)ensurePeer(false);
      const cand=payload?.candidate;
      if(cand){
        if(pc?.remoteDescription){try{await pc.addIceCandidate(cand)}catch{}}
        else iceQueue.push(cand);
      }
      emit('signal',{type:'ice'});
      return true;
    }
    return false;
  }

  function ping(mode='cal'){
    if(control?.readyState!=='open')return;
    const id=mode+':'+Date.now()+':'+Math.random().toString(36).slice(2,8),t0=Date.now();
    pendingPings.set(id,{t0,mode});
    try{control.send(JSON.stringify({type:'ping',id,t0,mode}))}catch{}
    setTimeout(()=>pendingPings.delete(id),1800);
  }
  async function calibrate(){
    if(!isHost()||calibrating||control?.readyState!=='open')return;
    calibrating=true;samples=[];
    config={...config,direct:true,ready:false,profile:'calibrating'};status();
    for(let i=0;i<12;i++){ping('cal');await new Promise(r=>setTimeout(r,85))}
    await new Promise(r=>setTimeout(r,220));
    const valid=samples.filter(s=>!s.health);
    if(valid.length<5){
      fallback('insufficient_direct_samples');
      try{control.send(JSON.stringify({type:'cal_result',config:{...FALLBACK},peerOffsetMs:0}))}catch{}
      calibrating=false;return;
    }
    const cfg=choose(valid,senderRefreshHz(),12);
    apply(cfg,false);
    try{control.send(JSON.stringify({type:'cal_result',config:{...cfg,peerOffsetMs:undefined},peerOffsetMs:cfg.peerOffsetMs}))}catch{}
    calibrating=false;startHealth();
  }
  function startHealth(){
    if(healthTimer)clearInterval(healthTimer);
    lastPongPerf=performance.now();
    healthTimer=setInterval(()=>{
      if(control?.readyState!=='open')return;
      ping('health');
      if(performance.now()-lastPongPerf>6500)fallback('health_timeout');
    },3000);
  }

  function start(){
    if(negotiationStarted)return;
    negotiationStarted=true;
    void measureRefreshRate().then(hz=>{localRefreshHz=hz});
    if(typeof RTCPeerConnection!=='function'){fallback('webrtc_unavailable');return}
    config={...FALLBACK,ready:false};status();
    fallbackTimer=setTimeout(()=>{if(!ready())fallback('calibration_timeout')},4200);
    if(!isHost()){
      const announce=()=>{if(!direct())signalSend('peer_ready',{sent_at:Date.now(),refreshHz:localRefreshHz,role:role(),position:position()})};
      announce();readyTimer=setInterval(announce,500);
    }
  }

  function reset(){
    if(readyTimer)clearInterval(readyTimer);
    if(fallbackTimer)clearTimeout(fallbackTimer);
    if(healthTimer)clearInterval(healthTimer);
    pendingPings.clear();samples=[];iceQueue=[];
    try{control?.close()}catch{};try{motion?.close()}catch{};try{pc?.close()}catch{};
    control=null;motion=null;pc=null;
    negotiationStarted=false;calibrating=false;pendingConfig=null;
    config={...FALLBACK,ready:false};
    status();
  }

  return {
    version:VERSION,contract:CONTRACT,
    required:true,
    start,reset,handleSignal,send,
    ready,direct,current,
    playbackDelayMs,predictMs,motionInterval,
    applyPending
  };
}

global.CorvuMorAdaptiveLinkV1=Object.freeze({
  version:VERSION,
  contract:CONTRACT,
  requiredForCrossDeviceMotion:true,
  create
});
})(window);
