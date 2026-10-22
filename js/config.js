/* ============ CẤU HÌNH cTrader Open API (chỉ dùng cá nhân) ============
   Điền thông tin của bạn vào đây. File này chứa SECRET, nên:
   - KHÔNG đưa lên GitHub công khai (repo public = lộ secret). Dùng repo private, hoặc chỉ chạy trên máy (xem README).
   - Khi tạo Access Token, chọn scope "Accounts" (chỉ xem) là đủ, KHÔNG cần quyền "Trading".
   Có thể bỏ trống ở đây rồi nhập ở tab "Kết nối" trên web (lưu trong trình duyệt). */
const CT_CONFIG = {
  clientId:     "",        // Client ID của app (https://connect.spotware.com/apps)
  clientSecret: "",        // Client Secret của app
  accessToken:  "",        // Access Token (lấy ở Playground của app, xem README)
  accountId:    0,         // ctidTraderAccountId. Để 0 thì tự lấy tài khoản đầu tiên khớp "env" bên dưới
  env:          "live",    // "live" hoặc "demo" (tài khoản live phải dùng live, demo phải dùng demo)
};
