/* ===== TPO Chart (Market Profile) =====
   Dữ liệu: m1 của chart chính (m1[i] = [giờ server, open, high, low, close, tickVolume]); ngày = ngày server (cắt 17:00 NY như D1), mỗi ô = 1 nến TPO (mặc định 30 phút).
   Delta Profile: có tick (FPM) thì dùng Ask/Bid thật từ tick, không có thì mô hình đường đi của giá trong nến M1 (giống volume-profile.js): đoạn lên = mua, đoạn xuống = bán.
   Value Area theo CME (so 2 hàng trên với 2 hàng dưới). Cài đặt riêng nằm ở tab "TPO Setting" (lưu ở "tp_tpo"). */
const TPO_D={cell:14,asp:1,letters:false,tick:0,per:30,va:70,days:5,cyc:12,outA:.4,stops:null,showSp:true,showExt:true,showDelta:true,showLbl:true,showOC:true};
let TPO_S={};try{TPO_S=JSON.parse(ld("tp_tpo","{}"))||{}}catch{}
const tpS=()=>Object.assign({},TPO_D,TPO_S),saveTP=()=>sv("tp_tpo",JSON.stringify(TPO_S));
const tvar=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const tpoHex=h=>{const n=parseInt(String(h).slice(1),16)||0;return[n>>16&255,n>>8&255,n&255]};
function tpoCol(){
  const s=tpS(),v=tvar,d={poc:v("--c1"),va:v("--c4"),sp:v("--c3"),buy:v("--win"),sell:v("--loss"),dpoc:v("--c2"),open:v("--ink"),close:v("--acc")},o={};
  for(const k in d)o[k]=s["c_"+k]||d[k];
  o.stops=s.stops||[v("--c1"),v("--c5"),v("--c4"),v("--c3")];o.ink=v("--ink");o.mut=v("--mut");o.line=v("--line");o.acc=v("--acc");return o;
}
function tpoPal(st,cyc,outA){   // màu ô theo thứ tự nến: nội suy vòng quanh các màu; ngoài Value Area thì nhạt đi
  const R=st.map(tpoHex),n=R.length,m=new Map();
  return(p,va)=>{const k=p*2+(va?1:0);let c=m.get(k);if(c)return c;
    const q=(p%cyc)/cyc*n,i=Math.floor(q),f=q-i,a=R[i%n],b=R[(i+1)%n],r=a.map((x,j)=>Math.round(x+(b[j]-x)*f));
    c="rgba("+r.join(",")+","+(va?.95:outA)+")";m.set(k,c);return c};
}
function tpoDay(d,B,tk,ps,vaP,useTk){
  const U=1e5,bI=Math.max(1,Math.round(tk*U)),I=x=>Math.round(x*U),clamp=(x,a,b)=>x<a?a:x>b?b:x;
  let pmin=Infinity,pmax=-Infinity,h=-Infinity,l=Infinity;
  for(const x of B){pmin=Math.min(pmin,I(x[3]));pmax=Math.max(pmax,I(x[2]));h=Math.max(h,x[2]);l=Math.min(l,x[3])}
  const b0=Math.floor(pmin/bI),n=Math.floor(pmax/bI)-b0+1,row=p=>Math.floor(p/bI)-b0,a0=d*86400;
  const per=Array.from({length:n},()=>new Set()),vol=new Float64Array(n),dl=new Float64Array(n);
  const seg=(pa,pb,v)=>{const a=Math.min(pa,pb),b=Math.max(pa,pb),len=b-a,up=pb>pa;
    for(let j=Math.floor(a/bI);j<=Math.ceil(b/bI)-1;j++){const r0=j*bI,ov=Math.min(b,r0+bI)-Math.max(a,r0);if(ov<=0)continue;const q=v*ov/len;vol[j-b0]+=q;dl[j-b0]+=up?q:-q}};
  for(const x of B){
    const p=Math.floor((x[0]-a0)/ps),L=I(x[3]),H=I(x[2]),O=I(x[1]),Cl=I(x[4]),V=x[5]>0?x[5]:0,rows=useTk?FPM.get(x[0]):null;
    for(let j=row(L);j<=row(H);j++)per[j].add(p);
    let Tm=0;if(rows)for(const r of rows)Tm+=r[1]+r[2];
    if(rows&&Tm>0){const W=V>0?V:Tm,sc=W/Tm,sp=rows.sp||0;
      for(const r of rows){
        if(r[1]>0){const j=row(clamp(I(r[0]-sp),L,H)),q=r[1]*sc;vol[j]+=q;dl[j]+=q}
        if(r[2]>0){const j=row(clamp(I(r[0]),L,H)),q=r[2]*sc;vol[j]+=q;dl[j]-=q}
      }continue}
    if(!V)continue;
    const pts=Cl>=O?[O,L,H,Cl]:[O,H,L,Cl],ln=[Math.abs(pts[1]-pts[0]),Math.abs(pts[2]-pts[1]),Math.abs(pts[3]-pts[2])],T=ln[0]+ln[1]+ln[2];
    if(!T){vol[row(O)]+=V;continue}
    for(let q=0;q<3;q++)if(ln[q]>0)seg(pts[q],pts[q+1],V*ln[q]/T);
  }
  const pl=per.map(s=>[...s].sort((a,b)=>a-b)),cnt=pl.map(a=>a.length),mid=(n-1)/2;
  let poc=0;for(let i=1;i<n;i++)if(cnt[i]>cnt[poc]||(cnt[i]===cnt[poc]&&Math.abs(i-mid)<Math.abs(poc-mid)))poc=i;
  const tg=Math.ceil(cnt.reduce((a,b)=>a+b,0)*vaP);let t=poc,b=poc,sum=cnt[poc];
  while(sum<tg&&(t<n-1||b>0)){
    const u=t<n-1?cnt[t+1]+(t+2<n?cnt[t+2]:0):-1,w=b>0?cnt[b-1]+(b>1?cnt[b-2]:0):-1;
    if(u>=w){for(let k=0;k<2&&t<n-1;k++)sum+=cnt[++t]}else{for(let k=0;k<2&&b>0;k++)sum+=cnt[--b]}
  }
  let dp=0;for(let i=1;i<n;i++)if(Math.abs(dl[i])>Math.abs(dl[dp]))dp=i;
  const sp=[];for(let i=0;i<n;){if(cnt[i]===1){let j=i;while(j+1<n&&cnt[j+1]===1)j++;if(j>i)sp.push([i,j]);i=j+1}else i++}
  const oR=clamp(row(I(B[0][1])),0,n-1),cR=clamp(row(I(B[B.length-1][4])),0,n-1);
  let tU=5;for(let i=0;i<n;i++)tU=Math.max(tU,cnt[i]+(i===oR?6:0)+(i===cR?7:0));
  return{lo:b0,bp:bI/U,n,per:pl,cnt,vol,dl,dp,poc,vl:b,vh:t,sp,oR,cR,tU,h,l,open:B[0][1],close:B[B.length-1][4],dsum:dl.reduce((a,c)=>a+c,0),vsum:vol.reduce((a,c)=>a+c,0)};
}
const TPC={sig:"",days:[],u:0,have:0};
function tpoData(){
  const s=tpS(),N=m1.length;if(!N)return null;
  const useTk=typeof FPM!=="undefined"&&FPM.size>0,x=m1[N-1],sig=[N,m1[0][0],x[0],x[2],x[3],x[4],x[5],s.tick,s.per,s.va,s.days,useTk?FPH:0,useTk?FPLV:0,pd()].join();
  if(TPC.sig===sig)return TPC;
  const g=new Map();for(const b of m1){const d=Math.floor(b[0]/86400);let a=g.get(d);if(!a)g.set(d,a=[]);a.push(b)}
  const all=[...g.keys()].sort((a,b)=>a-b),ds=all.slice(-s.days);TPC.have=all.length;
  const rg=ds.map(d=>{let h=-1e9,l=1e9;for(const b of g.get(d)){h=Math.max(h,b[2]);l=Math.min(l,b[3])}return h-l}).sort((a,b)=>a-b),mn=Math.pow(10,-pd());
  let tk=+s.tick>0?+s.tick:0;
  if(!tk){const w=Math.max(mn,rg[rg.length>>1]/70),p=Math.pow(10,Math.floor(Math.log10(w))),m=w/p;tk=(m<=1?1:m<=2?2:m<=5?5:10)*p}
  tk=Math.max(mn,tk,rg[rg.length-1]/2000);
  TPC.days=ds.map(d=>({d,T:tpoDay(d,g.get(d),tk,s.per*60,s.va/100,useTk)}));TPC.u=TPC.days.length?TPC.days[0].T.bp:tk;TPC.sig=sig;return TPC;
}
async function tpoLoad(){   // kéo thêm nến M1 cũ (giống fillLeft của chart chính nhưng theo số ngày cần xem)
  if(fillBusy||loading||m1NoMore||!m1.length||SUB()||Date.now()<fillRetry)return;
  const g=gen;fillBusy=true;
  try{const top=m1Old,lo=top-m1Span,bars=await ctBars(lo,top);if(g!==gen)return;m1Old=lo;m1Span=Math.min(m1Span*2,M1_MAXSPAN);
    if(bars.length){m1Empty=0;prependM1(bars)}else{m1Empty+=top-lo;if(m1Empty>=M1_GIVEUP)m1NoMore=true}}
  catch(e){fillRetry=Date.now()+5000}
  finally{if(g===gen)fillBusy=false;tpoRedraw()}
}
const L10=s=>window.I18N&&I18N.tr?I18N.tr(s):s;   // dịch chữ vẽ trên canvas (không nằm trong DOM nên i18n.js không tự dịch được)
const TWD={vi:["CN","T2","T3","T4","T5","T6","T7"],en:["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],zh:["日","一","二","三","四","五","六"]};
const tdl=d=>{const s=new Date(d*864e5),l=window.I18N?I18N.get():"vi";return s.toISOString().slice(5,10)+" "+(TWD[l]||TWD.vi)[s.getUTCDay()]};
const tfv=v=>v>=1e6?(v/1e6).toFixed(2)+"M":v>=1e3?(v/1e3).toFixed(1)+"K":String(Math.round(v)),tfd=v=>(v>0?"+":v<0?"-":"")+Math.round(Math.abs(v));
const tfm=(v,dc)=>Number(v).toFixed(dc);
function tpoLayout(L0,s){const DW=s.showDelta?10:0,L=[];let u=0;for(const e of L0){const w=e.T.tU+(DW?1+DW:0)+3;L.push({d:e.d,T:e.T,u,w,DW});u+=w}return{L,total:u}}
function tpoPaint(g,W,H,AX,BH,L,vw,s,K,px,ch){
  const PW=W-AX,{cw,rh,sx,cp,u}=vw,pal=tpoPal(K.stops,s.cyc,s.outA),Y=p=>H/2-(p-cp)/u*rh,dc=pd(),FN="Space Grotesk,system-ui,sans-serif",f=Math.max(8,Math.min(rh-2,11));
  g.clearRect(0,0,W,H+BH);g.textBaseline="middle";
  let step=1;for(const k of[1,2,5,10,20,50,100,200,500,1000]){step=k;if(k>=Math.ceil(34/rh))break}
  g.font="11px "+FN;g.textAlign="left";
  for(let r=Math.ceil((cp/u-H/2/rh-1)/step)*step;r<=cp/u+H/2/rh+1;r+=step){
    const y=Y(r*u);g.globalAlpha=.35;g.strokeStyle=K.line;g.beginPath();g.moveTo(0,y);g.lineTo(PW,y);g.stroke();g.globalAlpha=1;g.fillStyle=K.mut;g.fillText(tfm(r*u,dc),PW+6,y);
  }
  g.strokeStyle=K.line;g.beginPath();g.moveTo(PW,0);g.lineTo(PW,H);g.moveTo(0,H);g.lineTo(PW,H);g.stroke();
  let focus=null;const mid=sx+PW/2,labs=[];
  g.save();g.beginPath();g.rect(0,0,PW,H);g.clip();
  for(const e of L){
    const T=e.T,x0=e.u*cw-sx,tW=T.tU*cw,dW=e.DW*cw,vL=x0+tW+cw,xr=e.DW?vL+dW:x0+tW,zx=vL+dW/2;
    if(mid>=e.u*cw&&mid<(e.u+e.w)*cw)focus=e;
    if(xr<0||x0>PW)continue;
    const yTop=Y((T.lo+T.n)*T.bp)+0,yBot=Y(T.lo*T.bp),md=Math.abs(T.dl[T.dp])||1;
    g.globalAlpha=.6;g.strokeStyle=K.line;g.lineWidth=1;g.strokeRect(x0,yTop,xr-x0,yBot-yTop);
    if(e.DW){g.beginPath();g.moveTo(zx,yTop);g.lineTo(zx,yBot);g.stroke()}g.globalAlpha=1;
    for(let i=0;i<T.n;i++){
      const y=Y((T.lo+i+.5)*T.bp);if(y<-rh||y>H+rh)continue;
      const inVA=i>=T.vl&&i<=T.vh,top=y-rh/2;
      T.per[i].forEach((p,k)=>{
        const cx=x0+k*cw;g.fillStyle=pal(p,inVA);g.fillRect(cx,top,cw,rh);
        if(cw>=6&&rh>=6){g.strokeStyle="rgba(255,255,255,.55)";g.lineWidth=.6;g.strokeRect(cx+.3,top+.3,cw-.6,rh-.6);g.lineWidth=1}
        if(s.letters&&cw>=11&&rh>=11){g.font="700 "+Math.min(rh-3,13)+"px "+FN;g.fillStyle="rgba(255,255,255,.92)";g.textAlign="center";g.fillText(LET[p]||"?",cx+cw/2,y+1)}
      });
      if(s.showSp&&T.cnt[i]===1){g.strokeStyle=K.sp;g.lineWidth=1.2;g.strokeRect(x0+.5,top+.5,cw-1,rh-1);g.lineWidth=1}
      if(s.showOC){
        const w=T.cnt[i]*cw;let lx=x0+w+3;g.font="600 "+f+"px "+FN;g.textAlign="left";
        if(i===T.oR){const bh=Math.max(3,rh*.34);g.fillStyle=K.open;g.fillRect(x0,y-bh/2,w,bh);g.strokeStyle="rgba(0,0,0,.55)";g.lineWidth=.8;g.strokeRect(x0,y-bh/2,w,bh);g.lineWidth=1;
          if(cw>=5){g.fillStyle=K.open;g.fillText("◂ Open",lx,y+1);lx+=g.measureText("◂ Open").width+4}}
        if(i===T.cR&&cw>=5){g.fillStyle=K.close;g.fillText("◂ Close",lx,y+1)}
      }
      const d=T.dl[i];
      if(e.DW&&d){
        const bw=Math.max(.5,Math.abs(d)/md*dW/2);g.fillStyle=d>0?K.buy:K.sell;g.globalAlpha=.88;g.fillRect(d>0?zx:zx-bw,top+.5,bw,Math.max(1,rh-1));g.globalAlpha=1;
        if(rh>=11){const t=(d>0?"+":"-")+tfv(Math.abs(d)),lw=t.length*5.8;g.font="9px "+FN;g.fillStyle=K.mut;
          if(d>0&&zx+bw+lw+3<xr){g.textAlign="left";g.fillText(t,zx+bw+2,y+1)}else if(d<0&&zx-bw-lw-3>vL){g.textAlign="right";g.fillText(t,zx-bw-2,y+1)}}
      }
    }
    if(e.DW){
      const yd=Y((T.lo+T.dp+.5)*T.bp);g.strokeStyle=K.dpoc;g.lineWidth=2;g.beginPath();g.moveTo(vL,yd);g.lineTo(xr,yd);g.stroke();g.lineWidth=1;
      if(cw>=5){g.textAlign="center";g.font="700 10px "+FN;g.fillStyle=T.dsum>=0?K.buy:K.sell;g.fillText(tfd(T.dsum),zx,yBot+10);g.fillStyle=K.mut;g.fillText(String(Math.round(T.vsum)),zx,yBot+23)}
    }
    if(s.showLbl&&cw>=6){
      const bull=T.close>=T.open,ls=["H "+tfm(T.h,dc),"L "+tfm(T.l,dc),"VAH "+tfm((T.lo+T.vh+1)*T.bp,dc),"VAL "+tfm((T.lo+T.vl)*T.bp,dc),"POC "+tfm((T.lo+T.poc+.5)*T.bp,dc)];
      const ys=bull?yBot+4:yTop-4-ls.length*13;g.font="10px "+FN;g.textAlign="center";g.fillStyle=bull?K.buy:K.sell;g.globalAlpha=.8;
      ls.forEach((t,k)=>g.fillText(t,x0+Math.min(tW,70)/2,ys+k*13+6.5));g.globalAlpha=1;
    }
  }
  // POC / VAH / VAL / Single Print: từ mép trái cột ngày, kéo dài sang phải đến khi một ngày sau chạm mức
  L.forEach((e,i)=>{
    const T=e.T,xs=e.u*cw-sx,xe0=(e.u+e.w-3)*cw-sx,isL=i===L.length-1,bp=T.bp,lo=T.lo;
    const lv=[[(lo+T.poc+.5)*bp,K.poc,[],"POC"],[(lo+T.vh+1)*bp,K.va,[4,3],"TPO VA"],[(lo+T.vl)*bp,K.va,[4,3],"TPO VA"]];
    if(s.showSp)T.sp.forEach(([a,b])=>{if(a>0)lv.push([(lo+a)*bp,K.sp,[2,3],"Single Print"]);if(b<T.n-1)lv.push([(lo+b+1)*bp,K.sp,[2,3],"Single Print"])});
    for(const[pr,c,dsh,nm]of lv){
      let xe=isL||!s.showExt?xe0:PW+50;
      if(s.showExt)for(let j=i+1;j<L.length;j++)if(pr>=L[j].T.l&&pr<=L[j].T.h){xe=L[j].u*cw-sx;break}
      const x1=Math.max(xs,0),xv=Math.min(xe,PW);if(xv<=x1)continue;
      const y=Y(pr);g.strokeStyle=c;g.lineWidth=1.2;g.setLineDash(dsh);g.beginPath();g.moveTo(x1,y);g.lineTo(xv,y);g.stroke();g.setLineDash([]);g.lineWidth=1;
      if(xe>PW&&!isL&&xv-x1>70)labs.push([y,nm,c]);
    }
  });
  labs.sort((a,b)=>a[0]-b[0]);g.font="600 11px "+FN;g.textAlign="right";let ly=-99;
  for(const[y,t,c]of labs){if(y-ly<14)continue;ly=y;const w=g.measureText(t).width+8;g.fillStyle="rgba(10,8,24,.72)";g.fillRect(PW-w-2,y-8,w,16);g.fillStyle=c;g.fillText(t,PW-6,y+1)}
  const py=Y(px);g.strokeStyle=K.acc;g.setLineDash([4,3]);g.beginPath();g.moveTo(0,py);g.lineTo(PW,py);g.stroke();g.setLineDash([]);
  g.restore();
  g.textAlign="left";g.font="700 11px "+FN;g.fillStyle=K.acc;g.fillRect(PW,py-9,AX,18);g.fillStyle="#1a1200";g.fillText(tfm(px,dc),PW+6,py);
  g.fillStyle=K.mut;g.font="11px "+FN;g.textAlign="left";
  for(const e of L){const x0=e.u*cw-sx;if(x0+60>0&&x0<PW-40)g.fillText(tdl(e.d),Math.max(x0,4),H+BH/2)}
  if(ch&&ch[0]<PW&&ch[1]<H){
    g.save();g.strokeStyle=K.mut;g.setLineDash([3,3]);g.beginPath();g.moveTo(0,ch[1]);g.lineTo(PW,ch[1]);g.moveTo(ch[0],0);g.lineTo(ch[0],H);g.stroke();g.restore();
    g.fillStyle=K.ink;g.fillRect(PW,ch[1]-9,AX,18);g.fillStyle="#1a1200";g.font="700 11px "+FN;g.fillText(tfm(cp+(H/2-ch[1])/rh*u,dc),PW+6,ch[1]);
  }
  return focus;
}
/* ---- chart chính của tab TPO ---- */
const LET="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",TAX=66,TBH=26,TMX=24;
const tcv=$("tpoC"),tpg=tcv.getContext("2d");let TPW=0,TPH=0,TV={sx:0,cp:null,follow:true,ch:null,sym:""};
const tpoOn=()=>$("v-tpo").classList.contains("on");
function tpoMsg(t){tpg.clearRect(0,0,TPW,TPH+TBH);tpg.fillStyle=tvar("--mut");tpg.font="14px Space Grotesk,system-ui,sans-serif";tpg.textAlign="left";tpg.textBaseline="middle";tpg.fillText(L10(t),16,40);$("tpoInfo").textContent=""}
function tpoDraw(){
  if(!tpoOn()||!TPW)return;
  if(TV.sym!==C.sym){TV.sym=C.sym;TV.follow=true;TV.cp=null;$("tpoLive").classList.add("on")}
  if(SUB())return tpoMsg("TPO cần nến M1 trở lên. Hãy chọn khung từ M1 ở tab Chart.");
  const s=tpS(),D=tpoData();
  if(!D||!D.days.length)return tpoMsg(loading?"Đang tải nến…":"Chưa có nến M1 (kiểm tra kết nối cTrader ở tab Kết nối).");
  if(D.have<s.days+1&&!m1NoMore)tpoLoad();
  const cw=s.cell*s.asp,rh=s.cell,{L,total}=tpoLayout(D.days,s),PW=TPW-TAX,last=L[L.length-1],lp=m1[m1.length-1][4];
  if(TV.cp==null)TV.cp=lp;
  if(TV.follow){TV.sx=(last.u+last.w-3)*cw+TMX-PW;TV.cp=lp}
  TV.sx=Math.max(-PW*.5,Math.min(TV.sx,total*cw-PW*.4));
  const px=BA&&BA.sym===C.sym&&BA.bid>0?BA.bid:lp,K=tpoCol();
  const f=tpoPaint(tpg,TPW,TPH,TAX,TBH,L,{cw,rh,sx:TV.sx,cp:TV.cp,u:D.u},s,K,px,TV.ch),T=(f||last).T,dc=pd();
  $("tpoInfo").textContent=tdl((f||last).d)+"  O "+tfm(T.open,dc)+"  H "+tfm(T.h,dc)+"  L "+tfm(T.l,dc)+"  C "+tfm(T.close,dc)+"  ·  POC "+tfm((T.lo+T.poc+.5)*T.bp,dc)+"  VAH "+tfm((T.lo+T.vh+1)*T.bp,dc)+"  VAL "+tfm((T.lo+T.vl)*T.bp,dc)+"  ·  Δ "+tfd(T.dsum)+"  Vol "+Math.round(T.vsum)+"  ·  "+L10("ô")+" "+tfm(D.u,dc)+(T.vsum<=0?"  "+L10("(chưa có tick volume nên Δ = 0)"):"");
}
let tpoRq=0;const tpoRedraw=()=>{tpoRq||(tpoRq=requestAnimationFrame(()=>{tpoRq=0;tpoDraw()}))};
function tpoSize(){const r=$("tpoCard").getBoundingClientRect(),d=devicePixelRatio||1;if(r.width<2)return;TPW=r.width-12;TPH=r.height-12-TBH;tcv.width=TPW*d;tcv.height=(TPH+TBH)*d;tcv.style.width=TPW+"px";tcv.style.height=(TPH+TBH)+"px";tpg.setTransform(d,0,0,d,0,0);tpoRedraw()}
new ResizeObserver(tpoSize).observe($("tpoCard"));
function tpoShow(){tpoSize();$("tpoSym").textContent=C.sym+" · "+tfName(C.tf);tpoRedraw()}
function tpoZoom(cx,cy,f){
  const s=tpS(),oc=s.cell,nc=Math.max(4,Math.min(40,oc*f)),cw=oc*s.asp,ncw=nc*s.asp,u=TPC.u||1;
  TV.sx=(TV.sx+cx)/cw*ncw-cx;const p=TV.cp+(TPH/2-cy)/oc*u;TV.cp=p-(TPH/2-cy)/nc*u;TPO_S.cell=nc;tpoRedraw();
}
const tptr=new Map(),tdist=()=>{const a=[...tptr.values()];return Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1])||1};let tpd=1;
tcv.onpointerdown=e=>{TV.ch=[e.offsetX,e.offsetY];tcv.setPointerCapture(e.pointerId);tptr.set(e.pointerId,[e.offsetX,e.offsetY]);if(tptr.size===2)tpd=tdist()};
tcv.onpointermove=e=>{
  const o=tptr.get(e.pointerId);
  if(!o){if(e.pointerType==="mouse"){TV.ch=[e.offsetX,e.offsetY];tpoRedraw()}return}
  const n=[e.offsetX,e.offsetY];tptr.set(e.pointerId,n);TV.ch=n;
  if(tptr.size===1){const dx=n[0]-o[0],dy=n[1]-o[1];if(dx){TV.follow=false;$("tpoLive").classList.remove("on");TV.sx-=dx}TV.cp+=dy/tpS().cell*(TPC.u||1)}
  else if(tptr.size===2){const d=tdist(),a=[...tptr.values()];tpoZoom((a[0][0]+a[1][0])/2,(a[0][1]+a[1][1])/2,d/tpd);tpd=d}
  tpoRedraw();
};
tcv.onpointerup=tcv.onpointercancel=e=>{tptr.delete(e.pointerId);saveTP();if(e.pointerType!=="mouse"){TV.ch=null;tpoRedraw()}};
tcv.onpointerleave=()=>{TV.ch=null;tpoRedraw()};
tcv.onwheel=e=>{e.preventDefault();tpoZoom(e.offsetX,e.offsetY,Math.exp(-e.deltaY*.0015));clearTimeout(tcv._w);tcv._w=setTimeout(saveTP,400)};
const tpoLive=()=>{TV.follow=true;TV.cp=null;$("tpoLive").classList.add("on");tpoRedraw()};
tcv.ondblclick=tpoLive;$("tpoLive").onclick=tpoLive;
$("tpoZi").onclick=()=>{tpoZoom((TPW-TAX)/2,TPH/2,1.25);saveTP()};$("tpoZo").onclick=()=>{tpoZoom((TPW-TAX)/2,TPH/2,.8);saveTP()};
$("tpoSet").onclick=()=>show("tps");
setInterval(()=>{if(!document.hidden&&tpoOn()){if(TV.follow)$("tpoSym").textContent=C.sym+" · "+tfName(C.tf);tpoRedraw()}},500);
/* ---- tab TPO Setting ---- */
const TPP=[["Gexadecimal (theo theme)",null],["Cầu vồng (như mẫu)",["#e0405a","#6a3fd0","#3a46d8","#22b573"]],["Vàng đơn sắc",["#f6d77f","#e0a93b","#b87a1c","#f6d77f"]],["Xanh – Tím",["#4be0a8","#2196f3","#a98bff","#2196f3"]]];
const TPCF=[["poc","Đường POC"],["va","VAH / VAL"],["sp","Single Print"],["open","Thanh Open"],["close","Nhãn Close"],["buy","Delta mua"],["sell","Delta bán"],["dpoc","Vạch Δ lớn nhất"]];
function tpoPreview(){
  const cv=$("tpsPrev");if(!cv||!cv.offsetWidth)return;
  const d=devicePixelRatio||1,W=cv.offsetWidth,H=cv.offsetHeight,g=cv.getContext("2d"),s=Object.assign(tpS(),{cell:10,asp:tpS().asp});
  cv.width=W*d;cv.height=H*d;g.setTransform(d,0,0,d,0,0);
  const B=[];let pr=100;
  for(let k=0;k<480;k++){const o=pr,c=100+3.2*Math.sin(k/45)+1.1*Math.sin(k/9+1),hh=Math.max(o,c)+.15+.1*Math.abs(Math.sin(k)),ll=Math.min(o,c)-.15-.1*Math.abs(Math.cos(k));pr=c;B.push([k*60,o,hh,ll,c,40+(k*37)%60])}
  const T=tpoDay(0,B,.25,s.per*60,s.va/100,false),{L}=tpoLayout([{d:0,T}],s),cw=s.cell*s.asp,K=tpoCol();
  tpoPaint(g,W,H-26,TAX,26,L,{cw,rh:s.cell,sx:-8,cp:B[B.length-1][4]-1,u:T.bp},s,K,B[B.length-1][4],null);
}
function buildTPS(){
  const s=tpS(),K=tpoCol();
  const num=(l,k,mn,mx,st,h)=>`<div class="f"><label for="tp_${k}">${l}</label><input type="number" id="tp_${k}" data-n="${k}" min="${mn}" max="${mx}" step="${st}" value="${s[k]}">${h?`<small>${h}</small>`:""}</div>`;
  const chk=(l,k)=>`<div class="f"><label for="tp_${k}">${l}</label><input type="checkbox" id="tp_${k}" data-t="${k}"${s[k]?" checked":""}></div>`;
  const col=(l,k,v)=>`<div class="f"><label for="tp_${k}">${l}</label><input type="color" id="tp_${k}" data-c="${k}" value="${v}"></div>`;
  $("tpsBody").innerHTML=`<div class="grid"><div class="card"><h2>Ô TPO</h2>`+
   num("Cỡ ô (px)","cell",4,40,1,"Cũng chỉnh được bằng zoom trên chart")+num("Tỉ lệ ngang / dọc","asp",.5,2,.1,"1 = ô vuông")+chk("Hiện chữ cái trong ô","letters")+chk("Open / Close","showOC")+chk("Delta Profile (bên phải)","showDelta")+chk("Single Print","showSp")+chk("Kéo dài POC / VA / Single Print","showExt")+chk("Nhãn H / L / VAH / VAL / POC","showLbl")+
   `<h2 style="margin-top:16px">Dữ liệu</h2>`+
   `<div class="f"><label for="tp_per">Chu kỳ mỗi ô (phút)</label><select id="tp_per" data-n="per">${[15,30,60].map(v=>`<option value="${v}"${s.per===v?" selected":""}>${v}</option>`).join("")}</select></div>`+
   num("Số ngày hiển thị","days",1,15,1,"Tự tải thêm nến M1 cũ nếu thiếu")+num("Kích thước hàng giá","tick",0,1000,"any","0 = tự động (≈ 70 hàng cho 1 ngày)")+num("Value Area (%)","va",50,95,1)+
   `</div><div class="card"><h2>Xem trước</h2><canvas id="tpsPrev" style="width:100%;height:340px;display:block"></canvas>`+
   `<h2 style="margin-top:16px">Màu</h2>`+[0,1,2,3].map(i=>col("Màu ô số "+(i+1),"s"+i,K.stops[i])).join("")+
   num("Số ô cho một vòng màu","cyc",2,48,1,"Màu ô lặp lại sau chừng này nến")+num("Độ đậm ngoài Value Area","outA",.1,1,.05)+
   TPCF.map(([k,l])=>col(l,"c_"+k,K[k])).join("")+
   `<div class="bar" style="margin-top:12px">${TPP.map(([n],i)=>`<button class="btn ghost sm" data-pre="${i}">${n}</button>`).join("")}</div>`+
   `<div class="bar" style="margin-top:14px"><button class="btn ghost sm" data-reset="1">Về mặc định</button><span class="msg">Tự lưu trong trình duyệt.</span></div></div></div>`;
  tpoPreview();
}
$("tpsBody").oninput=$("tpsBody").onchange=e=>{
  const t=e.target,k=t.dataset.n||t.dataset.t||t.dataset.c;if(!k)return;
  if(t.dataset.c){if(/^s\d$/.test(k)){const st=(TPO_S.stops||tpoCol().stops).slice();st[+k[1]]=t.value;TPO_S.stops=st}else TPO_S[k]=t.value}
  else if(t.dataset.t)TPO_S[k]=t.checked;
  else{const v=+t.value;if(!isFinite(v)||t.value==="")return;TPO_S[k]=v}
  saveTP();tpoPreview();
};
$("tpsBody").onclick=e=>{
  const b=e.target.closest("[data-pre],[data-reset]");if(!b)return;
  if(b.dataset.reset)TPO_S={};else{const p=TPP[+b.dataset.pre][1];if(p)TPO_S.stops=p;else delete TPO_S.stops;for(const[k]of TPCF)delete TPO_S["c_"+k]}
  saveTP();buildTPS();
};
