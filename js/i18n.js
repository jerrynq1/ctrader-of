/* ===== i18n: Tiếng Việt (gốc) / English / 中文 =====
   Văn bản gốc trong app là tiếng Việt; file này dịch giao diện bằng bảng tra trong i18n-data.js (T / RULES / PARTS).
   Phải nạp SAU i18n-data.js và sau các file chính của app. */
(function(){
const {LANGS,T,VIO,PARTS,NM,RULES}=window.I18N_DATA;

/* ---------- Lõi ---------- */
const MAP=new Map(T.map(r=>[r[0],r]));
let lang=null;try{lang=localStorage.getItem("gx-lang")||localStorage.getItem("tp_lang")}catch(e){}
if(!LANGS.some(l=>l[0]===lang)){const n=(navigator.language||"").toLowerCase();lang=n.startsWith("zh")?"zh":n.startsWith("vi")?"vi":"en"}
const ix=()=>lang==="zh"?2:1;
const CACHE={en:new Map(),zh:new Map()};
const VIRE=/[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
const ps=s=>{let o=s;for(const p of PARTS)if(o.indexOf(p[0])>=0)o=o.split(p[0]).join(p[ix()]);return o};
function tx(core){
  if(lang==="vi")return VIO.get(core)??null;if(!/[A-Za-zÀ-ỹ]/.test(core))return null;
  const c=CACHE[lang];if(c.has(core))return c.get(core);
  let r=null;const e=MAP.get(core);
  if(e)r=e[ix()];
  else{
    for(const q of RULES){const m=q[0].exec(core);if(m){
      // g = các nhóm bắt được đã dịch đệ quy (vd ghi chú của EA trong "EA từ chối: ..."). Rule dạng chuỗi dùng g; rule dạng hàm nhận m gốc (để so sánh từ khóa), bản đã dịch nằm ở m.tr
      const g=m.map((x,i)=>i&&x&&VIRE.test(x)?(tx(x)??x):x);
      m.tr=g;const t=q[ix()];r=ps(typeof t==="function"?t(m):t.replace(/\$(\d)/g,(_,d)=>g[+d]??""));break}}
    if(r===null){const o=ps(core);r=o===core?null:o}
  }
  if(c.size>3000)c.clear();c.set(core,r);return r;
}
function conv(s){const m=/^(\s*)([\s\S]*?)(\s*)$/.exec(s);if(!m[2])return s;const r=tx(m[2]);return r==null?s:m[1]+r+m[3]}

const TN=new WeakMap(),AM=new WeakMap(),AT=["title","placeholder","aria-label","alt"];
function doText(n){
  const cur=n.nodeValue;let rec=TN.get(n);
  if(!rec)rec={src:cur,out:cur};else if(cur!==rec.out)rec.src=cur; // app vừa ghi nội dung mới
  const out=conv(rec.src);
  if(out!==cur)n.nodeValue=out;
  rec.out=out;TN.set(n,rec);
}
function doAttr(el,a){
  const cur=el.getAttribute(a);if(cur==null)return;
  let r=AM.get(el);if(!r)AM.set(el,r={});
  let x=r[a];if(!x)x=r[a]={src:cur,out:cur};else if(cur!==x.out)x.src=cur;
  const out=conv(x.src);
  if(out!==cur)el.setAttribute(a,out);x.out=out;
}
const skipEl=el=>!el||!el.closest||!!el.closest("script,style,[data-no-i18n]");
const skipTx=el=>skipEl(el)||!!el.closest("textarea");
const elAttrs=el=>{for(const a of AT)if(el.hasAttribute(a))doAttr(el,a)};
function walk(root){
  if(root.nodeType===3){if(!skipTx(root.parentElement))doText(root);return}
  if(root.nodeType!==1||skipEl(root))return;
  elAttrs(root);
  const w=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT,{acceptNode:n=>n.nodeType===1&&skipEl(n)?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
  let n;while((n=w.nextNode())){if(n.nodeType===3){if(!skipTx(n.parentElement))doText(n)}else elAttrs(n)}
}

/* Nhãn tháng trên trục thời gian của chart */
const MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const monLbl=m=>lang==="en"?MON[m-1]:lang==="zh"?m+"月":"Th"+m;
function chartLocale(){
  try{
    window.tickFmt=function(t){
      if(typeof t!=="number")return null;const o=lp(t);
      if(C.tf<86400&&(o.hour||o.minute))return p2(o.hour)+":"+p2(o.minute);
      if(o.day===1)return o.month===1?String(o.year):monLbl(o.month);
      return String(o.day);
    };
    applyTz();
  }catch(e){}
}

/* ---------- Nút chọn ngôn ngữ (cờ SVG, hiển thị đúng cả trên Windows) ---------- */
const star=(cx,cy,R,rot)=>{const p=[];for(let k=0;k<10;k++){const a=(rot==null?-90:rot)*Math.PI/180+k*Math.PI/5,r=k%2?R*.382:R;p.push((cx+r*Math.cos(a)).toFixed(2)+","+(cy+r*Math.sin(a)).toFixed(2))}return p.join(" ")};
const small=(cx,cy)=>'<polygon fill="#ffde00" points="'+star(cx,cy,1,Math.atan2(5.2-cy,5-cx)*180/Math.PI)+'"/>';
const FLAG={
  vi:'<svg class="flag" viewBox="0 0 30 20"><rect width="30" height="20" fill="#da251d"/><polygon fill="#ff0" points="'+star(15,10.7,6.5)+'"/></svg>',
  en:'<svg class="flag" viewBox="0 0 60 40" preserveAspectRatio="none"><rect width="60" height="40" fill="#012169"/><path d="M0 0L60 40M60 0L0 40" stroke="#fff" stroke-width="8"/><path d="M0 0L60 40M60 0L0 40" stroke="#c8102e" stroke-width="3.5"/><path d="M30 0V40M0 20H60" stroke="#fff" stroke-width="13"/><path d="M30 0V40M0 20H60" stroke="#c8102e" stroke-width="8"/></svg>',
  zh:'<svg class="flag" viewBox="0 0 30 20"><rect width="30" height="20" fill="#de2910"/><polygon fill="#ffde00" points="'+star(5,5.2,3)+'"/>'+small(10,2)+small(12,4)+small(12,7)+small(10,9)+'</svg>'
};
const st=document.createElement("style");
st.textContent="#lgm{position:fixed;z-index:1001;width:180px;padding:6px;display:flex;flex-direction:column;gap:1px;background:var(--hole);color:var(--ink);border:1px solid var(--line);border-radius:14px;box-shadow:0 16px 40px rgba(0,0,10,.5)}.sb svg.flag,#lgm svg.flag{width:22px;height:15px;flex:none;border-radius:3px;box-shadow:0 0 0 1px rgba(128,128,128,.4)}";
document.head.appendChild(st);
const sf=document.querySelector(".sf"),thb=document.getElementById("th");
const lb=document.createElement("button");
lb.className="sb";lb.id="lg";lb.type="button";lb.setAttribute("title","Language · Ngôn ngữ · 语言");lb.setAttribute("aria-label","Language");
lb.innerHTML='<span class="ic">🌐</span><span class="lb" data-no-i18n></span>';
sf.insertBefore(lb,thb);
const lname=()=>LANGS.find(l=>l[0]===lang)[1];
function closeMenu(){const m=document.getElementById("lgm");if(m)m.remove()}
lb.onclick=e=>{
  e.stopPropagation();
  if(document.getElementById("lgm")){closeMenu();return}
  const m=document.createElement("div");m.id="lgm";m.setAttribute("data-no-i18n","");m.setAttribute("role","menu");
  m.innerHTML=LANGS.map(l=>'<button type="button" class="tzi'+(l[0]===lang?" on":"")+'" data-l="'+l[0]+'"><span style="display:flex;align-items:center;gap:10px">'+FLAG[l[0]]+l[1]+'</span><span>'+(l[0]===lang?"✓":"")+'</span></button>').join("");
  const r=lb.getBoundingClientRect();
  m.style.left=Math.min(r.right+8,innerWidth-190)+"px";m.style.bottom=Math.max(8,innerHeight-r.bottom)+"px";
  m.onclick=ev=>{const b=ev.target.closest("[data-l]");if(b){setLang(b.dataset.l);closeMenu()}};
  document.body.appendChild(m);
};
document.addEventListener("click",e=>{if(!e.target.closest("#lgm,#lg"))closeMenu()});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeMenu()});

function setLang(l){
  lang=l;try{localStorage.setItem("tp_lang",l);localStorage.setItem("gx-lang",l)}catch(e){}
  document.documentElement.lang=l==="zh"?"zh-CN":l;
  lb.querySelector(".lb").textContent=lname();lb.querySelector(".ic").innerHTML=FLAG[l];
  walk(document.body);
  chartLocale();
}
window.I18N={set:setLang,get:()=>lang,tr:s=>conv(String(s))};

new MutationObserver(ms=>{
  for(const m of ms){
    if(m.type==="characterData"){if(!skipTx(m.target.parentElement))doText(m.target)}
    else if(m.type==="attributes"){if(!skipEl(m.target))doAttr(m.target,m.attributeName)}
    else m.addedNodes.forEach(walk);
  }
}).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:AT});

setLang(lang);
})();
