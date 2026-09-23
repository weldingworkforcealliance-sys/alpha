import {WORLD,STEP,LANES} from './rules.js';
import {createUnit} from './state.js';
// This module has no renderer, skin, browser, or networking dependencies.
export function command(state,owner,input){
  if(!input || ![1,2].includes(owner)) return false;
  if(input.type==='run' && owner===1 && typeof input.value==='boolean') state.running=input.value;
  else if(input.type==='mode' && owner===1 && ['ball','lanes'].includes(input.value)) state.mode=input.value;
  else if(input.type==='launch' && owner===1){state.ball.x=100;state.ball.vx=160;state.running=true;}
  else if(input.type==='unit' && Number.isInteger(input.lane) && input.lane>=0 && input.lane<LANES.length){
    state.units=state.units.filter(u=>u.owner!==owner);state.units.push(createUnit(owner,input.lane));
  }else return false;
  return true;
}
export function step(state,dt=STEP){
  state.tick++;state.time+=dt;
  if(!state.running)return;
  const b=state.ball;b.x+=b.vx*dt;
  if(b.x>WORLD.width-b.radius){b.x=2*(WORLD.width-b.radius)-b.x;b.vx=-Math.abs(b.vx);}
  if(b.x<b.radius){b.x=2*b.radius-b.x;b.vx=Math.abs(b.vx);}
  for(const u of state.units)u.x=Math.max(35,Math.min(965,u.x+(u.owner===1?1:-1)*u.speed*dt));
}
