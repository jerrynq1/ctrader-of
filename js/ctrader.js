/* ================= cTrader Open API (JSON qua WebSocket, chạy thẳng trên trình duyệt) =================
   Endpoint: wss://live.ctraderapi.com:5036 (hoặc demo). Thứ tự: ApplicationAuth(2100) -> AccountAuth(2102) -> SymbolsList(2114)
   -> SubscribeSpots(2127) + SubscribeLiveTrendbar(2135). Lịch sử: GetTrendbars(2137) cho nến M1, GetTickData(2145) cho footprint.
   Giá trong Open API là số nguyên theo đơn vị 1/100000. Thời gian là UTC, app quy ra "giờ server" bằng u2s() (timezone.js).
   Giới hạn: tối đa 5 request lịch sử / giây nên mọi request lịch sử đi qua hàng đợi ctHist(). */
const CT={ws:null,ready:false,pend:new Map(),id:0,hb:null,acc:0,symbols:null,sym:null,bid:0,ask:0,digits:5,
  liveBar:null,barDirty:false,tbAt:0,tkBar:null,quoteDirty:false,epoch:0,ep:null,q:Promise.resolve(),lastHist:0,subs:new Set(),fatal:"",gen:0};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function ctCfg(){
  let o={};try{o=JSON.parse(ld("tp_ct","{}"))||{}}catch{}
  const d=typeof CT_CONFIG!=="undefined"?CT_CONFIG:{},g=k=>(o[k]!==undefined&&o[k]!==""?o[k]:d[k])??"";
  return{clientId:String(g("clientId")).trim(),clientSecret:String(g("clientSecret")).trim(),accessToken:String(g("accessToken")).trim(),accountId:Math.round(+g("accountId"))||0,env:g("env")==="demo"?"demo":"live"};
}
const ctReady=()=>CT.ready&&CT.sym&&CT.sym.req===C.sym;

/* ---------- gửi / nhận ---------- */
function ctSend(type,payload,timeout){
  return new Promise((res,rej)=>{
    if(!CT.ws||CT.ws.readyState!==1)return rej(new Error("NET"));
    const id="m"+(++CT.id),t=setTimeout(()=>{CT.pend.delete(id);rej(new Error("TIMEOUT"))},timeout||30000);
    CT.pend.set(id,{res,rej,t});
    CT.ws.send(JSON.stringify({clientMsgId:id,payloadType:type,payload}));
  });
}
// request lịch sử: cách nhau ≥ 230ms (giới hạn 5 req/s), tự thử lại khi bị báo quá tần suất
function ctHist(type,payload){
  const run=async()=>{
    for(let k=0;;k++){
      const w=CT.lastHist+230-Date.now();if(w>0)await sleep(w);CT.lastHist=Date.now();
      try{return await ctSend(type,payload)}
      catch(e){if(k<4&&/FREQUENCY|RATE|BLOCKED|TOO_MANY/i.test(e.message)){await sleep(1500);continue}throw e}
    }
  };
  const p=CT.q.then(run,run);CT.q=p.catch(()=>{});return p;
}
function ctMsg(ev){
  let m;try{m=JSON.parse(ev.data)}catch{return}
  const t=m.payloadType,p=m.payload||{},q=m.clientMsgId&&CT.pend.get(m.clientMsgId);
  if(q){
    CT.pend.delete(m.clientMsgId);clearTimeout(q.t);
    if(t===2142||t===50)q.rej(new Error((p.errorCode||"ERROR")+(p.description?": "+p.description:"")));else q.res(p);
    return;
  }
  if(t===2131)ctSpot(p);
  else if(t===2147||t===2164){CT.fatal="ACCESS_TOKEN: token bị thu hồi / hết hạn";status("cTrader: "+CT.fatal,"bad")}
  else if(t===2142||t===50)console.warn("cTrader lỗi:",p.errorCode,p.description);
}

/* ---------- kết nối + đăng nhập ---------- */
function ctClose(){
  CT.gen++;CT.ready=false;clearInterval(CT.hb);CT.subs.clear();CT.sym=null;
  for(const [,q] of CT.pend){clearTimeout(q.t);q.rej(new Error("NET"))}CT.pend.clear();
  if(CT.ws){const w=CT.ws;CT.ws=null;w.onclose=w.onerror=w.onmessage=null;try{w.close()}catch{}}
}
async function ctConnect(){
  const cfg=ctCfg();
  if(!cfg.clientId||!cfg.clientSecret||!cfg.accessToken)throw new Error("CONFIG");
  ctClose();CT.fatal="";const g=CT.gen;
  const ws=new WebSocket(`wss://${cfg.env}.ctraderapi.com:5036`);CT.ws=ws;
  await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=()=>rej(new Error("NET"));setTimeout(()=>rej(new Error("NET")),15000)});
  ws.onmessage=ctMsg;ws.onerror=null;
  ws.onclose=()=>{if(g!==CT.gen)return;const was=CT.ready;ctClose();if(was){status("Mất kết nối cTrader, đang nối lại…","bad");ctRetry()}};
  CT.hb=setInterval(()=>{try{ws.send(JSON.stringify({payloadType:51,payload:{}}))}catch{}},10000);   // heartbeat
  await ctSend(2100,{clientId:cfg.clientId,clientSecret:cfg.clientSecret});
  let acc=cfg.accountId;
  if(!acc){
    const r=await ctSend(2149,{accessToken:cfg.accessToken}),L=r.ctidTraderAccount||[];
    const x=L.find(a=>!!a.isLive===(cfg.env==="live"))||L[0];
    if(!x)throw new Error("NO_ACCOUNT: token này không có tài khoản nào");
    acc=+x.ctidTraderAccountId;
  }
  await ctSend(2102,{ctidTraderAccountId:acc,accessToken:cfg.accessToken});
  CT.acc=acc;
  const r=await ctSend(2114,{ctidTraderAccountId:acc});
  CT.symbols=(r.symbol||[]).filter(s=>s.enabled!==false);
  CT.ready=true;CT.epoch++;
  try{const sl=$("symList");if(sl)sl.innerHTML=CT.symbols.map(s=>`<option value="${String(s.symbolName).replace(/"/g,"")}">`).join("")}catch{}
}
const normSym=s=>String(s||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
async function ctUseSymbol(name){
  const n=normSym(name),L=CT.symbols||[];
  let s=L.find(x=>normSym(x.symbolName)===n)||L.find(x=>normSym(x.symbolName).startsWith(n));
  if(!s)throw new Error("SYMBOL: không thấy mã '"+name+"' trong tài khoản"+(n?" (gợi ý: "+L.filter(x=>normSym(x.symbolName).includes(n.slice(0,3))).slice(0,6).map(x=>x.symbolName).join(", ")+")":""));
  const id=+s.symbolId;
  let digits=5;
  try{const r=await ctSend(2116,{ctidTraderAccountId:CT.acc,symbolId:[id]});digits=+((r.symbol||[])[0]||{}).digits||5}catch{}
  CT.sym={id,name:s.symbolName,digits,req:name};CT.bid=CT.ask=0;CT.liveBar=null;CT.tkBar=null;CT.tbAt=0;CT.barDirty=CT.quoteDirty=false;
  ctFpReset();
  if(!CT.subs.has(id)){
    await ctSend(2127,{ctidTraderAccountId:CT.acc,symbolId:[id],subscribeToSpotTimestamp:true}).catch(e=>{if(!/ALREADY/i.test(e.message))throw e});
    await ctSend(2135,{ctidTraderAccountId:CT.acc,symbolId:id,period:1}).catch(()=>{});   // nến M1 live; lỗi thì tự dựng nến từ tick
    CT.subs.add(id);
  }
}
// đảm bảo đã kết nối và đang theo dõi đúng mã C.sym (nhiều nơi gọi cùng lúc vẫn chỉ chạy 1 lần)
function ctEnsure(){
  return CT.ep||(CT.ep=(async()=>{
    if(!CT.ready)await ctConnect();
    if(!CT.sym||CT.sym.req!==C.sym)await ctUseSymbol(C.sym);
  })().finally(()=>{CT.ep=null}));
}
let ctRT=0;
function ctRetry(){
  clearTimeout(ctRT);
  ctRT=setTimeout(async()=>{
    try{await ctEnsure();loadM1()}
    catch(e){if(e.message==="NET"||e.message==="TIMEOUT"){status("Mất kết nối cTrader, đang nối lại…","bad");ctRetry()}else status("cTrader: "+why(e),"bad")}
  },4000);
}

/* ---------- giá + nến live ---------- */
const px5=v=>(+v||0)/1e5;
function tbToBar(tb){
  const lo=+tb.low||0,t=(+tb.utcTimestampInMinutes||0)*60;
  return{u:t,b:[u2s(t),px5(lo+(+tb.deltaOpen||0)),px5(lo+(+tb.deltaHigh||0)),px5(lo),px5(lo+(+tb.deltaClose||0)),+tb.volume||0]};
}
function ctSpot(p){
  const s=CT.sym;if(!s||+p.symbolId!==s.id)return;
  if(p.bid!=null)CT.bid=+p.bid;if(p.ask!=null)CT.ask=+p.ask;     // 1 sự kiện có thể chỉ chứa bid hoặc ask
  const ts=+p.timestamp||Date.now();CT.quoteDirty=true;
  if(p.trendbar&&p.trendbar.length){
    const tb=p.trendbar.find(x=>x.period==null||x.period===1||x.period==="M1");
    if(tb){CT.liveBar=tbToBar(tb).b;CT.barDirty=true;CT.tbAt=Date.now()}
  }else if(CT.bid>0&&Date.now()-CT.tbAt>4000){    // không nhận được nến live từ server: tự dựng nến M1 từ bid
    const u=Math.floor(ts/60000)*60,v=px5(CT.bid),k=CT.tkBar;
    if(k&&k.u===u){k.b[2]=Math.max(k.b[2],v);k.b[3]=Math.min(k.b[3],v);k.b[4]=v;k.b[5]++}
    else CT.tkBar={u,b:[u2s(u),v,v,v,v,1]};
    CT.liveBar=CT.tkBar.b;CT.barDirty=true;
  }
  if(CT.bid>0&&CT.ask>0)ctFpTick(ts,CT.bid,CT.ask);
}

/* ---------- nến M1 lịch sử ---------- */
// lấy nến M1 trong [lo, hi) (UTC giây), trả về [[giờ server,o,h,l,c,v],...] tăng dần
async function ctBars(lo,hi){
  const r=await ctHist(2137,{ctidTraderAccountId:CT.acc,symbolId:CT.sym.id,period:1,fromTimestamp:lo*1000,toTimestamp:hi*1000});
  if(r.hasMore&&hi-lo>120){const mid=Math.floor((lo+hi)/120)*60;return (await ctBars(lo,mid)).concat(await ctBars(mid,hi))}
  return (r.trendbar||[]).map(tbToBar).filter(x=>x.u>=lo&&x.u<hi).sort((a,b)=>a.u-b.u).map(x=>x.b);
}

/* ---------- footprint từ tick ----------
   cTrader (forex/CFD) không có giao dịch thật nên dùng tick-rule như EA cũ: ask hoặc bid tăng => MUA, giảm => BÁN, không đổi => giữ hướng cũ.
   Mỗi lần giá đổi = 1 đơn vị khối lượng, đặt tại mức BID. Kết quả mỗi phút: [[giá,mua,bán],...] vào FPM (key = giờ server). */
const FPL={ready:false,q:[],st:{bid:0,ask:0,side:0},min:0,map:null,last:0,dirty:false};
function ctFpReset(){FPL.ready=false;FPL.q=[];FPL.st={bid:0,ask:0,side:0};FPL.min=0;FPL.map=null;FPL.last=0;FPL.dirty=false}
function fpStep(st,bid,ask){
  let side=0;
  if(st.bid>0){const db=bid-st.bid,da=ask-st.ask;
    if((da>0&&db>=0)||(db>0&&da>=0))side=1;else if((da<0&&db<=0)||(db<0&&da<=0))side=-1;else side=st.side}
  st.bid=bid;st.ask=ask;if(side)st.side=side;return side;
}
const fpAdd=(map,p,side)=>{let e=map.get(p);if(!e){e=[0,0];map.set(p,e)}side>0?e[0]++:e[1]++};
const fpRows=map=>[...map].sort((a,b)=>a[0]-b[0]).map(([p,e])=>[px5(p),e[0],e[1]]);
function ctFpFlush(){if(FPL.map&&FPL.min)FPM.set(u2s(FPL.min),fpRows(FPL.map))}
function ctFpTick(ts,b,a){
  if(!FPL.ready){if(FPL.q.length<20000)FPL.q.push([ts,b,a]);return}
  if(ts<=FPL.last)return;
  FPL.last=ts;
  if(b===FPL.st.bid&&a===FPL.st.ask)return;      // sự kiện không đổi giá (vd chỉ cập nhật nến) thì không tính là tick
  const side=fpStep(FPL.st,b,a),m=Math.floor(ts/60000)*60;
  if(m!==FPL.min){ctFpFlush();FPL.min=m;FPL.map=new Map()}
  if(side)fpAdd(FPL.map,b,side);
  FPL.dirty=true;
}
// tick lịch sử của 1 loại (1=bid, 2=ask) trong [lo, hi] (ms), trả [[ts,giá],...] tăng dần. Dữ liệu là delta (phần tử đầu tuyệt đối), mới -> cũ.
async function ctTicks(type,lo,hi){
  const out=[];let from=lo,to=hi;
  for(let k=0;k<60;k++){
    const r=await ctHist(2145,{ctidTraderAccountId:CT.acc,symbolId:CT.sym.id,type,fromTimestamp:from,toTimestamp:to}),d=r.tickData||[];
    if(!d.length)break;
    let t=0,p=0;const arr=new Array(d.length);
    for(let i=0;i<d.length;i++){t+=+d[i].timestamp;p+=+d[i].tick;arr[i]=[t,p]}
    for(const x of arr)if(x[0]>=lo&&x[0]<=hi)out.push(x);
    if(!r.hasMore)break;
    const a0=arr[0][0],a1=arr[arr.length-1][0];
    if(a0>=a1)to=a1-1;else from=a0+1;          // trang kế: lùi về phía cũ hơn (hoặc tiến tới nếu server trả cũ -> mới)
  }
  return out.sort((x,y)=>x[0]-y[0]);
}
// ghép tick bid + ask thành các sự kiện [ts,bid,ask] (cùng mili-giây thì gộp làm 1)
function ctMergeTicks(B,A){
  const out=[];let i=0,j=0,b=0,a=0;
  while(i<B.length||j<A.length){
    const t=Math.min(i<B.length?B[i][0]:Infinity,j<A.length?A[j][0]:Infinity);
    while(i<B.length&&B[i][0]===t)b=B[i++][1];
    while(j<A.length&&A[j][0]===t)a=A[j++][1];
    out.push([t,b,a]);
  }
  return out;
}
/* Tải footprint cho cửa sổ [lo, hi) (ms, lo căn theo phút). newest=true: cửa sổ mới nhất (tới "bây giờ"), sau khi xong thì bật chế độ live,
   nối tiếp từ tick cuối cùng nên không trùng và không hở. Ghi thẳng vào FPM. */
async function ctFpWindow(lo,hi,newest){
  const [B,A]=await Promise.all([ctTicks(1,lo,hi),ctTicks(2,lo,hi)]);
  const ev=ctMergeTicks(B,A),st={bid:0,ask:0,side:0},M=new Map();let last=0;
  for(const [t,b,a] of ev){
    last=t;if(b<=0||a<=0)continue;
    const side=fpStep(st,b,a);if(!side)continue;
    const m=Math.floor(t/60000)*60;let mp=M.get(m);if(!mp){mp=new Map();M.set(m,mp)}fpAdd(mp,b,side);
  }
  if(newest){                                       // phút đang chạy dở giữ lại để live cộng tiếp
    FPL.st=st;FPL.last=last;FPL.min=last?Math.floor(last/60000)*60:0;FPL.map=FPL.min?(M.get(FPL.min)||new Map()):null;
    FPL.ready=true;
    const q=FPL.q;FPL.q=[];for(const [t,b,a] of q)ctFpTick(t,b,a);
  }
  for(const [m,mp] of M)FPM.set(u2s(m),fpRows(mp));
  return ev.length;
}
