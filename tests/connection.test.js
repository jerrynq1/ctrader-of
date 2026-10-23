/* Kiểm tra kết nối cTrader bằng WebSocket giả: (1) làn nến M1 không bị tick footprint chặn, (2) watchdog nối lại khi kết nối chết ngầm,
   (3) kết nối còn sống nhưng không có giá thì KHÔNG nối lại mà đăng ký lại spot. */
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const J=require('path').join(__dirname,'..','js')+'/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function boot(srv){
  const socks=[];
  class WS{constructor(u){this.url=u;this.readyState=0;socks.push(this);this.sent=[];setTimeout(()=>{this.readyState=1;this.onopen&&this.onopen()},1)}
    send(d){const m=JSON.parse(d);this.sent.push(m);srv.on(this,m)}
    close(){this.readyState=3}
    reply(m,type,payload){if(this.readyState===1&&!srv.dead)setTimeout(()=>this.onmessage&&this.readyState===1&&this.onmessage({data:JSON.stringify({clientMsgId:m.clientMsgId,payloadType:type,payload:payload||{}})}),srv.lat||1)}}
  const ctx={console,performance,Math,Date,JSON,Promise,Map,Set,Error,setTimeout,clearTimeout,setInterval,clearInterval,WebSocket:WS,
    ld:(k,d)=>d,sv(){},$:()=>null,C:{sym:'XAUUSD',tf:60},status(){},u2s:u=>u,s2u:u=>u,m1:[],FPM:new Map(),why:e=>e.message,
    loadM1(){ctx.reloads=(ctx.reloads||0)+1},document:{hidden:false,addEventListener(){}},
    CT_CONFIG:{clientId:'a',clientSecret:'b',accessToken:'c',accountId:7,env:'demo'}};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(J+'ctrader.js','utf8').replace(/\bconst (\w+)=/g,'var $1=').replace(/^let /gm,'var '),ctx);
  return{ctx,socks};
}
const srv=()=>({dead:false,lat:1,log:[],on(ws,m){this.log.push(m.payloadType);const R=(t,p)=>ws.reply(m,t,p);
  switch(m.payloadType){case 2100:R(2101);break;case 2102:R(2103);break;case 2104:if(!this.noVersion)R(2105);break;
    case 2114:R(2115,{symbol:[{symbolId:1,symbolName:'XAUUSD'}]});break;case 2116:R(2117,{symbol:[{digits:2}]});break;
    case 2127:R(2128);break;case 2135:R(2136);break;
    case 2137:R(2138,{trendbar:[]});break;case 2145:R(2146,{tickData:[]});break;}}});
let n=0;const ok=x=>console.log('ok  ',x,'')||n++;
(async()=>{
  // 1. làn M1 không bị 40 request tick chặn
  {const s=srv(),{ctx}=boot(s);await vm.runInContext('ctEnsure()',ctx);
   const tk=[];for(let i=0;i<40;i++)tk.push(vm.runInContext('ctHist(2145,{},"tick")',ctx));
   await sleep(300);const t0=Date.now();await vm.runInContext('ctHist(2137,{},"bar")',ctx);const dt=Date.now()-t0;
   assert(dt<900,'M1 phải xong nhanh dù đang có hàng chục request tick, thực tế '+dt+'ms');
   const pend=await Promise.race([Promise.all(tk).then(()=>0),sleep(1).then(()=>1)]);assert.strictEqual(pend,1,'tick vẫn còn đang chạy');
   ok('làn nến M1 xong sau '+dt+'ms trong khi hàng đợi tick còn dài');
   vm.runInContext('ctClose()',ctx)}
  // 2. kết nối chết ngầm -> watchdog nối lại
  {const s=srv(),{ctx,socks}=boot(s);vm.runInContext('CTW.idle=300;CTW.probe=250;CTW.every=100;',ctx);
   await vm.runInContext('ctEnsure()',ctx);assert.strictEqual(socks.length,1);s.dead=true;           // server im lặng hoàn toàn, không đóng
   await sleep(900);assert.strictEqual(vm.runInContext('CT.ready',ctx),false,'phải phát hiện chết ngầm');
   s.dead=false;await sleep(4400);assert.strictEqual(socks.length,2,'phải mở kết nối mới');assert.strictEqual(vm.runInContext('CT.ready',ctx),true);assert(ctx.reloads>=1,'phải tải lại chart');
   ok('kết nối chết ngầm: phát hiện + tự nối lại + tải lại chart');vm.runInContext('ctClose()',ctx)}
  // 3. sống nhưng không có giá: không nối lại, đăng ký lại spot
  {const s=srv(),{ctx,socks}=boot(s);vm.runInContext('CTW.idle=200;CTW.probe=250;CTW.every=100;CTW.spot=500;',ctx);
   await vm.runInContext('ctEnsure()',ctx);const before=s.log.filter(x=>x===2127).length;
   await sleep(1500);assert.strictEqual(socks.length,1,'còn sống thì không được nối lại');
   assert(s.log.filter(x=>x===2127).length>before,'phải đăng ký lại spot');assert(s.log.includes(2104),'phải có thăm dò');
   ok('kết nối sống nhưng im giá: thăm dò OK, không nối lại, đăng ký lại spot');vm.runInContext('ctClose()',ctx)}
  console.log('\n'+n+' kiểm tra kết nối qua');process.exit(0);
})().catch(e=>{console.log('FAIL',e.stack||e.message);process.exit(1)});
