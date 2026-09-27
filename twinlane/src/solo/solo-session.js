import {createState} from '../game/state.js';
import {command,step} from '../game/engine.js';
import {STEP} from '../game/rules.js';

export class SoloSession {
  constructor(onState,onStatus){
    this.onState=onState;
    this.onStatus=onStatus;
    this.credentials=null;
    this.state=null;
    this.timer=null;
    this.aiTimer=null;
    this.last=0;
    this.accumulator=0;
    this.aiLaneIndex=0;
  }

  async create(){
    this.close();
    this.state=createState();
    this.state.mode='lanes';
    this.state.running=true;
    this.credentials={id:'solo-local',device:0,solo:true};
    this.last=performance.now();
    this.accumulator=0;
    this.onStatus('Solo game active · You are Blue · Red AI is online');
    this.onState(structuredClone(this.state));

    const tick=()=>{
      if(!this.credentials)return;
      const now=performance.now();
      this.accumulator+=Math.min(.25,(now-this.last)/1000);
      this.last=now;
      while(this.accumulator>=STEP){
        step(this.state,STEP);
        this.accumulator-=STEP;
      }
      this.onState(structuredClone(this.state));
      this.timer=requestAnimationFrame(tick);
    };
    this.timer=requestAnimationFrame(tick);

    // Simple deterministic AI for testability: center, top, bottom, repeat.
    this.aiTimer=setInterval(()=>{
      if(!this.credentials||!this.state)return;
      const blue=this.state.units.find(u=>u.owner===1);
      const lane=blue ? blue.lane : [1,0,2][this.aiLaneIndex++%3];
      command(this.state,2,{type:'unit',lane});
      this.state.running=true;
    },3200);

    setTimeout(()=>{
      if(this.credentials&&this.state){
        command(this.state,2,{type:'unit',lane:1});
        this.onState(structuredClone(this.state));
      }
    },650);

    return this.credentials;
  }

  async send(input){
    if(!this.credentials||!this.state)throw new Error('Solo game is not active.');
    const ok=command(this.state,1,input);
    if(!ok)throw new Error('Command not allowed.');
    this.onState(structuredClone(this.state));
    return {ok:true,state:this.state};
  }

  async restore(){
    return null;
  }

  close(){
    if(this.timer)cancelAnimationFrame(this.timer);
    if(this.aiTimer)clearInterval(this.aiTimer);
    this.timer=null;
    this.aiTimer=null;
    this.credentials=null;
    this.state=null;
  }
}
