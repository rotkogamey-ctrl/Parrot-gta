// GTA Parrot — сервер. Запуск: npm install && ADMIN_PASSWORD=твойпароль npm start
const http=require('http'),fs=require('fs'),crypto=require('crypto'),{WebSocketServer}=require('ws');
const AP=process.env.ADMIN_PASSWORD||'',ADMIN='tonystark',FILE='accounts.json',PORT=process.env.PORT||8080;
let acc={};try{acc=JSON.parse(fs.readFileSync(FILE,'utf8'))}catch(e){}
const save=()=>{try{fs.writeFileSync(FILE,JSON.stringify(acc))}catch(e){}};
const hash=(p,s)=>crypto.scryptSync(p,s,32).toString('hex');
const srv=http.createServer((q,r)=>r.end('gtaparrot ok'));
const wss=new WebSocketServer({server:srv,maxPayload:2048});
const rooms=new Map();let nid=1;
const send=(w,o)=>{if(w.readyState===1)w.send(JSON.stringify(o))};
function list(){return[...rooms].map(([id,r])=>({id,name:r.name,owner:r.owner,count:r.m.size}))}
function pushList(){const l=list();wss.clients.forEach(w=>{if(w.nick)send(w,{t:'servers',l})})}
function leave(w){if(!w.room)return;const r=rooms.get(w.room);if(r){r.m.delete(w);r.t=Date.now()}w.room=null;w.pos=null;pushList()}
function join(w,id){const r=rooms.get(id);if(!r)return send(w,{t:'err',e:'Сервер не найден'});if(r.m.size>=30)return send(w,{t:'err',e:'Сервер полон'});
  leave(w);r.m.add(w);w.room=id;send(w,{t:'joined',name:r.name});pushList()}
wss.on('connection',w=>{w.id='p'+nid++;w.nick=null;w.admin=0;
 w.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch(e){return}
  if(m.t==='auth'){const n=String(m.n||'').trim().slice(0,12),p=String(m.p||'').slice(0,40),lo=n.toLowerCase();
   if(n.length<2||p.length<3)return send(w,{t:'auth',ok:0,e:'Ник от 2 знаков, пароль от 3'});
   let adm=0;
   if(lo===ADMIN){if(!AP||p!==AP)return send(w,{t:'auth',ok:0,e:'Ник занят'});adm=1}
   else{let a=acc[lo];if(!a){const s=crypto.randomBytes(8).toString('hex');acc[lo]={s,h:hash(p,s)};save()}
    else if(a.h!==hash(p,a.s))return send(w,{t:'auth',ok:0,e:'Неверный пароль или ник занят'})}
   wss.clients.forEach(x=>{if(x!==w&&x.nick&&x.nick.toLowerCase()===lo){send(x,{t:'kick'});leave(x);x.nick=null}});
   w.nick=n;w.admin=adm;send(w,{t:'auth',ok:1,admin:adm});return send(w,{t:'servers',l:list()})}
  if(!w.nick)return;
  if(m.t==='list')send(w,{t:'servers',l:list()});
  else if(m.t==='create'){const name=String(m.name||'').trim().slice(0,20);if(name.length<2||rooms.size>=100)return send(w,{t:'err',e:'Нельзя создать'});
   const id='r'+nid++;rooms.set(id,{name,owner:w.nick,m:new Set(),t:Date.now()});join(w,id)}
  else if(m.t==='join')join(w,String(m.id));
  else if(m.t==='leave')leave(w);
  else if(m.t==='pos'&&w.room&&m.d){const d=m.d;w.pos={x:+d.x||0,y:+d.y||0,z:+d.z||0,a:+d.a||0,s:(d.s|0)%4,n:w.nick}}
  else if(m.t==='adm'&&w.admin){
   if(m.c==='kick'){wss.clients.forEach(x=>{if(x.nick&&x.nick.toLowerCase()===String(m.v).toLowerCase()&&!x.admin){send(x,{t:'kick'});leave(x)}})}
   else if(m.c==='ann'){const v=String(m.v||'').slice(0,100);const to=w.room&&rooms.get(w.room);(to?to.m:wss.clients).forEach(x=>send(x,{t:'ann',v}))}
   else if(m.c==='clear'){rooms.forEach(r=>r.m.forEach(x=>{send(x,{t:'kick'});x.room=null;x.pos=null}));rooms.clear();pushList()}}
 });
 w.on('close',()=>leave(w));w.on('error',()=>{});
});
setInterval(()=>{rooms.forEach(r=>{if(r.m.size<2)return;const a=[...r.m].filter(x=>x.pos);
 r.m.forEach(w=>send(w,{t:'peers',l:a.filter(x=>x!==w).map(x=>({id:x.id,d:x.pos}))}))})},120);
setInterval(()=>{const now=Date.now();rooms.forEach((r,id)=>{if(!r.m.size&&now-r.t>1800000)rooms.delete(id)})},600000);
srv.listen(PORT,()=>console.log('port',PORT));
