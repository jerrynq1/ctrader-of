const fs=require('fs'),vm=require('vm'),assert=require('assert');
const J=require('path').join(__dirname,'..','js')+'/';
function load(){
  const ctx={console,performance,Math,Date,JSON,Promise,Map,Set,setTimeout,clearTimeout,setInterval:()=>0,clearInterval(){},
    $:()=>({}),ld:(k,d)=>d,sv(){},C:{tf:900,sym:'X',days:2},agg:[],m1:[],ACT:[],status(){},u2s:u=>u,s2u:u=>u,
    FPM:new Map(),window:{},dl:(a)=>a,devicePixelRatio:1,document:{getElementById:()=>({})},FPD:undefined};
  vm.createContext(ctx);
  // ctrader.js dùng FPM/FPV...: khai báo như app
  vm.runInContext(fs.readFileSync(J+'ctrader.js','utf8').replace(/\bconst (\w+)=/g,'var $1=').replace(/^let /gm,'var '),ctx);
  // chỉ lấy phần helper + fpCandle + fpCoverage của footprint
  const f=fs.readFileSync(J+'orderflow-footprint.js','utf8');
  const a=f.indexOf('/* Gộp hàng giá'),b=f.indexOf('async function fpSync');
  const c=f.indexOf('/* Gom số liệu footprint'),d=f.indexOf('function drawFP(');
  const bt=fs.readFileSync(J+'orderflow-bigtrade.js','utf8');
  ctx.IND={bt:{p:[['step','',0.5],['bm','','run'],['fm','','auto'],['lv','','med'],['mn','',15],['mx','',0],['cap','',2]]}};
  ctx.pdef=d=>Object.fromEntries(d.p.map(x=>[x[0],x[2]]));
  vm.runInContext('var FPV=0;',ctx);
  vm.runInContext(bt.slice(bt.indexOf('let BTS=null;'),bt.indexOf('function drawBT(')).replace(/^let /gm,'var '),ctx);
  vm.runInContext('var FPH=0,FPLV=0,fpStart=0,fpCov=null;'+f.slice(a,b).replace(/^const /gm,'var ')+f.slice(c,d).replace(/^const /gm,'var '),ctx);
  return ctx;
}
let pass=0;const T=(n,fn)=>{try{const r=fn();if(r&&r.then)return r.then(()=>{pass++;console.log('ok  ',n)},e=>{console.log('FAIL',n,e.message);process.exitCode=1});pass++;console.log('ok  ',n)}catch(e){console.log('FAIL',n,e.message);process.exitCode=1}};
const R=x=>Math.round(x*1e5);

(async()=>{
const X=load();
// 1. phân loại hướng
T('fpStep: bảng phân loại',()=>{
  const cls=(s0,b,a)=>{const st={bid:100,ask:110,side:s0};return [X.fpStep(st,b,a),st.side]};
  assert.deepStrictEqual(cls(0,100,111),[1,1]);   // ask tăng
  assert.deepStrictEqual(cls(0,101,110),[1,1]);   // bid tăng
  assert.deepStrictEqual(cls(0,99,110),[-1,-1]);  // bid giảm
  assert.deepStrictEqual(cls(0,100,109),[-1,-1]); // ask giảm
  assert.deepStrictEqual(cls(1,100,110),[0,1]);   // không đổi => không tính
});
T('fpStep: spread nở xét mid',()=>{
  let st={bid:100,ask:110,side:-1};assert.strictEqual(X.fpStep(st,98,113),1);   // mid +0.5 => mua
  st={bid:100,ask:110,side:1};assert.strictEqual(X.fpStep(st,97,111),-1);       // mid -1 => bán
  st={bid:100,ask:110,side:1};assert.strictEqual(X.fpStep(st,98,112),1);        // mid không đổi => giữ hướng cũ
  st={bid:0,ask:0,side:0};assert.strictEqual(X.fpStep(st,100,110),0);           // sự kiện đầu: chưa có hướng
});
// 2. gộp bin
T('fpQ: hàng bằng số nguyên, không sai số float',()=>{
  assert.strictEqual(Math.floor(0.7/0.1),6);          // cách cũ dùng số thực bị sai biên hàng
  assert.strictEqual(X.fpQ(0.7,0.1),7);
  assert.strictEqual(X.fpQ(2000.25,0.5),4000);assert.strictEqual(X.fpQ(2000.5,0.5),4001);assert.strictEqual(X.fpQ(1999.99999,0.5),3999);
  assert.strictEqual(X.fpQ(0.29,0.1),2);assert.strictEqual(Math.floor(0.29/0.1+1e-9),2);
  assert.strictEqual(X.fpYp(4000,0.5),2000.25);
});
// 3. tick lịch sử mới->cũ, delta, phân trang
function mkServer(ticks,pageSize,desc=true){   // ticks: [[ts,price]] tăng dần
  return async(type,payload)=>{
    const lo=payload.fromTimestamp,hi=payload.toTimestamp;
    let sel=ticks.filter(x=>x[0]>=lo&&x[0]<=hi);
    if(desc)sel=sel.slice().reverse();
    let more=false;if(sel.length>pageSize){sel=desc?sel.slice(0,pageSize):sel.slice(0,pageSize);more=true}
    let pt=0,pp=0;const td=sel.map((x,i)=>{const o={timestamp:i?x[0]-pt:x[0],tick:i?x[1]-pp:x[1]};pt=x[0];pp=x[1];return o});
    return{tickData:td,hasMore:more};
  };
}
function ticksOf(n,seed,t0){let s=seed,t=t0,p=200000000;const o=[];for(let i=0;i<n;i++){s=(s*1103515245+12345)&0x7fffffff;t+=1+(s%900);p+=((s>>8)%5)-2;o.push([t,p])}return o}
await T('ctTicks: phân trang mới->cũ khôi phục đúng chuỗi',async()=>{
  const tk=ticksOf(500,7,1e12);X.CT.acc=1;X.CT.sym={id:1};
  // tick cùng ms: 3 tick liền nhau trong 1 ms không được mất thứ tự
  X.ctHist=mkServer(tk,40,true);
  const out=await X.ctTicks(1,tk[0][0],tk[tk.length-1][0]);
  // trang bị cắt giữa chừng: ctTicks dùng to=mn-1, có thể mất tick trùng ms ở biên; ticksOf luôn cách ≥1ms nên phải đủ 100%
  assert.strictEqual(out.length,tk.length);for(let i=0;i<tk.length;i++)assert.strictEqual(JSON.stringify(out[i]),JSON.stringify(tk[i]));
});
await T('ctTicks: server trả cũ->mới cũng đúng',async()=>{
  const tk=ticksOf(300,9,1e12);X.ctHist=mkServer(tk,50,false);
  const out=await X.ctTicks(1,tk[0][0],tk[tk.length-1][0]);
  assert.strictEqual(out.length,tk.length);for(let i=0;i<tk.length;i++)assert.strictEqual(JSON.stringify(out[i]),JSON.stringify(tk[i]));
});
// 4. lịch sử == live (cùng 1 chuỗi báo giá phải ra cùng footprint)
await T('lịch sử và live cho kết quả GIỐNG HỆT nhau',async()=>{
  const t0=Math.ceil(1.7e12/6e4)*6e4;let s=3,b=200000000,a=200030000;const ev=[];let t=t0-120000;   // 2 phút trước lo để làm khởi động
  for(let i=0;i<4000;i++){s=(s*1103515245+12345)&0x7fffffff;t+=1+(s%300);
    const r=(s>>9)%7;if(r<2)b+=(r?1:-1);else if(r<4)a+=(r===2?1:-1);else if(r===4){b+=1;a+=1}else if(r===5){b-=1;a-=1}
    if(a<b)a=b;ev.push([t,b,a])}
  const lo=t0,hi=t+1;
  // history: bid/ask tick riêng, ts cùng ms thì lấy giá cuối
  const B=ev.map(e=>[e[0],e[1]]),A=ev.map(e=>[e[0],e[2]]);
  X.ctHist=async(ty,p)=>mkServer(p.type===1?B:A,500,true)(ty,p);
  X.FPM.clear();X.ctFpReset();
  await X.ctFpWindow(lo,hi,false);
  const H=new Map(X.FPM);
  // live: nạp TOÀN BỘ chuỗi (kể cả khởi động) qua đường live
  X.FPM.clear();X.ctFpReset();X.FPL.ready=true;
  for(const [tt,bb,aa] of ev){X.ctFpTick(tt,bb,aa)}
  X.FPL.pend&&X.ctFpCommit(X.FPL.pend);X.ctFpFlush();
  let diff=0,tot=0;
  for(const [k,rows] of H){const L=X.FPM.get(k)||[];tot+=rows.reduce((q,r)=>q+r[1]+r[2],0);
    assert.strictEqual(JSON.stringify(rows),JSON.stringify(L),'phút '+k)}
  assert.ok(tot>1000,'tổng volume '+tot);
});
// 5. same-ms trong live gộp thành 1
T('live: 2 sự kiện cùng ms gộp thành 1 tick',()=>{
  X.FPM.clear();X.ctFpReset();X.FPL.ready=true;
  X.ctFpTick(1000,100,110);X.ctFpTick(60000+500,100,110);   // khởi tạo trạng thái
  X.ctFpTick(60000+900,101,110);X.ctFpTick(60000+900,101,111);X.ctFpTick(60000+901,101,111);
  X.FPL.pend&&X.ctFpCommit(X.FPL.pend);
  const tot=[...X.FPL.map.values()].reduce((q,e)=>q+e[0]+e[1],0);
  assert.strictEqual(tot,1);        // chỉ 1 tick (bid+1,ask+1 cùng ms), sự kiện 3 không đổi giá
});
T('mua đặt ở ask, bán đặt ở bid',()=>{
  X.FPM.clear();X.ctFpReset();X.FPL.ready=true;
  X.ctFpTick(100,R(2000),R(2000.3));X.ctFpTick(200,R(2000),R(2000.31));X.ctFpTick(300,R(1999.99),R(2000.31));X.ctFpTick(400,R(1999.99),R(2000.31));
  X.ctFpIdle();X.FPL.pend&&X.ctFpCommit(X.FPL.pend);
  const m=X.FPL.map;assert.strictEqual(JSON.stringify([...m.get(R(2000.31))]),'[1,0]');assert.strictEqual(JSON.stringify([...m.get(R(1999.99))]),'[0,1]');
});
// 6. fpCandle
T('fpCandle: POC hòa -> gần giữa nến; VA kiểu CME; imbalance chéo; stacked',()=>{
  const st=1;X.agg.length=0;
  const c={st:0,high:109.5,low:100,open:100,close:109};X.agg.push(c);X.C.tf=60;
  // hàng 100..109: [mua,bán] cho từng hàng, giá = hàng + 0.2
  const vol={100:[2,5],101:[3,3],102:[40,3],103:[45,2],104:[50,4],105:[10,10],106:[1,30],107:[2,35],108:[1,40],109:[1,1]};
  const rows=Object.entries(vol).map(([q,v])=>[+q+0.2,v[0],v[1]]);
  X.FPM.clear();X.FPM.set(0,rows);
  const F=X.fpCandle(c,1,{vap:70,ratio:3,imv:0,stk:3});
  const t=q=>vol[q][0]+vol[q][1];
  assert.strictEqual(F.poc,104);                      // 54 là lớn nhất
  assert.ok(F.vl<=104&&F.vh>=104);
  let sm=0;for(let q=F.vl;q<=F.vh;q++)sm+=t(q);const tot=Object.keys(vol).reduce((q,k)=>q+t(k),0);
  assert.ok(sm>=tot*.7,'VA đủ 70%: '+sm+'/'+tot);
  // bỏ 1 hàng ở mép mà vẫn ≥70% thì VA phải thu nhỏ: không dư thừa quá 2 hàng
  const imb=q=>F.imb.get(q);
  assert.ok(imb(102)[0]);                              // mua 40 vs bán@101=3 -> ≥3x
  assert.ok(imb(103)[0]&&imb(104)[0]);                 // 45 vs 3,... ; 50 vs 2
  assert.ok(imb(102)[2]&&imb(103)[2]&&imb(104)[2]);    // 3 hàng liên tiếp => stacked mua
  assert.ok(imb(106)[1]&&imb(107)[1]&&imb(108)[1]);    // bán 30,35,40 vs mua phía trên 2,1,1 => stacked bán
  assert.ok(imb(106)[3]&&imb(108)[3]);
  assert.ok(!imb(105)[0]);                              // mua 10 vs bán@104=4 -> chưa đủ 3x
  // imv lọc ô volume nhỏ
  c._fk=null;const G=X.fpCandle(c,1,{vap:70,ratio:3,imv:45,stk:3});
  assert.ok(!G.imb.get(102)[0]&&G.imb.get(103)[0]);
});
T('fpCandle: hai hàng có POC bằng nhau -> chọn hàng gần giữa nến',()=>{
  const c={st:0,high:110.9,low:100,open:100,close:110};X.agg.length=0;X.agg.push(c);
  X.FPM.clear();X.FPM.set(0,[[100.1,5,5],[105.1,5,5],[110.1,5,5]]);
  const F=X.fpCandle(c,1,{vap:70,ratio:3,imv:0,stk:0});assert.strictEqual(F.poc,105);
});
await T('fpCoverage',()=>{
  X.m1.length=0;for(let i=0;i<10;i++)X.m1.push([i*60,1,1,1,1,5]);X.FPM.clear();for(let i=0;i<7;i++)X.FPM.set(i*60,[[1,1,0]]);
  X.fpStart=0;X.fpCov=null;const c=X.fpCoverage();assert.strictEqual(c.n,9);assert.strictEqual(c.ok,7);
});

// ===== Big Trade =====
const feed=(st,evs)=>{const out=[];for(const [t,side,pr] of evs)X.btFeed(st,t,side,pr,r=>out.push(r));if(st.run)out.push(st.run);return out};
T('Big Trade: chuỗi bị cắt khi đổi chiều hoặc nghỉ quá gap',()=>{
  X.BTG.gap=300;const st={run:null};
  const rs=feed(st,[[0,1,100],[100,1,102],[350,1,104],[400,-1,90],[500,-1,88],[1000,-1,86],[1200,1,110]]);
  assert.strictEqual(rs.length,4);
  assert.deepStrictEqual(rs.map(r=>[r.side,r.v]),[[1,3],[-1,2],[-1,1],[1,1]]);   // 0,100,350 cách ≤300 => 1 chuỗi mua; đổi chiều; nghỉ 500ms cắt
  assert.strictEqual(rs[0].ps/rs[0].v,102);                                       // giá bình quân
});
T('Big Trade: gap 5000ms nối cả chuỗi',()=>{X.BTG.gap=5000;const rs=feed({run:null},[[0,1,1],[2000,1,1],[4000,1,1]]);assert.strictEqual(rs.length,1);assert.strictEqual(rs[0].v,3);X.BTG.gap=300});
await T('Big Trade: chuỗi lịch sử = chuỗi live (cùng dữ liệu)',async()=>{
  const t0=Math.ceil(1.7e12/6e4)*6e4;let s=5,b=200000000,a=200030000;const ev=[];let t=t0-120000;
  for(let i=0;i<5000;i++){s=(s*1103515245+12345)&0x7fffffff;t+=1+(s%400);const r=(s>>9)%7;if(r<2)b+=(r?1:-1);else if(r<4)a+=(r===2?1:-1);else if(r===4){b+=1;a+=1}else if(r===5){b-=1;a-=1}if(a<b)a=b;ev.push([t,b,a])}
  const B=ev.map(e=>[e[0],e[1]]),A=ev.map(e=>[e[0],e[2]]);
  X.ctHist=async(ty,p)=>mkServer(p.type===1?B:A,500,true)(ty,p);X.BTG.gap=300;
  X.FPM.clear();X.BTE.clear();X.ctFpReset();await X.ctFpWindow(t0,t+1,false);
  const H=[...X.BTE.values()].flat().sort((x,y)=>x[0]-y[0]);
  X.FPM.clear();X.BTE.clear();X.ctFpReset();X.FPL.ready=true;
  for(const [tt,bb,aa] of ev)X.ctFpTick(tt,bb,aa);X.FPL.pend&&X.ctFpCommit(X.FPL.pend);
  const Lv=[...X.BTE.values()].flat().filter(r=>r[0]>=t0+2000).sort((x,y)=>x[0]-y[0]);
  const H2=H.filter(r=>r[0]>=t0+2000&&r[0]<t-2000),L2=Lv.filter(r=>r[0]<t-2000);
  assert.ok(H2.length>200,'số chuỗi '+H2.length);
  assert.strictEqual(JSON.stringify(H2),JSON.stringify(L2));
  // tổng volume chuỗi = tổng tick trong footprint (không mất / không trùng)
  const vr=H.reduce((q,r)=>q+r[3],0);let vf=0;X.FPM.clear();X.ctFpReset();await X.ctFpWindow(t0,t+1,false);for(const rows of X.FPM.values())for(const r of rows)vf+=r[1]+r[2];
  assert.strictEqual(vr,vf);
});
T('Big Trade: chuỗi live chốt khi nghỉ quá gap',()=>{
  X.FPM.clear();X.BTE.clear();X.ctFpReset();X.FPL.ready=true;X.BTG.gap=300;
  X.ctFpTick(1000,R(2000),R(2000.3));X.ctFpTick(1100,R(2000),R(2000.31));X.ctFpTick(1200,R(2000),R(2000.32));
  X.FPL.pend&&X.ctFpCommit(X.FPL.pend);
  assert.strictEqual(X.BTE.size,0);                       // chuỗi còn đang chạy
  X.FPL.st.run.at-=1000;X.ctFpIdle();                      // nghỉ quá gap -> chốt
  const L=[...X.BTE.values()].flat();assert.strictEqual(L.length,1);assert.strictEqual(L[0][3],2);assert.strictEqual(L[0][2],1);
});
function mkBT(runs){X.BTE.clear();X.FPM.clear();X.BTS=null;const base=60*1000;runs.forEach((v,i)=>{const m=(Math.floor(i/10)+1)*60,L=X.BTE.get(m)||[];L.push([m*1000+i,2000.25,i%2?1:-1,v]);X.BTE.set(m,L);X.FPM.set(m,[[2000.25,1,1]])})}
T('Big Trade: ngưỡng tự động theo phân vị & ổn định khi có dữ liệu live',()=>{
  const runs=[];for(let i=0;i<1000;i++)runs.push(1+(i%20));      // 1..20 đều
  mkBT(runs);X.m1.length=0;X.m1.push([60*1000,1,1,1,1,1]);X.C.tf=60;
  const a={p:{}},S=X.btPrep(a);const lo=S.thr.lo;
  assert.ok(lo>=19&&lo<=21,'lo='+lo);                       // top ~1% của 1..20 => 20/21
  X.BTE.get(60)?.push([60500,2000.25,1,3]);                  // thêm 1 lệnh live: không được đổi ngưỡng
  assert.strictEqual(X.btPrep(a).thr.lo,lo);
});
T('Big Trade: thủ công Min/Max + cap + sắp xếp',()=>{
  mkBT([5,50,30,8,100,60]);X.m1.length=0;X.m1.push([0,1,1,1,1,1]);X.C.tf=600;
  const S=X.btPrep({p:{fm:'man',mn:10,mx:70,cap:2}});
  const c={st:0};X.agg.length=0;X.agg.push({st:999999},c);
  const o=X.btOf(c,S);assert.strictEqual(JSON.stringify(o.map(x=>x.v)),'[60,50]');   // 100 vượt Max, 5/8 dưới Min, cap=2 giữ 2 lớn nhất
});
T('Big Trade: chế độ lvl gộp theo mức giá trong phút, buy ở ask / sell ở bid',()=>{
  X.BTE.clear();X.FPM.clear();X.BTS=null;X.m1.length=0;X.m1.push([0,1,1,1,1,1]);X.C.tf=60;
  X.FPM.set(0,[[2000.1,20,0],[2000.3,15,7],[2000.4,0,30]]);       // step 0.5: các giá này gộp cùng hàng 4000
  const S=X.btPrep({p:{bm:'lvl',fm:'man',mn:10,mx:0,cap:0}});
  const o=X.btOf({st:0},S);const byS=Object.fromEntries(o.map(x=>[x.side,x.v]));
  assert.strictEqual(byS[1],35);assert.strictEqual(byS[-1],37);
});
console.log('\n'+pass+' kiểm tra qua');
})();
