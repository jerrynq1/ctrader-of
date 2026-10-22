/* ================= CHART ================= */
let m1=[],agg=[],loading=false,busy=false,gen=0;
const COL=()=>P.theme==="dark"?{up:"#3df5c0",dn:"#ff5c8a",tx:"#c4b79a",gr:"rgba(244,201,106,.08)",bd:"rgba(244,201,106,.22)"}:{up:"#08987a",dn:"#d6336c",tx:"#7a6740",gr:"rgba(176,116,26,.1)",bd:"rgba(176,116,26,.25)"};
const chart=LightweightCharts.createChart($("chart"),{layout:{background:{color:"transparent"},textColor:"#c4b79a",fontFamily:"Space Grotesk"},rightPriceScale:{borderColor:"rgba(244,201,106,.22)"},timeScale:{timeVisible:true,secondsVisible:false},crosshair:{mode:0},autoSize:true});
const cs=chart.addCandlestickSeries({borderVisible:false});
const vs=chart.addHistogramSeries({priceFormat:{type:"volume"},priceScaleId:"vol"});
chart.priceScale("vol").applyOptions({scaleMargins:{top:.85,bottom:0}});
const PN={};                                   // id chỉ báo -> {el,ch,lg,series,raw}: mỗi chỉ báo dao động có 1 chart riêng bên dưới
const allCh=()=>[chart,...Object.values(PN).map(p=>p.ch)];
chart.subscribeCrosshairMove(p=>{const d=p.seriesData&&p.seriesData.get(cs);$("ohlc").textContent=d?`O ${d.open}   H ${d.high}   L ${d.low}   C ${d.close}`:""});
function themeChart(){
  const c=COL();
  allCh().forEach(x=>x.applyOptions({layout:{textColor:c.tx},rightPriceScale:{borderColor:c.bd},timeScale:{borderColor:c.bd}}));
  applyCand();
  if(agg.length)rebuild(false);
}
const vcol=(o,c)=>(c>=o?eff().up:eff().dn)+"55";
function status(t,c){const e=$("st");e.textContent=t;e.className="pill "+(c||"")}
/* Tải M1 theo từng cửa sổ thời gian, MỚI -> CŨ: cửa sổ đầu (1 ngày gần nhất) về là vẽ chart ngay,
   các cửa sổ cũ hơn lần lượt được nối vào bên trái (1 ngày, 2 ngày, rồi 4 ngày/lần). Mốc thời gian ở đây là UTC (giây). */
async function loadM1(){
  const g=++gen;loading=true;
  const now=Math.floor(Date.now()/1000)+120,start=now-C.days*86400-172800;
  let acc=[],hi=null,span=86400;
  try{
    status("Đang kết nối cTrader…");
    try{await ctEnsure()}catch(e){if(g===gen)status("cTrader: "+why(e),"bad");return}
    if(g!==gen)return;
    for(;;){
      status("Đang tải M1… "+acc.length+" nến");
      const top=hi===null?now:hi,lo=Math.max(start,top-span);
      const bars=await ctBars(lo,top);
      if(g!==gen)return;
      if(bars.length){acc=bars.concat(acc);m1=acc;rebuild(false)}   // hiển thị ngay phần vừa tải, không đợi phần còn lại
      hi=lo;span=Math.min(span*2,4*86400);
      if(lo<=start)break;
    }
    if(!acc.length){m1=[];rebuild(true);status("Chưa có nến cho "+C.sym+" (kiểm tra tên mã đúng với broker, hoặc thị trường chưa có dữ liệu)","bad");return}
    // bù các nến mới đóng trong lúc đang tải (poll() bị tạm dừng nối nến live khi loading) để không bị hở
    try{
      const bars=await ctBars(s2u(m1[m1.length-1][0]),Math.floor(Date.now()/1000)+120);
      if(g!==gen)return;
      let add=0;
      for(const x of bars){const l=m1[m1.length-1];if(x[0]===l[0])m1[m1.length-1]=x;else if(x[0]>l[0]){m1.push(x);add++}}
      if(add)rebuild(false);
    }catch(e){}
    status(m1.length+" nến M1 · cTrader","ok");
  }catch(e){status((acc.length?"Tải dở dang ("+acc.length+" nến) · lỗi: ":"Lỗi tải: ")+why(e),"bad")}
  finally{if(g===gen)loading=false}
}
const bucket=(t,tf)=>tf===604800?Math.floor((t-345600)/604800)*604800+345600:Math.floor(t/tf)*tf;
function rebuild(fit){
  const raw=[];let cur=null;
  for(const x of m1){
    const k=bucket(x[0],C.tf);
    if(!cur||cur.st!==k){cur={st:k,time:0,open:x[1],high:x[2],low:x[3],close:x[4],v:x[5]};raw.push(cur)}
    else{if(x[2]>cur.high)cur.high=x[2];if(x[3]<cur.low)cur.low=x[3];cur.close=x[4];cur.v+=x[5]}
  }
  // đổi sang giờ hiển thị; chart cần thời gian tăng dần, nên lúc đổi giờ mùa làm giờ lùi lại thì bỏ các nến trùng giờ
  agg=[];let lastT=-1;
  for(const b of raw){b.time=disp(b.st);if(b.time>lastT){agg.push(b);lastT=b.time}}
  cs.setData(agg);
  vs.setData(agg.map(c=>({time:c.time,value:c.v,color:vcol(c.open,c.close)})));
  if(fit)chart.timeScale().fitContent();
  renderInd();
}
function applyLive(b){
  const last=m1[m1.length-1];
  if(last&&last[0]===b[0])m1[m1.length-1]=b;else if(!last||b[0]>last[0])m1.push(b);else return;
  const k=bucket(b[0],C.tf);let o,h,l,c,v=0;
  for(let i=m1.length-1;i>=0&&m1[i][0]>=k;i--){const x=m1[i];o=x[1];c=c??x[4];h=Math.max(h??x[2],x[2]);l=Math.min(l??x[3],x[3]);v+=x[5]}
  if(o===undefined)return;
  const bar={st:k,time:disp(k),open:o,high:h,low:l,close:c,v},a=agg[agg.length-1];
  if(a&&a.st===k)agg[agg.length-1]=bar;else if(!a||bar.time>a.time)agg.push(bar);else return;
  cs.update(bar);vs.update({time:bar.time,value:v,color:vcol(o,c)});liveInd();
}
/* Mỗi 250ms: lấy giá + nến live + footprint live mà ctrader.js đã nhận qua WebSocket (cTrader tự đẩy, không cần hỏi server). */
function poll(){
  if(document.hidden||!ctReady())return;
  if(CT.quoteDirty&&CT.bid>0){
    CT.quoteDirty=false;const d=CT.sym.digits,bid=(CT.bid/1e5).toFixed(d),ask=CT.ask>0?(CT.ask/1e5).toFixed(d):"–";
    $("bid").textContent=bid;$("ask").textContent=ask;if(window.baUpdate)baUpdate(C.sym,CT.bid/1e5,CT.ask/1e5);   // đường Bid/Ask trên chart
  }
  if(CT.barDirty&&CT.liveBar&&m1.length&&!loading){CT.barDirty=false;applyLive(CT.liveBar)}
  ctFpIdle();
  if(FPL.dirty){FPL.dirty=false;ctFpFlush();FPV++;FPLV++;dirty=true}
}
function buildTfs(){$("tfs").innerHTML=TFS.map(([n,s])=>`<button class="tf${s===C.tf?" on":""}" data-s="${s}">${n}</button>`).join("")}
$("tfs").onclick=e=>{const b=e.target.closest("button");if(!b)return;C.tf=+b.dataset.s;sv("tp_tf",C.tf);buildTfs();rebuild(true)};
$("sym").value=C.sym;
$("sym").onchange=()=>{C.sym=$("sym").value.trim();sv("tp_sym",C.sym);$("bid").textContent=$("ask").textContent="–";loadM1()};
