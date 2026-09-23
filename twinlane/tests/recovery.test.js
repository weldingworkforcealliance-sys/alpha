import test from 'node:test';
import assert from 'node:assert/strict';
import {Session} from '../src/multiplayer/session.js';

test('new invitation wins over stale storage and expired sessions return to lobby',async()=>{
 const oldFetch=globalThis.fetch,oldStorage=globalThis.sessionStorage;
 let saved,requests=0,connected=false;
 Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:()=>saved,removeItem:()=>{saved=null;}}});
 globalThis.fetch=async()=>{requests++;return {status:404,ok:false,body:{cancel:async()=>{}}};};
 try{
  saved=JSON.stringify({id:'old',token:'old-token',device:2});
  const session=new Session(()=>{},()=>{});session.connect=()=>{connected=true;};
  assert.equal(await session.restore('new'),null);assert.equal(saved,null);assert.equal(requests,0);assert.equal(connected,false);
  saved=JSON.stringify({id:'expired',token:'expired-token',device:1});
  assert.equal(await session.restore(),null);assert.equal(saved,null);assert.equal(session.credentials,null);
  saved=JSON.stringify({id:'live',token:'guest-token',device:2});
  globalThis.fetch=async()=>({status:200,ok:true,body:{cancel:async()=>{}}});
  assert.equal((await session.restore('live')).id,'live');assert.equal(connected,true);
 }finally{globalThis.fetch=oldFetch;Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:oldStorage});}
});
