/* ================= ĐỒNG BỘ GIỮA CÁC CHART (chạy ở cả trang chính lẫn chart phụ trong iframe) =================
   Mỗi chart là một bản app riêng (iframe cùng origin) nên dùng chung localStorage. Khi một chart đổi theme / múi giờ / màu nến / ngôn ngữ /
   thông tin kết nối, sự kiện "storage" báo cho các chart còn lại để áp dụng ngay (sự kiện này không bắn ở chính trang vừa ghi). */
(function(){
"use strict";
addEventListener("storage",e=>{
  try{
    const v=e.newValue;
    if(e.key==="tp_theme"&&v&&v!==P.theme){P.theme=v;setTheme()}
    else if(e.key==="tp_tz"&&v&&v!==TZ){try{pf(v);TZ=v}catch{return}tzChanged()}
    else if(e.key==="tp_cs"){CSx=JSON.parse(v||"{}")||{};applyCand();if(typeof baUpdate==="function")baUpdate();if(agg.length)rebuild(false)}
    else if((e.key==="gx-lang"||e.key==="tp_lang")&&v&&window.I18N&&I18N.get()!==v)I18N.set(v);
    else if(e.key==="tp_ct"){ctClose();loadM1()}
  }catch(x){}
});
if(!EMB)return;

/* ---------- Chỉ chart phụ ---------- */
$("embBack").onclick=()=>show("chart");
/* báo cho trang cha: mã, khung giờ, giá bid (để hiện trên tiêu đề thẻ) */
let last="";
function report(){
  const m={gx:1,cid:CID,sym:C.sym,tf:C.tf,bid:($("bid").textContent||"").trim()},s=JSON.stringify(m);
  if(s===last)return;last=s;
  try{parent.postMessage(m,location.origin==="null"?"*":location.origin)}catch(e){}
}
setInterval(report,1000);report();
})();
