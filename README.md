# 🧸 ToyStoreManagement

> **Hệ thống Quản lý Cửa hàng Đồ chơi Trẻ em Toàn diện (ToyStore Management System)**
> Kiến trúc Đa tầng (Clean Architecture) với ASP.NET Core Web API 8, Entity Framework Core, SQL Server, SignalR Realtime, JWT Authentication và Giao diện Web Hiện đại Vanilla HTML5 / CSS3 / JavaScript.

---

## 🛠 Công Nghệ Sử Dụng

- **Backend Framework**: C# / ASP.NET Core 8.0 Web API (Clean Architecture: Domain, Application, Infrastructure, API).
- **Database & ORM**: Microsoft SQL Server, Entity Framework Core 8.
- **Realtime Communication**: ASP.NET Core SignalR (Hỗ trợ Chat CSKH `/hubs/support-chat` và Theo dõi Đơn hàng / Giao vận `/hubs/order-tracking`).
- **Xác thực & Phân quyền**: ASP.NET Core Identity, JWT (JSON Web Token), Role-Based Access Control (RBAC).
- **Frontend**: HTML5 Semantic, Modern Vanilla CSS3 (Glassmorphism, Dark/Light palettes, Responsive), Vanilla JavaScript ES6+ (Modular architecture, Chart.js for Analytics).
- **Triển khai & Hosting**: Hỗ trợ chạy Localhost, Docker container, Cloud Backend (Render), Cloud Database (Somee MS SQL Server).

---

## ✨ Các Phân Hệ & Tính Năng Nổi Bật

### 1. 🛍️ Dành Cho Khách Hàng (Customer Storefront)
- **Khám phá sản phẩm đa kênh**:
  - Xem danh mục sản phẩm, bộ sưu tập đồ chơi mới nhất, đồ chơi bán chạy và nổi bật.
  - Chi tiết sản phẩm trực quan: hiển thị đa biến thể (SKU, màu sắc, kích thước, độ tuổi phù hợp), thư viện hình ảnh và trạng thái tồn kho thực tế.
- **Bộ lọc thông minh & Tìm kiếm nhanh**:
  - Lọc đa tiêu chí: Danh mục, Thương hiệu, Khoảng giá, Độ tuổi bé (tháng/tuổi), Giới tính.
- **Giỏ hàng trực quan (Cart Drawer)**:
  - Slide-over Drawer thuận tiện, đồng bộ `localStorage`, tự động tính toán phí vận chuyển và ưu đãi Freeship.
- **Thanh toán & Đặt hàng (Checkout Flow)**:
  - Nhập địa chỉ giao hàng, áp dụng Voucher giảm giá, chọn phương thức thanh toán (COD / Chuyển khoản QR).
- **Tài khoản cá nhân & Đơn hàng**:
  - Đăng ký, đăng nhập bảo mật bằng JWT, quản lý sổ địa chỉ giao hàng, theo dõi tiến trình đơn hàng realtime.
- **Đánh giá sản phẩm (Product Reviews)**:
  - Đánh giá sao (1 - 5 sao) và viết nhận xét cho từng món đồ chơi sau khi đơn hàng hoàn tất giao.
- **Tích điểm thưởng & Đổi quà (Loyalty & Rewards)**:
  - Tự động tích lũy điểm thưởng từ giá trị đơn hàng; tra cứu lịch sử tích/tiêu điểm và đổi lấy Voucher ưu đãi tại trang `rewards.html`.
- **Hỗ trợ & Đổi trả (Customer Care & Return)**:
  - Tạo yêu cầu đổi trả trong 7 ngày đối với đơn hoàn tất kèm lý do và ảnh minh chứng.
  - Chat trực tuyến realtime với nhân viên CSKH qua SignalR.

---

### 2. ⚙️ Dành Cho Quản Trị Viên & Cửa Hàng (Admin & Manager Space)
- **Dashboard Thống kê & Phân tích Đa chiều**:
  - Bộ lọc thời gian linh hoạt: Hôm nay, 7 ngày, 30 ngày, Quý này, Năm nay hoặc Tùy chọn ngày.
  - **Dòng tiền thực tế (Cashflow Breakdown)**: Tách bạch rõ Doanh thu thực thu, Tiền COD đang giữ bởi Shipper, Doanh thu tạm tính đơn mới, và Thất thoát do hủy/hoàn.
  - **Phân tích danh mục**: Biểu đồ tròn tỷ trọng đóng góp doanh thu theo từng nhóm ngành hàng đồ chơi.
  - **Báo cáo tài chính chuyên sâu**: Doanh thu gộp, Giá vốn hàng bán (COGS), Lợi nhuận gộp và Tỷ suất biên lợi nhuận (Gross Margin %).
  - **Cảnh báo tồn kho**: Cảnh báo sản phẩm sắp hết hàng và danh sách hàng tồn đọng / chậm luân chuyển (Slow-moving / Dead Stock).
- **Quản lý Hàng hóa & Biến thể**:
  - Danh mục, Thương hiệu, Nhà cung cấp, Sản phẩm, Biến thể SKU, Thuộc tính động.
  - Quản lý tồn kho tức thời (Stock Level, Reserved Quantity).
- **Quản lý Đơn hàng & Điều phối Giao hàng**:
  - Theo dõi danh sách đơn hàng toàn diện, duyệt đơn, tạo mã chuyến giao hàng (`DeliveryBatchCode`) và phân công Shipper phụ trách.
- **Đối soát Công nợ Thu hộ COD (COD Reconciliation)**:
  - Quản lý dòng tiền thu hộ COD từ đội ngũ giao hàng.
  - Đối soát theo 3 trạng thái: *Chưa thu* ➔ *Shipper đã thu tiền* ➔ *Đã nộp quỹ / Kế toán xác nhận hoàn tất*.
- **Nhập kho & Thanh lý hàng hóa**:
  - Tạo phiếu nhập hàng từ nhà cung cấp, cập nhật giá vốn.
  - Lập phiếu thanh lý tồn kho nhiều SKU, ghi nhận lịch sử vào `InventoryTransactions`.
- **Chăm sóc khách hàng & Xử lý Trả hàng**:
  - Tiếp nhận và trả lời chat realtime của khách hàng.
  - Duyệt / Từ chối yêu cầu trả hàng; xác nhận hàng về kho trước khi hoàn tồn kho tự động.
- **Phân quyền người dùng (RBAC)**:
  - Quản trị 5 vai trò hệ thống: `Admin` (Toàn quyền), `Manager` (Quản lý), `Staff` (Nhân viên), `Shipper` (Giao hàng), `Customer` (Khách hàng).
  - Khóa / Kích hoạt tài khoản, cấp quyền vai trò và đổi mật khẩu bảo mật.

---

### 3. 🛵 Dành Cho Nhân Viên Giao Hàng (Shipper App)
- **Giao diện Web App chuyên dụng dành riêng cho Shipper** (`/shipper.html`):
  - Tối ưu hiển thị hoàn hảo trên điện thoại di động và máy tính bảng.
  - Shipper đăng nhập xem danh sách các đơn hàng được gán theo mã chuyến / khu vực phụ trách.
  - Cập nhật trạng thái giao hàng tức thời: **Bắt đầu giao** ➔ **Giao thành công** (tự động ghi nhận COD đã thu) hoặc **Giao thất bại** (chọn lý do thất bại).
  - Đồng bộ trạng thái đơn hàng và gửi thông báo realtime đến khách hàng & admin qua SignalR Hub.

---

## 🔑 Tài Khoản Kiểm Thử Mặc Định

Hệ thống đã chuẩn bị sẵn các tài khoản demo đầy đủ quyền trong file [SeedData_1000_Rows.sql](file:///d:/KhoaLuanCuNhan/KhoaLuanCuNhan_QuanLyCuaHangDoChoiTreEm/SeedData_1000_Rows.sql):

| Vai trò | Email / Tên đăng nhập | Mật khẩu | Mô tả quyền hạn |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@toystore.vn` | `Admin@123` | Quản trị tối cao toàn hệ thống, báo cáo tài chính, quản lý tài khoản & phân quyền |
| **Shipper** | `shipper@toystore.vn` | `Shipper@123` | Nhân viên giao hàng, truy cập cổng Shipper App cập nhật đơn & COD |
| **Khách hàng** | `anhtuyet@gmail.com` | `Customer@123` | Khách hàng thân thiết (VIP), có sẵn lịch sử mua hàng, điểm tích lũy & địa chỉ |
| **Khách hàng khác**| `baolong@gmail.com`, `hoangyen@gmail.com`, ... | `Customer@123` | 15 tài khoản khách hàng mẫu khác nhau |

---

## 🌐 Các Đường Dẫn Truy Cập Web

Sau khi khởi chạy ứng dụng (mặc định tại cổng `http://localhost:5225` hoặc cổng cấu hình của bạn):

| Phân hệ / Tính năng | URL Truy Cập | Đối tượng sử dụng |
| :--- | :--- | :--- |
| 🛒 **Trang chủ Khách hàng** | [http://localhost:5225/customer.html](http://localhost:5225/customer.html) | Khách mua hàng |
| 🧸 **Danh sách sản phẩm & Lọc** | [http://localhost:5225/products.html](http://localhost:5225/products.html) | Khách mua hàng |
| 🎁 **Tích điểm thưởng & Đổi quà** | [http://localhost:5225/rewards.html](http://localhost:5225/rewards.html) | Khách mua hàng |
| ⭐ **Đánh giá sản phẩm đã mua** | [http://localhost:5225/order-review.html](http://localhost:5225/order-review.html) | Khách mua hàng |
| ⚙️ **Bảng điều khiển Quản trị (Admin)** | [http://localhost:5225/index.html](http://localhost:5225/index.html) | Admin / Manager / Staff |
| 🛵 **Cổng Ứng dụng Shipper (Giao hàng)** | [http://localhost:5225/shipper.html](http://localhost:5225/shipper.html) | Shipper |
| 📜 **Tài liệu Swagger API** | [http://localhost:5225/swagger](http://localhost:5225/swagger) | Lập trình viên / Tester |

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### Bước 1: Chuẩn bị Cơ sở Dữ liệu (MS SQL Server)

Hệ thống cung cấp sẵn 2 file SQL chuẩn hóa:
1. **[ToyStoreManagement.sql](file:///d:/KhoaLuanCuNhan/KhoaLuanCuNhan_QuanLyCuaHangDoChoiTreEm/ToyStoreManagement.sql)**: DDL khởi tạo cấu trúc toàn bộ bảng, khóa chính, khóa ngoại ban đầu.
2. **[SeedData_1000_Rows.sql](file:///d:/KhoaLuanCuNhan/KhoaLuanCuNhan_QuanLyCuaHangDoChoiTreEm/SeedData_1000_Rows.sql)**: File dữ liệu mẫu **All-in-One** (~1.850 dòng dữ liệu test hoàn chỉnh từ Mục 1 đến Mục 5, tự động cập nhật bảng/cột mới, nạp đầy đủ tài khoản người dùng, sản phẩm, 220 đơn hàng, COD, đánh giá, voucher và điểm thưởng).

#### Cách nạp trên SQL Server Local (SSMS / Azure Data Studio):
1. Kết nối vào SQL Server cục bộ.
2. Mở file [ToyStoreManagement.sql](file:///d:/KhoaLuanCuNhan/KhoaLuanCuNhan_QuanLyCuaHangDoChoiTreEm/ToyStoreManagement.sql) và chạy **Execute** để tạo Database.
3. Mở file [SeedData_1000_Rows.sql](file:///d:/KhoaLuanCuNhan/KhoaLuanCuNhan_QuanLyCuaHangDoChoiTreEm/SeedData_1000_Rows.sql) và chạy **Execute** để nạp toàn bộ dữ liệu kiểm thử.

#### Cách nạp trên Somee Database:
1. Đăng nhập vào Somee Dashboard ➔ Chọn Database của bạn.
2. Vào mục **MS SQL** ➔ Chọn **Run T-SQL query**.
3. Dán toàn bộ nội dung file [SeedData_1000_Rows.sql](file:///d:/KhoaLuanCuNhan/KhoaLuanCuNhan_QuanLyCuaHangDoChoiTreEm/SeedData_1000_Rows.sql) vào ô nhập lệnh và bấm **Execute**. File đã được tối ưu từng batch riêng biệt (`GO`), tương thích hoàn toàn 100% với môi trường Somee.

---

### Bước 2: Cấu hình Chuỗi Kết Nối (Connection String)

Mở file `ToyStore.API/appsettings.json` (hoặc cấu hình biến môi trường trên Render):

```json
"ConnectionStrings": {
  "DefaultConnection": "Server=YOUR_SERVER_NAME;Database=ToyStoreManagement;Trusted_Connection=True;MultipleActiveResultSets=true;TrustServerCertificate=True"
}
```

*Nếu sử dụng Database trên Somee, hãy thay chuỗi kết nối do Somee cung cấp (kèm User ID và Password).*

---

### Bước 3: Khởi Chạy Ứng Dụng

#### Cách 1: Chạy bằng Visual Studio 2022 / JetBrains Rider
- Mở solution `ToyStoreManagement.sln`.
- Đặt `ToyStore.API` làm dự án khởi động (Startup Project).
- Nhấn `F5` hoặc `Ctrl + F5`.

#### Cách 2: Chạy bằng .NET CLI (Terminal)
```bash
# Di chuyển đến thư mục dự án
cd d:\KhoaLuanCuNhan\KhoaLuanCuNhan_QuanLyCuaHangDoChoiTreEm

# Biên dịch dự án
dotnet build

# Khởi chạy API và máy chủ Web
dotnet run --project ToyStore.API/ToyStore.API.csproj
```

Sau khi chạy lệnh trên, mở trình duyệt và truy cập: [http://localhost:5225/customer.html](http://localhost:5225/customer.html) để bắt đầu trải nghiệm!

---

## 📌 Lưu Ý Quan Trọng Khi Thử Nghiệm

1. **Truy cập qua máy chủ HTTP/HTTPS**: Luôn truy cập giao diện qua địa chỉ Web server nội bộ (ví dụ: `http://localhost:5225/...` hoặc link deploy Render). Không mở file `.html` trực tiếp bằng giao thức file cục bộ (`file:///...`) để tránh bị trình duyệt chặn CORS/Fetch API.
2. **SignalR Hubs**:
   - `/hubs/support-chat`: Hub hỗ trợ chăm sóc khách hàng trực tuyến.
   - `/hubs/order-tracking`: Hub cập nhật tiến trình điều phối, vận chuyển và hoàn tất đơn hàng theo thời gian thực.

---

## 📄 Bản Quyền & Tác Giả

- **Đề tài**: Quản lý Cửa hàng Đồ chơi Trẻ em (ToyStore Management).
- **Tác giả**: Nguyễn Huỳnh Gia Vy.
- **Năm hoàn thành**: 2026.
