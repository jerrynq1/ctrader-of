/* Kiểm tra thuật toán TPO (tpoDay): POC, Value Area (CME), Single Print / đuôi, Poor High/Low, Initial Balance, cơ sở khối lượng, hình dạng profile.
   Chạy: node tests/tpo.test.js  — không cần mạng, không cần trình duyệt. */
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const el=()=>new Proxy(function(){},{get:(t,k)=>k==='classList'?{add(){},remove(){},contains:()=>true}:k==='getContext'?()=>new Proxy({},{get:()=>()=>({width:5})}):k==='getBoundingClientRect'?()=>({width:100,height:100}):el(),set:()=>true,apply:()=>el()});
const ctx={console,Math,JSON,Date,Map,Set,Object,String,Number,Array,Float64Array,Promise,parseInt,isFinite,
  ld:(k,d)=>d,sv(){},$:()=>el(),getComputedStyle:()=>({getPropertyValue:()=>'#fff'}),document:{documentElement:{},hidden:true,addEventListener(){},querySelector(){return null}},
  ResizeObserver:class{observe(){}},setInterval(){},setTimeout(){},clearTimeout(){},requestAnimationFrame(){return 1},devicePixelRatio:1,matchMedia:()=>({matches:false}),addEventListener(){},
  pd:()=>2,m1:[],SUB:()=>false,loading:false,C:{sym:'T',tf:60},tfName:()=>'',show(){},window:{},FPM:new Map(),BA:null,m1NoMore:false,fillBusy:false,fillRetry:0,m1Old:0,m1Span:1,gen:0};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','tpo.js'),'utf8').replace(/\bconst (\w+)=/g,'var $1=').replace(/^let /gm,'var ').replace(/\bconst (\w+),/g,'var $1,'),ctx);
const day=(B,o,tk)=>{ctx.B=B;ctx.O=o||{};ctx.TK=tk||1;return vm.runInContext('tpoDay(0,B,TK,1800,.7,false,O)',ctx)};
let n=0;const ok=x=>{console.log('ok  ',x);n++};
const PER=1800;
// các nến M1: [thời điểm, open, high, low, close, volume]; mỗi chu kỳ 30 phút = 1 nến TPO
const A=[0,10,14,10,14,10],B1=[PER,12,16,12,16,10],C=[2*PER,12,13,12,13,10];
{ const T=day([A,B1,C]);
  assert.strictEqual(JSON.stringify(Array.from(T.cnt)),JSON.stringify([1,1,3,3,2,1,1]));ok('đếm TPO theo hàng');
  assert.strictEqual(T.poc,3);ok('POC: hoà 2 hàng -> hàng gần tâm profile');
  assert.strictEqual(T.vl,1);assert.strictEqual(T.vh,5);ok('Value Area 70% theo CME (so 2 hàng trên / 2 hàng dưới)');
  assert.strictEqual(JSON.stringify(T.sp.map(x=>x.join())),JSON.stringify(['0,1,L','5,6,H']));ok('Single Print: đuôi mua (đáy) + đuôi bán (đỉnh)');
  assert.strictEqual(T.poorH,false);assert.strictEqual(T.poorL,false);ok('không Poor High/Low khi đỉnh/đáy chỉ có 1 TPO');
  assert.strictEqual(T.ibh,16);assert.strictEqual(T.ibl,10);ok('Initial Balance = cao/thấp của 2 chu kỳ đầu (60 phút)');
}
{ const T=day([A,B1,C],{spMin:3});assert.strictEqual(T.sp.length,0);ok('spMin=3: dãy 2 hàng không còn là Single Print');}
{ // IB không lấy chu kỳ sau giờ đầu; đỉnh/đáy phẳng 2 TPO -> Poor
  const T=day([[0,10,11,10,11,5],[3*PER,30,31,30,31,5],[3*PER+60,10,11,10,11,5]]);
  assert.strictEqual(T.ibh,11);assert.strictEqual(T.ibl,10);ok('IB bỏ qua nến ngoài giờ đầu');
}
{ const T=day([[0,10,12,10,12,5],[PER,10,12,10,12,5],[2*PER,10,12,10,12,5]]);
  assert.strictEqual(T.poorH,true);assert.strictEqual(T.poorL,true);assert.strictEqual(T.sp.length,0);ok('đỉnh/đáy phẳng nhiều TPO = Poor High / Poor Low');
}
{ // cơ sở khối lượng: POC theo volume, khác POC theo TPO
  const T0=day([A,B1,C]),T1=day([[0,10,14,10,14,1],[PER,12,16,12,16,1],[2*PER,12,13,12,13,1],[3*PER,16,16,16,16,5000]],{vol:true});
  assert.strictEqual(T0.byV,false);assert.strictEqual(T1.byV,true);assert.strictEqual(T1.poc,T1.n-1);ok('cơ sở Khối lượng: POC theo volume');
}
{ // hình dạng
  const mk=(c)=>{const bars=[];c.forEach((k,i)=>{for(let p=0;p<k;p++)bars.push([p*PER,10+i,10+i,10+i,10+i,1])});return bars};
  assert.strictEqual(day(mk([1,2,3,4,5,6,7,8,9,10,9])).shape,'P');ok('hình dạng P (dày phía trên)');
  assert.strictEqual(day(mk([10,9,8,7,6,5,4,3,2,1,1])).shape,'b');ok('hình dạng b (dày phía dưới)');
  assert.strictEqual(day(mk([2,4,7,10,7,3,1,1,3,7,10,7,4,2])).shape,'B');ok('hình dạng B (double distribution)');
  assert.strictEqual(day(mk([2,4,6,8,10,8,6,4,2])).shape,'D');ok('hình dạng D (chuẩn)');
}
console.log('\n'+n+' kiểm tra đạt');
// vẽ thử (canvas giả): không được ném lỗi khi bật mọi lớp mới (IB, nhãn cấu trúc, chữ cái, delta)
{ const g=new Proxy({},{get:(t,k)=>k==='measureText'?(x=>({width:String(x).length*5})):()=>{},set:()=>true});
  ctx.G=g;ctx.B=[A,B1,C];
  vm.runInContext(`(()=>{const s=Object.assign(tpS(),{cell:16,asp:1,showIB:true,showStruct:true,lt:true}),T=tpoDay(0,B,1,1800,.7,false,{}),{L}=tpoLayout([{d:0,T}],s);
    tpoPaint(G,600,300,66,26,L,{cw:16,rh:16,sx:-8,cp:13,u:T.bp},s,tpoCol(),13,null)})()`,ctx);
  ok('vẽ đầy đủ các lớp TPO không lỗi');
}
console.log(n+' kiểm tra đạt (gồm vẽ)');
