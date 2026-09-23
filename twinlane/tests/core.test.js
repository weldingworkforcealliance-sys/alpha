import test from 'node:test';
import assert from 'node:assert/strict';
import {createState} from '../src/game/state.js';
import {step,command} from '../src/game/engine.js';
import {viewport,worldToLocal,visible} from '../src/multiplayer/device-layout.js';
import {SnapshotBuffer} from '../src/multiplayer/sync.js';
import {resolveSkin,categories} from '../src/skins/registry.js';
import {isUnlocked} from '../src/commerce/entitlements.js';
test('one world crosses touching portrait edges without changing coordinates',()=>{
  const s=createState();s.ball.x=495;s.running=true;for(let i=0;i<4;i++)step(s);
  assert.ok(s.ball.x>500);assert.equal(worldToLocal({x:500,y:400},1,390,624).x,390);
  assert.equal(worldToLocal({x:500,y:400},2,390,624).x,0);
  assert.equal(worldToLocal({x:505,y:400},2,390,624).x,3.9);
  assert.deepEqual(viewport(1),{x0:0,x1:500,y0:0,y1:800});
  assert.deepEqual(viewport(2),{x0:500,x1:1000,y0:0,y1:800});
  assert.equal(visible({x:520,radius:14},1),false);assert.equal(visible({x:520,radius:14},2),true);
});
test('server validates owners, lane choices and host-only commands',()=>{
  const s=createState();assert.equal(command(s,2,{type:'launch'}),false);
  assert.equal(command(s,1,{type:'unit',lane:3}),false);
  assert.equal(command(s,1,{type:'unit',lane:0}),true);assert.equal(command(s,2,{type:'unit',lane:2}),true);
  command(s,1,{type:'run',value:true});for(let i=0;i<420;i++)step(s);
  assert.ok(s.units[0].x>500);assert.ok(s.units[1].x<500);assert.equal(s.units[0].y,180);assert.equal(s.units[1].y,620);
});
test('skin fallback, locks, preview and running world invariance',()=>{
  const s=createState();command(s,1,{type:'launch'});command(s,2,{type:'unit',lane:1});step(s);
  const before=structuredClone(s),base=resolveSkin('living-kingdoms'),preview=resolveSkin('ironhold',{devPreview:true});
  assert.equal(resolveSkin('invalid').id,base.id);assert.equal(resolveSkin('ironhold').id,base.id);
  assert.equal(isUnlocked('living-kingdoms'),true);assert.equal(isUnlocked('ironhold'),false);
  assert.notEqual(preview.assets.terrain,base.assets.terrain);assert.equal(preview.assets.blueUnit,base.assets.blueUnit);
  for(const key of categories)assert.ok(key in preview.assets);
  assert.deepEqual(s,before);const reference=structuredClone(before);step(s);step(reference);assert.deepEqual(s,reference);
});
test('buffer rejects stale snapshots, tolerates jitter and freezes during disconnect',()=>{
  const buffer=new SnapshotBuffer(120),a=createState();a.tick=1;a.ball.x=490;
  buffer.push(a,1000);const b=structuredClone(a);b.tick=2;b.ball.x=510;buffer.push(b,1100);
  assert.equal(buffer.push(a,1150),false);assert.equal(buffer.sample(1170).ball.x,500);
  assert.equal(buffer.sample(9000).ball.x,510);assert.equal(b.ball.x,510);
  const c=structuredClone(b);c.tick=100;c.ball.x=600;buffer.push(c,9100);assert.equal(buffer.sample(9300).ball.x,600);
});
