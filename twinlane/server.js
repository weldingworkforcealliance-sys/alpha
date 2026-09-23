import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createState} from './src/game/state.js';
import {command,step} from './src/game/engine.js';
import {STEP} from './src/game/rules.js';
const root=fileURLToPath(new URL('.',import.meta.url));
const secret=()=>randomBytes(24).toString('base64url');
export function createServer(){
  const sessions=new Map();
  const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  const server=http.createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://localhost');
      // All commands are same-origin JSON requests; no cross-origin API access.
      if(req.headers.origin && new URL(req.headers.origin).host!==req.headers.host)return json(res,403,{error:'Origin rejected'});
      if(url.pathname.startsWith('/api/')){
        let body={};
        if(req.method==='POST'){
          if(!req.headers['content-type']?.startsWith('application/json'))return json(res,415,{error:'JSON required'});
          let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4096)return json(res,413,{error:'Request too large'});}
          try{body=JSON.parse(raw);}catch{return json(res,400,{error:'Invalid JSON'});}
        }
        if(url.pathname==='/api/create' && req.method==='POST'){
          if(sessions.size>=100)return json(res,503,{error:'Session capacity reached'});
          const id=randomBytes(8).toString('hex'),host=secret(),invite=secret();
          sessions.set(id,{state:createState(),host,invite,guest:null,clients:new Set(),updated:Date.now(),rates:new Map()});
          return json(res,201,{id,token:host,invite,device:1});
        }
        const id=body.id||url.searchParams.get('id'),s=sessions.get(id);
        if(!s)return json(res,404,{error:'Session expired or not found'});
        if(url.pathname==='/api/join' && req.method==='POST'){
          if(body.invite!==s.invite)return json(res,403,{error:'Invalid invitation'});
          if(s.guest)return json(res,409,{error:'Phone B has already joined. Reconnect in its original tab.'});
          s.guest=secret();s.updated=Date.now();return json(res,200,{id,token:s.guest,device:2});
        }
        const token=req.headers.authorization?.replace(/^Bearer /,'')||url.searchParams.get('token');
        const owner=token===s.host?1:s.guest&&token===s.guest?2:0;
        if(!owner)return json(res,403,{error:'Invalid device credentials'});
        s.updated=Date.now();
        if(url.pathname==='/api/events' && req.method==='GET'){
          const same=[...s.clients].filter(c=>c.owner===owner);for(const c of same)c.res.end();
          res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','Connection':'keep-alive','X-Accel-Buffering':'no'});
          res.write(`data: ${JSON.stringify(s.state)}\n\n`);
          const client={res,owner};s.clients.add(client);req.on('close',()=>s.clients.delete(client));return;
        }
        if(url.pathname==='/api/command' && req.method==='POST'){
          const now=Date.now();if(now-(s.rates.get(owner)||0)<50)return json(res,429,{error:'Please slow down'});
          s.rates.set(owner,now);
          return command(s.state,owner,body.command)?json(res,200,{ok:true}):json(res,400,{error:'Command not allowed'});
        }
        return json(res,404,{error:'Unknown operation'});
      }
      if(req.method!=='GET')return json(res,405,{error:'GET required'});
      const name=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));
      if(name!=='index.html' && name!=='style.css' && !name.startsWith('src/'))return json(res,404,{error:'Not found'});
      const filename=path.resolve(root,name);
      if(!filename.startsWith(root+path.sep) && !filename.startsWith(root.endsWith(path.sep)?root:root+path.sep))return json(res,403,{error:'Invalid path'});
      const content=await readFile(filename);
      res.writeHead(200,{'Content-Type':name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});res.end(content);
    }catch(error){json(res,error.code==='ENOENT'?404:500,{error:error.code==='ENOENT'?'Not found':'Request failed'});}
  });
  let last=performance.now(),accumulator=0,broadcast=0;
  const timer=setInterval(()=>{
    const now=performance.now();accumulator+=Math.min(.25,(now-last)/1000);last=now;
    while(accumulator>=STEP){for(const s of sessions.values())step(s.state);accumulator-=STEP;}
    if(now-broadcast<50)return;broadcast=now;
    for(const [id,s] of sessions){
      if(!s.clients.size && Date.now()-s.updated>3600000){sessions.delete(id);continue;}
      const data=`data: ${JSON.stringify(s.state)}\n\n`;
      for(const c of s.clients){if(c.res.writableLength>65536)c.res.destroy();else c.res.write(data);}
    }
  },1000/60);
  server.on('close',()=>clearInterval(timer));return server;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.PORT||8787);createServer().listen(port,'0.0.0.0',()=>console.log(`TwinLane v2: http://localhost:${port}`));
}
