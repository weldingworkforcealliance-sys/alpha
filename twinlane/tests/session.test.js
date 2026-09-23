import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../server.js';
test('host, guest, shared streams, authorization and reconnect',async()=>{
  const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;const controllers=[];
  async function post(action,body,token){const r=await fetch(`${base}/api/${action}`,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
  async function stream(id,token){const controller=new AbortController();controllers.push(controller);const r=await fetch(`${base}/api/events?id=${id}&token=${token}`,{signal:controller.signal});assert.equal(r.status,200);const reader=r.body.getReader();let pending='';return {controller,async next(){while(!pending.includes('\n\n')){const {value,done}=await reader.read();if(done)throw new Error('Stream closed');pending+=new TextDecoder().decode(value);}const end=pending.indexOf('\n\n'),frame=pending.slice(0,end);pending=pending.slice(end+2);return JSON.parse(frame.slice(6));}};}
  try{
    const host=(await post('create',{})).data;
    assert.equal((await post('join',{id:host.id,invite:'bad'})).status,403);
    const guest=(await post('join',{id:host.id,invite:host.invite})).data;assert.equal(guest.device,2);
    assert.equal((await post('join',{id:host.id,invite:host.invite})).status,409);
    assert.equal((await post('command',{id:host.id,command:{type:'launch'}},guest.token)).status,400);
    assert.equal((await post('command',{id:host.id,command:{type:'launch'}},'bad')).status,403);
    const a=await stream(host.id,host.token),b=await stream(host.id,guest.token);
    assert.equal((await post('command',{id:host.id,command:{type:'launch'}},host.token)).status,200);
    let sa=await a.next(),sb=await b.next();
    while(sa.tick!==sb.tick){if(sa.tick<sb.tick)sa=await a.next();else sb=await b.next();}
    assert.deepEqual(sa,sb);
    let crossed=sa;while(crossed.ball.x<520)crossed=await b.next();assert.ok(crossed.running);
    b.controller.abort();const reconnected=await stream(host.id,guest.token);const recovered=await reconnected.next();
    assert.ok(recovered.tick>=crossed.tick);assert.ok(recovered.ball.x>=crossed.ball.x);
    assert.equal((await fetch(`${base}/`)).status,200);assert.equal((await fetch(`${base}/server.js`)).status,404);
  }finally{for(const c of controllers)c.abort();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
