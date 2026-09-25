/* Corvu Mor TwinLane Adaptive Link v1
 * Physically approved reference: Bocce commit 234b9eb3ef1a893b359fb3bb7d3c6bdb0fb420b7
 * Required for cross-screen continuous-motion games.
 */
(function(global){
'use strict';

const VERSION='1.0.0';
const FALLBACK=Object.freeze({
  mode:'realtime',
  profile:'cloud',
  direct:false,
  ready:false,
  playbackDelayMs:60,
  predictMs:55,
  motionIntervalNear:32,
  motionIntervalFar:24,
  medianRttMs:null,
  jitterMs:null,
  loss:null,
  peerRefreshHz:60,
  senderRefreshHz:60,
  peerOffsetMs:0
});

function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function median(values){
  const a=(values||[]).filter(Number.isFinite).slice().sort((x,y)=>x-y);
  if(!a.length)return null;
  const m=Math.floor(a.length/2);
  return a.length%2?a[m]:(a[m-1]+a[m])/2;
}
function percentile(values,p){
  const a=(values||[]).filter(Number.isFinite).slice().sort((x,y)=>x-y);
  if(!a.length)return null;
  const idx=(a.length-1)*p;
  const lo=Math.floor(idx),hi=Math.ceil(idx);
  if(lo===hi)return a[lo];
  return a[lo]+(a[hi]-a[lo])*(idx-lo);
}

function create(options={}){
  const sendSignal=typeof options.sendSignal==='function'?options.sendSignal:()=>{};
  const onGameEvent=typeof options.onGameEvent==='function'?options.onGameEvent:()=>{};
  const onConfig=typeof options.onConfig==='function'?options.onConfig:()=>{};
  const onStatus=typeof options.onStatus==='function'?options.onStatus:()=>{};
  const onMetric=typeof options.onMetric==='function'?options.onMetric:()=>{};
  const getIsHost=typeof options.isHost==='function'?options.isHost:()=>Boolean(options.isHost);
  const getRole=typeof options.role==='function'?options.role:()=>String(options.role||'');
  const getPosition=typeof options.position==='function'?options.position:()=>String(options.position||'');
  const getMoving=typeof options.isMoving==='function'?options.isMoving:()=>false;
  const getMotionSender=typeof options.isMotionSender==='function'?options.isMotionSender:()=>getPosition()==='first';

  let config={...FALLBACK,ready:false};
  let pendingConfig=null;
  let pc=null;
  let control=null;
  let motion=null;
  let iceQueue=[];
  let fallbackTimer=null;
  let readyTimer=null;
  let healthTimer=null;
  let negotiationStarted=false;
  let calibrationInFlight=false;
  let calibrationSamples=[];
  let pendingPings=new Map();
  let peerMeta=null;
  let localRefreshHz=60;
  let peerRefreshHz=60;
  let lastPongAt=0;

  function emitStatus(label){
    onStatus({
      label,
      config:{...config},
      version:VERSION
    });
  }

  function emitConfig(next,reason='profile'){
    onConfig({...next},{reason,version:VERSION});
    onMetric('adaptive_link_profile',{...next,reason,version:VERSION});
  }

  async function measureRefreshRate(){
    return await new Promise(resolve=>{
      const samples=[];
      let last=performance.now();
      let done=false;
      const finish=(hz)=>{
        if(done)return;
        done=true;
        resolve(clamp(Number(hz)||60,20,144));
      };
      const step=(t)=>{
        if(done)return;
        const d=t-last;last=t;
        if(d>5&&d<80)samples.push(d);
        if(samples.length>=24){
          const m=median(samples)||16.67;
          finish(1000/m);
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      setTimeout(()=>finish(60),1100);
    });
  }

  function senderRefreshHz(){
    if(getMotionSender())return localRefreshHz;
    const peer=Number(peerMeta&&peerMeta.refreshHz)||peerRefreshHz||60;
    return clamp(peer,20,144);
  }

  function chooseConfig(samples,refreshHz,expectedCount=12){
    const rtts=(samples||[]).map(s=>s.rtt).filter(Number.isFinite);
    const offsets=(samples||[]).map(s=>s.offset).filter(Number.isFinite);
    const med=median(rtts)??50;
    const p90=percentile(rtts,.90)??med;
    const jitter=Math.max(0,p90-med);
    const loss=Math.max(0,1-rtts.length/Math.max(1,expectedCount));
    const refresh=clamp(Number(refreshHz)||60,20,144);

    let profile='variable';
    let playbackDelayMs=28,predictMs=38,motionIntervalNear=24,motionIntervalFar=20;

    if(med<=18&&jitter<=6&&loss<=.08){
      profile='excellent';
      playbackDelayMs=8;predictMs=22;motionIntervalNear=16;motionIntervalFar=16;
    }else if(med<=38&&jitter<=14&&loss<=.16){
      profile='good';
      playbackDelayMs=16;predictMs=30;motionIntervalNear=20;motionIntervalFar=18;
    }else if(med<=75&&jitter<=28&&loss<=.28){
      profile='variable';
      playbackDelayMs=30;predictMs=42;motionIntervalNear=24;motionIntervalFar=22;
    }else{
      profile='poor';
      playbackDelayMs=44;predictMs=52;motionIntervalNear=28;motionIntervalFar=24;
    }

    if(refresh<=30)predictMs=Math.max(predictMs,50);
    else if(refresh<=45)predictMs=Math.max(predictMs,40);

    const frameFloor=Math.max(12,Math.round(1000/refresh));
    motionIntervalNear=Math.max(motionIntervalNear,frameFloor);
    motionIntervalFar=Math.max(motionIntervalFar,frameFloor);

    return {
      mode:'webrtc',
      profile,
      direct:true,
      ready:true,
      playbackDelayMs,
      predictMs,
      motionIntervalNear,
      motionIntervalFar,
      medianRttMs:med,
      jitterMs:jitter,
      loss,
      peerRefreshHz:refresh,
      senderRefreshHz:refresh,
      peerOffsetMs:median(offsets)??0
    };
  }

  function applyConfig(next,reason='profile'){
    if(!next)return;
    const normalized={...next,ready:true,direct:Boolean(next.direct)};
    if(getMoving()){
      pendingConfig={normalized,reason};
      return;
    }
    config=normalized;
    emitConfig(config,reason);
    emitStatus(config.direct?'direct':'fallback');
  }

  function applyPending(){
    if(!pendingConfig||getMoving())return false;
    const p=pendingConfig;
    pendingConfig=null;
    applyConfig(p.normalized,p.reason);
    return true;
  }

  function fallback(reason='fallback'){
    pendingConfig=null;
    config={...FALLBACK,ready:true};
    emitConfig(config,reason);
    emitStatus('fallback');
  }

  function closePeerOnly(){
    try{control&&control.close()}catch(e){}
    try{motion&&motion.close()}catch(e){}
    try{pc&&pc.close()}catch(e){}
    control=null;motion=null;pc=null;iceQueue=[];
  }

  function stop(){
    if(fallbackTimer)clearTimeout(fallbackTimer);
    if(readyTimer)clearInterval(readyTimer);
    if(healthTimer)clearInterval(healthTimer);
    fallbackTimer=readyTimer=healthTimer=null;
    calibrationInFlight=false;
    pendingPings.clear();
    negotiationStarted=false;
    closePeerOnly();
  }

  function peerSend(channel,event,payload){
    if(!channel||channel.readyState!=='open')return false;
    try{
      channel.send(JSON.stringify({type:'game',event,payload}));
      return true;
    }catch(e){return false}
  }

  function send(event,payload,kind='control'){
    const channel=kind==='motion'?motion:control;
    return Boolean(config.direct&&config.ready&&peerSend(channel,event,payload));
  }

  function sendPing(mode='cal'){
    if(!control||control.readyState!=='open')return;
    const id=mode+':'+Date.now()+':'+Math.random().toString(36).slice(2,8);
    const t0=Date.now();
    pendingPings.set(id,{t0,mode});
    try{control.send(JSON.stringify({type:'ping',id,t0,mode}))}catch(e){}
    setTimeout(()=>pendingPings.delete(id),1800);
  }

  function handlePeerData(raw,channelKind){
    let msg;
    try{msg=JSON.parse(raw)}catch(e){return}
    if(!msg||typeof msg!=='object')return;

    if(msg.type==='game'){
      onGameEvent(msg.event,msg.payload,'webrtc');
      return;
    }

    if(msg.type==='ping'){
      const t1=Date.now();
      try{
        control&&control.send(JSON.stringify({
          type:'pong',id:msg.id,t0:Number(msg.t0),t1,t2:Date.now(),mode:msg.mode||'cal'
        }));
      }catch(e){}
      return;
    }

    if(msg.type==='pong'){
      const pending=pendingPings.get(msg.id);
      if(!pending)return;
      pendingPings.delete(msg.id);
      const t3=Date.now(),t0=Number(msg.t0??pending.t0),t1=Number(msg.t1),t2=Number(msg.t2);
      const rtt=Math.max(0,(t3-t0)-(t2-t1));
      const offset=((t1-t0)+(t2-t3))/2;
      lastPongAt=performance.now();

      calibrationSamples.push({rtt,offset,health:msg.mode==='health'});
      if(calibrationSamples.length>24)calibrationSamples.splice(0,calibrationSamples.length-24);

      if(msg.mode==='health'&&getIsHost()){
        const health=calibrationSamples.filter(s=>s.health).slice(-6);
        if(health.length>=6){
          const next=chooseConfig(health,senderRefreshHz(),health.length);
          const meaningful=
            next.profile!==config.profile||
            !Number.isFinite(config.medianRttMs)||
            Math.abs(next.medianRttMs-config.medianRttMs)>12||
            Math.abs(next.jitterMs-config.jitterMs)>8;
          if(meaningful){
            applyConfig(next,'health');
            try{
              control&&control.send(JSON.stringify({
                type:'cal_result',
                config:{...next,peerOffsetMs:undefined},
                peerOffsetMs:next.peerOffsetMs
              }));
            }catch(e){}
          }
        }
      }
      return;
    }

    if(msg.type==='cal_meta'){
      peerMeta=msg;
      peerRefreshHz=clamp(Number(msg.refreshHz)||60,20,144);
      onMetric('adaptive_link_peer_meta',{refreshHz:peerRefreshHz,role:msg.role||'',position:msg.position||''});
      return;
    }

    if(msg.type==='cal_result'){
      const next={...msg.config};
      if(Number.isFinite(Number(msg.peerOffsetMs)))next.peerOffsetMs=Number(msg.peerOffsetMs);
      applyConfig(next,'peer');
      return;
    }
  }

  function setupChannel(channel,kind){
    if(kind==='control')control=channel;
    else motion=channel;

    channel.addEventListener('open',()=>{
      onMetric('adaptive_link_channel_open',{kind});
      if(kind==='control'){
        void measureRefreshRate().then(hz=>{
          localRefreshHz=hz;
          try{
            channel.send(JSON.stringify({
              type:'cal_meta',
              refreshHz:hz,
              role:getRole(),
              position:getPosition()
            }));
          }catch(e){}
          if(getIsHost())void beginCalibration();
        });
      }
      maybePeerReady();
    });
    channel.addEventListener('message',e=>handlePeerData(e.data,kind));
    channel.addEventListener('close',()=>{
      onMetric('adaptive_link_channel_close',{kind});
      if(config.direct)fallback('datachannel_closed');
    });
  }

  function maybePeerReady(){
    if(!control||control.readyState!=='open'||!motion||motion.readyState!=='open')return;
    if(readyTimer){clearInterval(readyTimer);readyTimer=null}
    if(fallbackTimer){clearTimeout(fallbackTimer);fallbackTimer=null}
    config={...config,direct:true,ready:false,mode:'webrtc',profile:'calibrating'};
    emitStatus('calibrating');
  }

  async function flushIce(){
    if(!pc||!pc.remoteDescription)return;
    while(iceQueue.length){
      const candidate=iceQueue.shift();
      try{await pc.addIceCandidate(candidate)}catch(e){}
    }
  }

  function ensurePeer(initiator=false){
    if(pc&&!['closed','failed'].includes(pc.connectionState))return pc;
    closePeerOnly();

    pc=new RTCPeerConnection({
      iceServers:[
        {urls:'stun:stun.cloudflare.com:3478'},
        {urls:'stun:stun.l.google.com:19302'}
      ]
    });

    pc.addEventListener('icecandidate',e=>{
      if(e.candidate)sendSignal('peer_ice',{candidate:e.candidate.toJSON?e.candidate.toJSON():e.candidate});
    });
    pc.addEventListener('datachannel',e=>{
      setupChannel(e.channel,e.channel.label==='twinlane-motion'?'motion':'control');
    });
    pc.addEventListener('connectionstatechange',()=>{
      onMetric('adaptive_link_state',{state:pc.connectionState});
      if(['failed','closed'].includes(pc.connectionState)){
        fallback('peer_'+pc.connectionState);
      }else if(pc.connectionState==='disconnected'){
        const current=pc;
        setTimeout(()=>{
          if(pc===current&&current.connectionState==='disconnected')fallback('peer_disconnected');
        },1200);
      }
    });

    if(initiator){
      setupChannel(pc.createDataChannel('twinlane-control',{ordered:true}),'control');
      setupChannel(pc.createDataChannel('twinlane-motion',{ordered:false,maxRetransmits:0}),'motion');
    }
    return pc;
  }

  async function sendOffer(){
    if(!getIsHost())return;
    const peer=ensurePeer(true);

    if(peer.signalingState==='have-local-offer'&&peer.localDescription){
      sendSignal('peer_offer',{
        sdp:peer.localDescription,
        refreshHz:localRefreshHz,
        role:getRole(),
        position:getPosition(),
        resend:true
      });
      onMetric('adaptive_link_signal',{type:'offer_resend'});
      return;
    }

    if(peer.signalingState!=='stable')return;
    try{
      const offer=await peer.createOffer();
      await peer.setLocalDescription(offer);
      sendSignal('peer_offer',{
        sdp:peer.localDescription,
        refreshHz:localRefreshHz,
        role:getRole(),
        position:getPosition()
      });
      onMetric('adaptive_link_signal',{type:'offer'});
    }catch(e){}
  }

  async function handleSignal(event,payload={}){
    if(event==='peer_ready'){
      if(Number.isFinite(Number(payload.refreshHz)))peerRefreshHz=clamp(Number(payload.refreshHz),20,144);
      onMetric('adaptive_link_signal',{type:'peer_ready',refreshHz:peerRefreshHz});
      if(getIsHost()&&!config.direct)await sendOffer();
      return true;
    }

    if(event==='peer_offer'){
      if(getIsHost())return true;
      if(Number.isFinite(Number(payload.refreshHz)))peerRefreshHz=clamp(Number(payload.refreshHz),20,144);
      const peer=ensurePeer(false);
      try{
        if(peer.signalingState==='stable'||!peer.remoteDescription){
          await peer.setRemoteDescription(payload.sdp);
        }
        await flushIce();
        if(peer.signalingState==='have-remote-offer'){
          const answer=await peer.createAnswer();
          await peer.setLocalDescription(answer);
          sendSignal('peer_answer',{
            sdp:peer.localDescription,
            refreshHz:localRefreshHz,
            role:getRole(),
            position:getPosition()
          });
          onMetric('adaptive_link_signal',{type:'answer'});
        }
      }catch(e){}
      return true;
    }

    if(event==='peer_answer'){
      if(!getIsHost()||!pc)return true;
      if(Number.isFinite(Number(payload.refreshHz)))peerRefreshHz=clamp(Number(payload.refreshHz),20,144);
      try{
        if(pc.signalingState==='have-local-offer'){
          await pc.setRemoteDescription(payload.sdp);
          await flushIce();
        }
      }catch(e){}
      return true;
    }

    if(event==='peer_ice'){
      const candidate=payload&&payload.candidate;
      if(!candidate)return true;
      if(!pc)ensurePeer(false);
      if(pc&&pc.remoteDescription){
        try{await pc.addIceCandidate(candidate)}catch(e){}
      }else{
        iceQueue.push(candidate);
      }
      return true;
    }

    return false;
  }

  async function beginCalibration(){
    if(!getIsHost()||calibrationInFlight||!control||control.readyState!=='open')return;
    calibrationInFlight=true;
    calibrationSamples=[];
    config={...config,direct:true,ready:false,profile:'calibrating'};
    emitStatus('calibrating');

    for(let i=0;i<12;i++){
      sendPing('cal');
      await new Promise(r=>setTimeout(r,85));
    }
    await new Promise(r=>setTimeout(r,220));

    const samples=calibrationSamples.filter(s=>!s.health);
    if(samples.length<5){
      const cloud={...FALLBACK,ready:true};
      config=cloud;
      try{
        control.send(JSON.stringify({type:'cal_result',config:cloud,peerOffsetMs:0}));
      }catch(e){}
      calibrationInFlight=false;
      fallback('insufficient_direct_samples');
      return;
    }

    const next=chooseConfig(samples,senderRefreshHz(),12);
    applyConfig(next,'initial');
    try{
      control.send(JSON.stringify({
        type:'cal_result',
        config:{...next,peerOffsetMs:undefined},
        peerOffsetMs:next.peerOffsetMs
      }));
    }catch(e){}

    calibrationInFlight=false;
    startHealth();
  }

  function startHealth(){
    if(healthTimer)clearInterval(healthTimer);
    lastPongAt=performance.now();
    healthTimer=setInterval(()=>{
      if(!control||control.readyState!=='open')return;
      sendPing('health');
      if(performance.now()-lastPongAt>6500)fallback('health_timeout');
    },3000);
  }

  async function start(){
    if(negotiationStarted)return;
    negotiationStarted=true;

    if(typeof RTCPeerConnection!=='function'){
      fallback('webrtc_unavailable');
      return;
    }

    void measureRefreshRate().then(hz=>{localRefreshHz=hz});
    config={...FALLBACK,ready:false};
    emitStatus('pairing');

    fallbackTimer=setTimeout(()=>{
      if(!config.direct||!config.ready)fallback('calibration_timeout');
    },4200);

    if(!getIsHost()){
      const announce=()=>{
        if(!config.direct){
          sendSignal('peer_ready',{
            sent_at:Date.now(),
            refreshHz:localRefreshHz,
            role:getRole(),
            position:getPosition()
          });
        }
      };
      announce();
      readyTimer=setInterval(announce,500);
    }
  }

  function getConfig(){return {...config}}
  function isReady(){return Boolean(config.ready)}
  function isDirect(){return Boolean(config.direct&&config.ready)}
  function motionInterval(y,farThreshold=42){
    const cfg=config.ready?config:FALLBACK;
    return Number(y)>=farThreshold?cfg.motionIntervalFar:cfg.motionIntervalNear;
  }

  return Object.freeze({
    version:VERSION,
    start,
    stop,
    send,
    handleSignal,
    getConfig,
    isReady,
    isDirect,
    applyPending,
    motionInterval,
    fallback
  });
}

global.CorvuMorAdaptiveLink=Object.freeze({
  version:VERSION,
  requiredFor:'cross-screen-continuous-motion',
  fallback:{...FALLBACK},
  create
});
})(window);
