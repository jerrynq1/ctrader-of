/* ===== Orderflow: Footprint (indicator "fpr") ===== */
const FPM=new Map();let FPV=0,fpSym="",fpLast=0,fpBusy=false,fpDays=0,fpEpoch=0,fpRetry=0;
const fpOn=()=>ACT.find(x=>x.key==="fpr"&&isOn(x)),btOn=()=>ACT.find(x=>x.key==="bt"&&isOn(x));
const fpRgb=h=>{const m=/^#?([0-9a-f]{6})$/i.exec(h||"");const n=m?parseInt(m[1],16):8421504;return(n>>16)+","+((n>>8)&255)+","+(n&255)};
const fpFm=v=>{const a=Math.abs(v);return(v<0?"-":"")+(a>=1e4?(a/1e3).toFixed(1)+"K":Math.round(a))};
const fpDy=()=>{const fa=fpOn(),ba=btOn(),sa=stOn();return Math.max(fa?fa.p.days:0,ba?ba.p.days:0,sa?sa.p.days:0)};
async function fpSync(){
  const a=fpOn()||btOn()||stOn();if(!a||fpBusy||!ctReady()||!m1.length||Date.now()<fpRetry)return;fpBusy=true;const dy=fpDy();
  try{
    if(fpSym!==C.sym||fpDays!==dy||fpEpoch!==CT.epoch){FPM.clear();fpSym=C.sym;fpDays=dy;fpEpoch=CT.epoch;fpLast=0;ctFpReset()}
    if(fpLast)return;                       // đã tải xong: phần live do ctrader.js tự cộng dồn từ tick (poll() đẩy vào FPM)
    /* Lần tải đầu: tick lịch sử theo từng cửa sổ MỚI -> CŨ (3 giờ, 6 giờ, 12 giờ, rồi 1 ngày/lần). Cửa sổ nào về là vẽ footprint ngay (FPV++).
       Cửa sổ mới nhất kết thúc ở "bây giờ" và chuyển sang chế độ live (nối tiếp từ tick cuối, không trùng, không hở). */
    const now=Date.now(),start=Math.floor((now-dy*86400e3)/6e4)*6e4,ok=()=>C.sym===fpSym&&fpDy()===fpDays&&fpEpoch===CT.epoch&&ctReady();
    let hi=now,span=3*3600e3,first=true;
    status("Đang tải tick footprint…","");
    for(;;){
      const lo=Math.max(start,Math.floor((hi-span)/6e4)*6e4);
      await ctFpWindow(lo,first?hi:hi-1,first);
      if(!ok())return;                                       // đổi mã / đổi số ngày / nối lại giữa chừng: bỏ, lần sau tải lại từ đầu
      FPV++;dirty=true;first=false;
      hi=lo;span=Math.min(span*2,86400e3);
      if(lo<=start)break;
    }
    fpLast=Math.floor(now/1000);
    status(m1.length+" nến M1 · cTrader","ok");
  }catch(e){fpRetry=Date.now()+10000;status("Lỗi tải tick footprint: "+why(e),"bad")}
  finally{fpBusy=false}
}
setInterval(fpSync,2000);
function fpCandle(c,step,vap){
  const key=step+"|"+FPV+"|"+vap;if(c._fk===key)return c._fl;
  const lv=new Map();let tot=0;
  for(let t=c.st;t<c.st+C.tf;t+=60){const r=FPM.get(t);if(!r)continue;for(const [p,b,s] of r){const q=Math.round(p/step);let e=lv.get(q);if(!e){e=[0,0];lv.set(q,e)}e[0]+=s;e[1]+=b}}
  let lo=1e12,hi=-1e12,mxs=1,mxt=1,mxd=1,poc=null,pm=-1,dpoc=null,dm=-1;
  for(const [q,e] of lv){lo=Math.min(lo,q);hi=Math.max(hi,q);const t=e[0]+e[1],d=Math.abs(e[1]-e[0]);tot+=t;mxs=Math.max(mxs,e[0],e[1]);mxt=Math.max(mxt,t);mxd=Math.max(mxd,d);if(t>pm){pm=t;poc=q}if(d>dm){dm=d;dpoc=q}}
  let vl=poc,vh=poc;
  if(poc!=null){const g=q=>{const e=lv.get(q);return e?e[0]+e[1]:0};let sm=g(poc);
    while(sm<tot*vap/100&&(vl>lo||vh<hi)){const u=vh<hi?g(vh+1):-1,d=vl>lo?g(vl-1):-1;if(u>=d){vh++;sm+=Math.max(0,u)}else{vl--;sm+=Math.max(0,d)}}}
  c._fk=key;return c._fl={lv,lo,hi,mxs,mxt,mxd,poc,dpoc,vl,vh};
}
function drawFP(w,h){
  const a=fpOn();let show=false;
  const lr=a&&agg.length?ts.getVisibleLogicalRange():null;
  if(lr){
    const Q=Object.assign(pdef(IND.fpr),a.p),base=Math.max(.0001,+Q.step||.5),i0=Math.max(0,Math.floor(lr.from)-1),i1=Math.min(agg.length-1,Math.ceil(lr.to)+1);
    const xa=ts.logicalToCoordinate(i0),xb=ts.logicalToCoordinate(i0+1),bs=xa!=null&&xb!=null?xb-xa:0;
    const last=agg[agg.length-1].close,pa=cs.priceToCoordinate(last),pb=cs.priceToCoordinate(last+base),rhB=pa!=null&&pb!=null?Math.abs(pa-pb):0;
    let kk=1;if(Q.auto!==false)for(const m of [1,2,5,10,20,50,100,200,500,1000]){kk=m;if(rhB*m>=10)break}   // gộp hàng cho tới khi mỗi hàng cao ≥ 10px
    const step=base*kk,rh=rhB*kk;
    show=bs>=26&&rh>=5;                                   // zoom đủ gần mới hiện ô, nếu không thì giữ nến thường
    if(show){
      const E=eff(),cA=cres(a,0),cB=cres(a,1),cP=a.c[2]||"#ffd700",A=fpRgb(cA),B=fpRgb(cB),ty=Q.ty,two=ty==="ab",prof=Q.md==="prof",tx=ink(),fs=Math.min(rh-2,11.5),txt=rh>=9,bw=Math.min(8,bs*.12),mono="Consolas,ui-monospace,Menlo,monospace";
      const fm=v=>{const x=Math.abs(v);if(Q.fmt==="n")return String(Math.round(x));if(Q.fmt==="k")return x>=1e3?(x/1e3).toFixed(1)+"K":String(Math.round(x));return x>=1e6?(x/1e6).toFixed(1)+"M":x>=1e4?(x/1e3).toFixed(1)+"K":String(Math.round(x))};
      const sg=v=>(v>0?"+":v<0?"-":"")+fm(v);
      const ia=(x,imb)=>Q.cm==="fade"?(Q.cc==="imb"?(imb?1:.15):.12+.88*Math.min(1,x)):(Q.cc==="imb"?(imb?1:.3):.8);
      ctx.textBaseline="middle";
      for(let i=i0;i<=i1;i++){
        const c=agg[i],xc=ts.logicalToCoordinate(i);if(xc==null)continue;
        const x0=xc-bs/2+2,cx=x0+bw/2,xs=x0+bw+2,cwid=bs-bw-(bs<40?4:6),hw=cwid/2,col=c.close>=c.open?E.up:E.dn;
        const yo=cs.priceToCoordinate(c.open),yc=cs.priceToCoordinate(c.close),yh=cs.priceToCoordinate(c.high),yl=cs.priceToCoordinate(c.low);
        if(yo==null||yc==null||yh==null||yl==null)continue;
        ctx.strokeStyle=col;ctx.beginPath();ctx.moveTo(cx,yh);ctx.lineTo(cx,yl);ctx.stroke();
        ctx.fillStyle=col;ctx.fillRect(x0,Math.min(yo,yc),bw,Math.max(1,Math.abs(yo-yc)));
        const F=fpCandle(c,step,Q.vap);if(!F.lv.size)continue;
        const ln=two?fm(F.mxs).length:ty==="vol"?fm(F.mxt).length:ty==="dl"?fm(F.mxd).length+1:Math.max(fm(F.mxd).length+1,fm(F.mxt).length),fit=((two||ty==="dv")?hw-3:cwid-4)/(ln*.62),tOK=txt&&fit>=6.5,fz=Math.min(fs,fit);
        for(let q=F.lo;q<=F.hi;q++){
          const y=cs.priceToCoordinate(q*step);if(y==null||y<-rh||y>h+rh)continue;
          const e=F.lv.get(q),yt=y-rh/2+.5,hg=Math.max(1,rh-1);
          if(!e){if(tOK&&Q.zero){ctx.globalAlpha=.45;ctx.fillStyle=tx;ctx.font=fz+"px "+mono;ctx.textAlign="center";ctx.fillText("0",xs+hw,y+1);ctx.globalAlpha=1}continue}
          const s=e[0],b=e[1],t=s+b,d=b-s,dim=(!Q.va||(q>=F.vl&&q<=F.vh))?1:(Q.vaout?.4:1);
          const dn=F.lv.get(q-1),up=F.lv.get(q+1),bi=b>0&&b>=Q.ratio*Math.max(dn?dn[0]:0,1),si=s>0&&s>=Q.ratio*Math.max(up?up[1]:0,1);
          if(Q.cm!=="none"){
            const rc=(x,wd,cl,al)=>{if(wd<=0)return;ctx.fillStyle=`rgba(${cl},${Math.min(1,al*Q.op*dim)})`;ctx.fillRect(x,yt,wd,hg)};
            if(two){
              const ai=ia(b/F.mxs,bi),bj=ia(s/F.mxs,si);
              if(prof){rc(xs+hw-hw*s/F.mxs,hw*s/F.mxs,B,bj*.9);rc(xs+hw,hw*b/F.mxs,A,ai*.9)}
              else{rc(xs,hw,B,bj);rc(xs+hw,hw,A,ai)}
            }else{
              const k=ty==="dl"?Math.abs(d)/F.mxd:t/F.mxt,x=Q.cc==="vol"?t/F.mxt:Q.cc==="dl"?Math.abs(d)/F.mxd:Q.cc==="dom"?Math.max(s,b)/F.mxs:0;
              const cl=Q.cc==="imb"?(bi&&!si?A:si&&!bi?B:(d>=0?A:B)):Q.cc==="dl"?(d>=0?A:B):(ty==="dl"?(d>=0?A:B):(b>=s?A:B));
              rc(xs,prof?cwid*Math.min(1,k):cwid,cl,prof?.9*ia(x,bi||si):ia(x,bi||si));
            }
          }
          if(Q.poc&&q===F.poc){ctx.strokeStyle=cP;ctx.lineWidth=1.5;ctx.strokeRect(xs+.5,yt,cwid-1,hg);ctx.lineWidth=1}
          if(Q.dpoc&&q===F.dpoc){ctx.strokeStyle=d>=0?cA:cB;ctx.lineWidth=1.5;ctx.strokeRect(xs+2,yt+1,cwid-4,Math.max(1,hg-2));ctx.lineWidth=1}
          if(Q.va&&Q.valn&&(q===F.vh||q===F.vl)){ctx.strokeStyle="#35b6ff";ctx.beginPath();const ly=q===F.vh?yt:yt+hg;ctx.moveTo(xs,ly);ctx.lineTo(xs+cwid,ly);ctx.stroke()}
          if(!tOK)continue;
          const a2=Math.min(1,Math.max(s,b)/F.mxs),f2=Q.dyn?Math.min(rh-1,fit,fs*(.85+.5*a2)):fz;
          const T=(v,x,al,hl,cl)=>{ctx.textAlign=al;ctx.fillStyle=cl;ctx.font=(hl?"bold ":"")+f2+"px "+mono;ctx.fillText(v,x,y+1)};
          const zs=v=>v>0?fm(v):(Q.zero?"0":"");
          ctx.globalAlpha=dim;
          if(two){T(zs(s),xs+hw-3,"right",si,si?cB:tx);T(zs(b),xs+hw+3,"left",bi,bi?cA:tx)}
          else if(ty==="vol")T(fm(t),xs+hw,"center",bi||si,tx);
          else if(ty==="dl")T(sg(d),xs+hw,"center",bi||si,d>=0?cA:cB);
          else{T(sg(d),xs+hw-3,"right",false,d>=0?cA:cB);T(fm(t),xs+hw+3,"left",false,tx)}
          ctx.globalAlpha=1;
        }
      }
    }
  }
  if(a&&agg.length){const m=!FPM.size?(fpLast?dl("Footprint: chưa có dữ liệu tick (kiểm tra kết nối cTrader)","Footprint: no tick data yet (check the cTrader connection)","Footprint：暂无 tick 数据（请检查 cTrader 连接）"):""):(!show?dl("Footprint: zoom vào để thấy các ô","Footprint: zoom in to see the cells","Footprint：放大可查看格子"):"");
    if(m){ctx.save();ctx.textAlign="right";ctx.textBaseline="top";ctx.font="12px system-ui,sans-serif";ctx.globalAlpha=.6;ctx.fillStyle=ink();ctx.fillText(m,w-10,8);ctx.restore()}}
  if(show!==!!window.FPHIDE){window.FPHIDE=show;applyCand()}     // đang hiện ô thì làm trong suốt nến gốc
}
