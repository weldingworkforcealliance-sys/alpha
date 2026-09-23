// Interpolate complete snapshots on a delayed timeline. Never simulate a second world.
export class SnapshotBuffer{
  constructor(delay=120){this.delay=delay;this.frames=[];this.lastTick=-1;}
  push(state,receivedAt){
    if(!state || state.version!==1 || !Number.isInteger(state.tick) || state.tick<=this.lastTick)return false;
    if(this.frames.length && (state.round||0)!==(this.frames.at(-1).state.round||0))this.frames=[];
    this.lastTick=state.tick;this.frames.push({state:structuredClone(state),at:receivedAt});
    if(this.frames.length>30)this.frames.shift();return true;
  }
  sample(now){
    if(!this.frames.length)return null;
    const at=now-this.delay;
    while(this.frames.length>2 && this.frames[1].at<=at)this.frames.shift();
    const a=this.frames[0],b=this.frames[1]||a;
    const t=b.at===a.at?0:Math.max(0,Math.min(1,(at-a.at)/(b.at-a.at)));
    const result=structuredClone(at>=b.at?b.state:a.state);
    // Discrete state stays on the same delayed timeline as movement.
    if(a.state.mode===b.state.mode && Math.abs(a.state.ball.x-b.state.ball.x)<100){
      result.ball.x=a.state.ball.x+(b.state.ball.x-a.state.ball.x)*t;
    }
    for(const unit of result.units){
      const ua=a.state.units.find(u=>u.id===unit.id),ub=b.state.units.find(u=>u.id===unit.id);
      if(ua&&ub&&ua.lane===ub.lane && Math.abs(ua.x-ub.x)<100)unit.x=ua.x+(ub.x-ua.x)*t;
    }
    return result;
  }
}
