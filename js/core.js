const $=id=>document.getElementById(id);
const ld=(k,d)=>{try{return localStorage.getItem(k)??d}catch{return d}};
const sv=(k,v)=>{try{localStorage.setItem(k,v)}catch{}};
const TFS=[["M1",60],["M5",300],["M15",900],["M30",1800],["H1",3600],["H4",14400],["D1",86400],["W1",604800]];
let C={sym:ld("tp_sym","XAUUSD"),tf:+ld("tp_tf",900)};
let P={theme:ld("gx-theme","")||ld("tp_theme","")||(matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light"),sc:ld("tp_sc","")==="1"};

/* ================= LỖI cTrader -> tiếng Việt (kết nối + dữ liệu nằm ở ctrader.js) ================= */
const why=e=>{
  const m=String(e&&e.message||e);
  if(m==="NET")return"không kết nối được tới cTrader (kiểm tra mạng; wss://...ctraderapi.com:5036 có thể bị chặn bởi mạng/VPN)";
  if(m==="TIMEOUT")return"cTrader không phản hồi (quá thời gian chờ)";
  if(m==="CONFIG")return"chưa nhập Client ID / Client Secret / Access Token (js/config.js hoặc tab Kết nối)";
  if(/CLIENT_AUTH|OA_AUTH|CH_CLIENT/i.test(m))return"sai Client ID hoặc Client Secret ("+m+")";
  if(/ACCESS_TOKEN|CH_ACCESS|TOKEN/i.test(m))return"Access Token sai hoặc hết hạn, hãy tạo lại ở Playground ("+m+")";
  if(/ACCOUNT_NOT_AUTHORIZED|CTID_TRADER_ACCOUNT/i.test(m))return"Account ID không thuộc token này, hoặc sai live/demo ("+m+")";
  return m;
};
