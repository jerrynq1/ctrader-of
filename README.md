# Trade Platform (cTrader Open API)

Web xem chart + orderflow (Footprint, Big Trade, Statistic, Volume Profile, indicator) chạy thuần trên trình duyệt, lấy dữ liệu **trực tiếp từ cTrader Open API** qua WebSocket. Không còn EA MT5, không còn Cloudflare Worker, không cần server Node.

## Chạy nhanh

1. Điền `js/config.js` (Client ID, Client Secret, Access Token, xem bên dưới). Hoặc để trống rồi nhập ở tab **Kết nối** trên web.
2. Mở thư mục này bằng 1 web server tĩnh trên máy bạn, ví dụ: `python3 -m http.server 8000` rồi vào `http://localhost:8000`.
3. Gõ mã (vd `XAUUSD`) ở ô mã. Tên mã phải đúng tên broker đặt trên cTrader (ô mã có gợi ý).

> **Bảo mật:** `js/config.js` chứa Client Secret + Access Token. Đừng đưa lên GitHub Pages của repo **public** (ai cũng đọc được). Đã có `.gitignore` bỏ qua file này. Khi tạo token chỉ cần scope **Accounts** (chỉ xem), không cần Trading.

## Lấy thông tin cTrader Open API

1. Vào https://connect.spotware.com/apps, đăng nhập bằng cTID, **Add new app** (Redirect URI điền `http://localhost` là được). Đợi app ở trạng thái Active nếu cần.
2. Mở app > lấy **Client ID** và **Client Secret**.
3. Vào tab **Playground** của app > chọn scope **Accounts** > **Get Token** > đăng nhập cTID, chọn tài khoản > copy **Access Token** (token hết hạn sau khoảng 30 ngày, hết hạn thì tạo lại).
4. `env` trong config: tài khoản demo dùng `"demo"`, tài khoản live dùng `"live"`. `accountId` để `0` thì tự lấy tài khoản đầu tiên khớp `env` (muốn chỉ định thì điền `ctidTraderAccountId`, hiện trong Playground).

## Cấu trúc

```
index.html                       Khung trang + danh sách file nạp (thứ tự nạp RẤT quan trọng)
css/style.css                    Giao diện
js/
  config.js                      Client ID / Secret / Access Token (SECRET, đừng public)
  core.js                        Tiện ích dùng chung ($, ld, sv, khung giờ) + dịch thông báo lỗi cTrader (why)
  timezone.js                    Múi giờ. cTrader trả UTC, app quy ra "giờ server New York close" (UTC+2/+3) để D1/W1 cắt đúng 17:00 NY
  ctrader.js                     TOÀN BỘ phần kết nối cTrader: WebSocket JSON, đăng nhập, nến M1, giá live, tick -> footprint
  chart.js                       Chart nến, tải M1, gộp khung giờ, cập nhật live (poll() 250ms)
  candle-style.js                Màu nến, đường Bid/Ask
  indicators-defs.js             Kho indicator
  indicators-engine.js           Dựng pane, hộp cài đặt
  connection-ui.js               Tab Kết nối, sidebar, theme, nền sao
  init.js                        Khởi động app
  drawings-*.js, volume-profile.js, orderflow-*.js, mobile.js, i18n*.js   như cũ
```

## Dữ liệu lấy như thế nào

- **Nến M1**: `ProtoOAGetTrendbarsReq`, tải mới -> cũ theo cửa sổ, số ngày chỉnh ở tab Kết nối. Nến live: `ProtoOASubscribeLiveTrendbarReq` (nếu server không gửi thì app tự dựng nến từ bid).
- **Giá Bid/Ask live**: `ProtoOASubscribeSpotsReq`.
- **Footprint / Big Trade / Statistic**: `ProtoOAGetTickDataReq` (tick bid + ask), phân loại mua/bán bằng tick-rule (ask hoặc bid tăng = mua, giảm = bán, không đổi = giữ hướng cũ), khối lượng = 1 mỗi lần giá đổi, đặt tại mức bid. Phần live cộng dồn từ spot event. Đây là ước lượng, không phải khớp lệnh thật (forex/CFD không có tape).
- Giới hạn của cTrader: 5 request lịch sử / giây (app tự giãn nhịp), lịch sử tick chỉ có trong một số ngày gần đây tuỳ broker. Số ngày footprint chỉnh trong cài đặt indicator (mặc định 2 ngày).
- Không còn lưu trữ D1/R2: mỗi lần mở trang sẽ tải lại từ cTrader.

## Khi sửa file về sau

- Sau mỗi lần sửa, đổi `?v=10` thành `?v=11` trong `index.html` để trình duyệt tải lại file mới.
- **Không đổi thứ tự** các dòng `<script>` (các file dùng chung biến toàn cục).
- Tránh đặt tên biến trùng với tên đã có ở file khác (hai file khai báo cùng một `const` sẽ làm file sau không chạy).

## Khi lỗi

Bấm **F12 > Console**. Thanh trạng thái trên chart hiện lý do (sai Client ID/Secret, token hết hạn, sai tên mã, mạng chặn `wss://live.ctraderapi.com:5036`...).
