/* ===== Orderflow: Big Trade (indicator "bt") =====
   1 lệnh lớn = volume MUA hoặc BÁN tại 1 mức giá trong 1 phút M1 vượt ngưỡng lọc (Tự động theo phân vị, hoặc Thủ công Min/Max). */
let BTS=null;
function btPrep(a){
  const Q=Object.assign(pdef(IND.bt),a.p),step=Math.max(.0001,+Q.step||.5),live=m1.length?m1[m1.length-1][0]:0;
  const key=[C.sym,step,Q.fm,Q.lv,Q.mn,Q.mx,Q.sdk,Q.cap,FPV].join("|");
  if(BTS&&BTS.key===key)return BTS;
  const mins=new Map();
  for(const [t,r] of FPM){const m=new Map();for(const [p,b,s] of r){const q=Math.round(p/step);let e=m.get(q);if(!e){e=[0,0];m.set(q,e)}e[0]+=b;e[1]+=s}mins.set(t,m)}
  let lo,hi=Infinity;
  if(Q.fm==="man"){lo=Math.max(1,Q.mn);if(Q.mx>0)hi=Q.mx}
  else{
    const vs=[];for(const [t,m] of mins){if(t>=live)continue;for(const e of m.values()){if(e[0]>0)vs.push(e[0]);if(e[1]>0)vs.push(e[1])}}
    vs.sort((x,y)=>x-y);const pc=({low:.97,med:.99,str:.997})[Q.lv]||.99;
    lo=vs.length<50?15:Math.max(2,Math.floor(vs[Math.min(vs.length-1,Math.floor(vs.length*pc))])+1);   // chỉ lấy các mức LỚN HƠN ngưỡng phân vị (volume là số nguyên nên có nhiều mức bằng nhau)
  }
  let n=0,mean=0,mn=Infinity;
  for(const m of mins.values())for(const e of m.values())for(const v of e)if(v>=lo&&v<=hi){n++;mean+=v;if(v<mn)mn=v}
  let sd=0;if(n){mean/=n;for(const m of mins.values())for(const e of m.values())for(const v of e)if(v>=lo&&v<=hi)sd+=(v-mean)*(v-mean);sd=Math.sqrt(sd/n)}
  return BTS={key,mins,step,lo,hi,cap:Math.round(Q.cap)||0,st:{mean,sd,min:n?mn:0},n};
}
function btOf(c,S){
  if(c._bk===S.key)return c._bl;
  const out=[];
  for(let t=c.st;t<c.st+C.tf;t+=60){const m=S.mins.get(t);if(!m)continue;
    for(const [q,e] of m){if(e[0]>=S.lo&&e[0]<=S.hi)out.push({q,side:1,v:e[0]});if(e[1]>=S.lo&&e[1]<=S.hi)out.push({q,side:-1,v:e[1]})}}
  out.sort((x,y)=>y.v-x.v);if(S.cap>0&&out.length>S.cap)out.length=S.cap;c._bk=S.key;return c._bl=out;
}
function drawBT(w,h){
  const a=btOn();if(!a||!agg.length)return;
  const lr=ts.getVisibleLogicalRange();if(!lr)return;
  const Q=Object.assign(pdef(IND.bt),a.p),mono="Consolas,ui-monospace,Menlo,monospace";
  if(!FPM.size){
    if(fpLast&&!fpOn()){ctx.save();ctx.textAlign="right";ctx.textBaseline="top";ctx.font="12px system-ui,sans-serif";ctx.globalAlpha=.6;ctx.fillStyle=ink();
      ctx.fillText(dl("Big Trade: chưa có dữ liệu tick (kiểm tra kết nối cTrader)","Big Trade: no tick data yet (check the cTrader connection)","Big Trade：暂无 tick 数据（请检查 cTrader 连接）"),w-10,8);ctx.restore()}
    return;
  }
  const S=btPrep(a),step=S.step,N=Math.max(1,Math.round(Q.zbar));
  const j0=Math.max(0,Math.floor(lr.from)-1),i1=Math.min(agg.length-1,Math.ceil(lr.to)+1),i0=Math.max(0,j0-(Q.zon?N:0));
  const xa=ts.logicalToCoordinate(i0),xb=ts.logicalToCoordinate(i0+1),bs=xa!=null&&xb!=null?xb-xa:0;if(!bs)return;
  const last=agg[agg.length-1].close,pa=cs.priceToCoordinate(last),pb=cs.priceToCoordinate(last+step),rh=pa!=null&&pb!=null?Math.abs(pa-pb):0;
  const A=fpRgb(cres(a,0)),B=fpRgb(cres(a,1)),cT=a.c[2]||"#ffffff";
  // vùng ngang kéo dài N nến từ lệnh lớn
  if(Q.zon){
    const hh=Math.max(2,rh);
    for(let i=i0;i<=i1;i++){
      const c=agg[i];let L=btOf(c,S);if(!L.length)continue;
      const x0=ts.logicalToCoordinate(i);if(x0==null)continue;if(x0+N*bs<0||x0>w)continue;
      const bull=c.close>=c.open,bh=Math.max(c.open,c.close),bl=Math.min(c.open,c.close);
      L=L.filter(g=>{const pr=g.q*step,m=(pr>bh+step/2||pr<bl-step/2)?Q.zsh:Q.zbo;if(m==="none")return false;if(m==="all")return true;return m==="rev"?(bull?g.side<0:g.side>0):(bull?g.side>0:g.side<0)});
      if(Q.zbig&&L.length)L=[L[0]];
      for(const g of L){const y=cs.priceToCoordinate(g.q*step);if(y==null)continue;const cl=g.side>0?A:B;
        let e=N;if(Q.ztr){const pr=g.q*step;for(let j=1;j<=N&&i+j<agg.length;j++){const d=agg[i+j];if(d.low<=pr&&d.high>=pr){e=j;break}}}   // giá đã quay lại chạm mức này thì vùng dừng ở nến đó
        const x1=x0+e*bs;
        ctx.fillStyle=`rgba(${cl},${Q.zop})`;ctx.fillRect(x0,y-hh/2,x1-x0,hh);
        ctx.strokeStyle=`rgba(${cl},${Math.min(1,Q.zop+.35)})`;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x1,y);ctx.stroke()}
    }
  }
  // bong bóng: cỡ và độ đậm co giãn theo volume (trung bình + k×độ lệch chuẩn là to nhất)
  const vis=[],fp=!!window.FPHIDE,dx=fp?1+Math.min(8,bs*.12)/2:0;
  for(let i=j0;i<=i1;i++){
    const c=agg[i],L=btOf(c,S);if(!L.length)continue;
    const xc=ts.logicalToCoordinate(i);if(xc==null)continue;
    const yo=cs.priceToCoordinate(c.open),yc=cs.priceToCoordinate(c.close);
    for(const g of L)vis.push({g,x:xc+dx,yb0:Math.min(yo,yc),yb1:Math.max(yo,yc)});
  }
  const smax=Math.max(Q.smax,Q.smin),den=S.st.mean+Q.sdk*S.st.sd-S.st.min,fm=v=>v>=1e6?(v/1e6).toFixed(1)+"M":v>=1e4?(v/1e3).toFixed(1)+"K":String(Math.round(v));
  vis.sort((x,y)=>y.g.v-x.g.v);                                       // to vẽ trước, nhỏ vẽ đè lên
  ctx.textBaseline="middle";
  for(const o of vis){
    const g=o.g,y=cs.priceToCoordinate(g.q*step);if(y==null||y<-100||y>h+100)continue;
    const k=den>1e-6?Math.max(0,Math.min(1,(g.v-S.st.min)/den)):.5;
    let r=(Q.smin+(smax-Q.smin)*k)/2;if(fp)r=Math.min(r,Math.max(bs*.3,rh*1.6));
    const al=Math.max(0,Math.min(1,Q.omin+(Q.omax-Q.omin)*k)),cl=g.side>0?A:B;
    ctx.lineWidth=1.2;ctx.strokeStyle=`rgba(${cl},${Math.min(1,al+.3)})`;ctx.beginPath();ctx.arc(o.x,y,r,0,7);
    if(!Q.hol){ctx.fillStyle=`rgba(${cl},${al})`;ctx.fill()}
    ctx.stroke();
    if(Q.txt&&r>=Q.tsz*.8&&(!Q.ins||(y>=o.yb0&&y<=o.yb1))){ctx.fillStyle=cT;ctx.font="bold "+Q.tsz+"px "+mono;ctx.textAlign="center";ctx.fillText(fm(g.v),o.x,y+1)}
  }
  ctx.lineWidth=1;
}
