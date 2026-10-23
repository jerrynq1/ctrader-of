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
  chart.js                       Chart nến, tải M1, gộp khung giờ (kể cả khung tuỳ chọn + khung giây dựng từ tick), cập nhật live (poll() 250ms)
  candle-style.js                Màu nến, đường Bid/Ask
  indicators-defs.js             Kho indicator
  indicators-engine.js           Dựng pane, hộp cài đặt
  connection-ui.js               Tab Kết nối, sidebar, theme, nền sao
  init.js                        Khởi động app
  drawings-*.js, volume-profile.js, orderflow-*.js, mobile.js, i18n*.js   như cũ
```

## Dữ liệu lấy như thế nào

- **Nến M1**: `ProtoOAGetTrendbarsReq`, tải THEO NHU CẦU: mở chart chỉ tải ~1 ngày gần nhất, kéo chart sang trái tới đâu thì tự tải thêm nến cũ tới đó (không còn ô "số ngày"). Nến live: `ProtoOASubscribeLiveTrendbarReq` (nếu server không gửi thì app tự dựng nến từ bid).
- **Giá Bid/Ask live**: `ProtoOASubscribeSpotsReq`.
- **Footprint / Big Trade / Statistic**: `ProtoOAGetTickDataReq` (tick bid + ask). cTrader (forex/CFD) không có tape giao dịch thật nên đây là **ước lượng** từ chuỗi báo giá, theo quy tắc cố định, dùng chung cho lịch sử và live (xem comment đầu phần footprint trong `ctrader.js`):
  1. Mỗi lần bid hoặc ask đổi = 1 đơn vị khối lượng (tick volume). Báo giá không đổi hoặc lỗi (ask < bid) bị bỏ.
  2. Hướng: ask/bid cùng tăng (hoặc một bên tăng) = **mua**; cùng giảm = **bán**. Spread nở/co thì xét hướng dịch của giá giữa (mid); mid không đổi thì giữ hướng cũ.
  3. Giá đặt: **mua ở Ask, bán ở Bid**.
  4. Các sự kiện cùng mili-giây gộp làm 1 (lấy bid/ask cuối).
  5. Mỗi cửa sổ lịch sử nạp thêm 5 phút phía trước để có sẵn trạng thái bid/ask/hướng (không mất tick đầu cửa sổ), phần đó không được cộng vào số liệu.
  6. Gộp hàng giá bằng số nguyên (đơn vị 1/100000): hàng q phủ `[q×bước, (q+1)×bước)`, không sai số số thực ở biên hàng (`fpQ` trong `orderflow-footprint.js`).
  7. POC hòa thì lấy hàng gần giữa nến; Value Area theo phương pháp CME (so tổng 2 hàng trên với 2 hàng dưới); Imbalance chéo kèm lọc volume tối thiểu và Stacked imbalance.
  Nếu broker không lưu đủ tick lịch sử, góc chart sẽ báo % số phút có dữ liệu.
- **Volume Profile**: tổng volume mỗi phút lấy từ tick volume của nến M1. Phân bổ vào từng mức giá: (1) theo footprint thật từ tick nếu phút đó đã được tải (bật Footprint / Big Trade / Statistic), giá mua quy về hệ Bid bằng spread trung bình của phút; (2) nếu không có tick thì theo đường đi của giá trong nến (tăng O→L→H→C, giảm O→H→L→C), đoạn lên là Ask, đoạn xuống là Bid. Hàng giá tính bằng số nguyên, POC hòa thì lấy hàng gần giữa, Value Area theo CME. Góc profile ghi nguồn dữ liệu (Tick xx% / M1).
- Giới hạn của cTrader: 5 request lịch sử / giây (app tự giãn nhịp; nến M1 và tick có làn riêng nên tick không chặn nến), lịch sử tick chỉ có trong một số ngày gần đây tuỳ broker. Tick footprint cũng tải theo vùng đang xem (kéo chart tới đâu tải tới đó), có trần an toàn 3 ngày gần nhất (`FP_MAXD` trong `orderflow-footprint.js`) vì tick rất nặng.
- Không còn lưu trữ D1/R2: mỗi lần mở trang sẽ tải lại từ cTrader.

## Khi sửa file về sau

- Sau mỗi lần sửa, đổi `?v=19` thành `?v=20` trong `index.html` để trình duyệt tải lại file mới.
- **Không đổi thứ tự** các dòng `<script>` (các file dùng chung biến toàn cục).
- Tránh đặt tên biến trùng với tên đã có ở file khác (hai file khai báo cùng một `const` sẽ làm file sau không chạy).

## Kiểm thử logic footprint

`node tests/footprint.test.js` chạy các kiểm tra không cần mạng (phân loại hướng, phân trang tick, lịch sử = live, gộp hàng, POC/VA/Imbalance).

## Khi lỗi

Bấm **F12 > Console**. Thanh trạng thái trên chart hiện lý do (sai Client ID/Secret, token hết hạn, sai tên mã, mạng chặn `wss://live.ctraderapi.com:5036`...).

## Chống đơ giá (v15)

- Statistic cache số liệu theo từng nến, mỗi tick live chỉ tính lại nến cuối (trước: tính lại toàn bộ lịch sử mỗi 250ms).
- Nến M1 và tick footprint đi hai làn riêng (chung giới hạn 5 req/s), tick tải nặng không còn chặn việc đổi mã / khung / tải nến.
- Watchdog (`ctWatch` trong `ctrader.js`): im > 20s thì thăm dò, không trả lời thì tự nối lại; có kết nối mà > 60s không có giá thì đăng ký lại spot. Tab hiện lại / có mạng lại cũng kiểm tra ngay.
- Chạy kiểm tra: `node tests/footprint.test.js && node tests/connection.test.js`
- Nến live (v16): mỗi tick bid kéo high/low/close của nến phút hiện tại, không phụ thuộc server có gửi trendbar hay không. Chỉ báo cập nhật tối đa ~3 lần/giây.
- Chart đứng thì mở Console (F12) gõ `ctDiag()` để xem đang kẹt ở đâu.
- v17: tự bù nến M1 bị thiếu khi tab ẩn / máy ngủ / mạng chập (`catchUp` trong `chart.js`); cache số liệu của nến đã đóng kiểm tra thêm chữ ký dữ liệu (`fpSigOk`) nên không giữ số liệu cũ khi phút cuối được chốt muộn.

## Thêm nhiều chart (v18)

- Nút **Thêm chart** nằm ngay dưới chart chính. Mỗi lần bấm thêm 1 chart phụ (mặc định cùng mã, khung giờ lớn hơn 1 bậc để xem đa khung). Tối đa 4 chart phụ trên máy tính, 3 trên điện thoại (mỗi chart mở thêm 1 kết nối + luồng dữ liệu riêng).
- Mỗi chart phụ là **bản đầy đủ của app** (footprint, big trade, statistic, volume profile, indicator, công cụ vẽ) chạy trong iframe cùng origin: `index.html?cid=<id>&sym=..&tf=..` (xem `js/multichart.js`, `js/embed.js`).
- Mã, khung giờ, indicator, hình vẽ của từng chart lưu riêng (hậu tố `_<cid>` trong localStorage, xem `PERCH` trong `core.js`). Theme, múi giờ, màu nến, ngôn ngữ, thông tin kết nối dùng chung và đồng bộ ngay giữa các chart qua sự kiện `storage`.
- Thẻ chart phụ có: đổi thứ tự (↑ ↓), toàn màn hình (Esc để thoát), xoá (bấm 2 lần), kéo thanh dưới thẻ để đổi chiều cao. Nút 1 cột / 2 cột chỉ hiện trên màn hình rộng.
- Trên điện thoại: chạm vào vùng chart là thao tác chart (không cuộn trang), muốn cuộn trang thì vuốt ở thanh tiêu đề thẻ hoặc khoảng trống giữa các thẻ.

## Khung giờ tuỳ chọn (v25)

- Cạnh các nút M1…W1 có nút **+**: nhập số + đơn vị (**Giây / Phút / Giờ / Ngày / Tuần**) rồi bấm *Dùng khung này*. Ví dụ 7 phút, 90 phút, 2 giờ, 3 ngày, 15 giây. Khung mới được lưu thành nút riêng (có dấu **×** để xoá), tối đa 8 khung tuỳ chọn, tối đa 4 tuần.
- Danh sách khung tuỳ chọn lưu ở `localStorage` key `tp_ctf` và **dùng chung cho mọi chart** (chart chính + chart phụ, đồng bộ ngay qua sự kiện `storage`); khung đang chọn của từng chart vẫn lưu riêng (`tp_tf` / `tp_tf_<id>`). Chart phụ cũng có nút **+** riêng trên thanh khung giờ của nó.
- **Từ 60 giây trở lên (bội số của 60s):** dựng từ nến M1 như các khung thường. Nến gom theo mốc epoch (giờ server): 7 phút, 90 phút, 3 ngày... Tuần và bội số của tuần neo vào thứ Hai như W1.
- **Dưới 60 giây (1–59 giây):** cTrader không có nến nhỏ hơn M1 nên app dựng từ **tick bid** (`ctTicks` + báo giá live trong `ctSpot` -> `sbLive`, xem cuối `js/chart.js`). Volume = số lần bid đổi giá. Tick tải theo nhu cầu: lần đầu 30 phút gần nhất, kéo chart sang trái thì tải thêm, tối đa 24 giờ lịch sử.
- Giới hạn khung giây: Footprint / Big Trade / Statistic cần dữ liệu theo phút nên **không chạy** trên khung < M1 (app báo ở thanh trạng thái). Indicator thường, công cụ vẽ, Bid/Ask line vẫn dùng bình thường. Đổi từ khung giây về khung phút thì app tự tải lại nến M1.
- Test: `node tests/customtf.test.js`.

## Chọn / dời hình vẽ trên cảm ứng (v26)

- Trên điện thoại, **chạm xuống không còn chọn hay kéo hình**: kéo / zoom chart mà lỡ chạm vào hình (nhất là Volume Profile) thì hình đứng yên.
- **Chọn hình:** chạm nhẹ (nhấc tay nhanh, không di chuyển, không có ngón thứ 2) lên hình. Volume Profile chỉ chọn khi chạm đúng phần hiển thị, không chọn cả khung.
- **Dời cả hình:** chọn hình trước, rồi giữ yên ngón tay trên hình ~0,3 giây (máy rung nhẹ) rồi kéo. Nút tròn (điểm neo) của hình đang chọn vẫn kéo được ngay.
- **Bỏ chọn:** chạm nhẹ vào chỗ trống. Kéo / zoom chart không làm mất chọn.
- Chuột trên máy tính giữ nguyên như cũ. Code: `tpStart` / `cancelTp` trong `js/drawings-interact.js`.

## Chống đứng chart (v19)

Lỗi cũ: Bid/Ask vẫn nhảy nhưng nến + footprint đứng im. Nguyên nhân: `poll()` ghi Bid/Ask ra màn hình rồi mới cập nhật nến, nên chỉ cần 1 bước phía sau ném lỗi (vẽ đường Bid/Ask, `cs.update` lệch thời gian, tính chỉ báo...) hoặc cờ `loading` bị kẹt thì phần còn lại dừng hẳn.

- `poll()` tách từng bước có `try/catch` riêng; lỗi chỉ ghi log (`CHW.err`), không chặn bước sau. `applyLive` tự dựng lại chart khi `cs.update` lỗi, `render()` lớp phủ lỗi sẽ tự thử lại.
- `chartWatch()` phát hiện "có giá bid mới nhưng nến > 6s không được cập nhật" và khôi phục theo cấp: dựng lại (6s) -> bù nến M1 (15s) -> tải lại (30s). Cờ `loading` kẹt quá 90s cũng tự tải lại. Thanh trạng thái báo "Chart chậm cập nhật…" khi đang khôi phục.
- Nến live của phút đang chạy kế thừa open/high/low/volume thật từ lịch sử (trước đó có thể bị thay bằng nến chỉ có 1 giá sau khi tải lại).
- Gõ `ctDiag()` trong Console khi chart đứng: có thêm `chartChoApDung_s`, `loiGanNhat`, `capHoiPhuc`.
