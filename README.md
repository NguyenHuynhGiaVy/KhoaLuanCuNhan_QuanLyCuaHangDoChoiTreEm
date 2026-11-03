# 🧸 ToyStoreManagement

> **Hệ Thống Quản Lý Cửa Hàng Đồ Chơi Trẻ Em Toàn Diện (ToyStore Enterprise Management System)**  
> **Khóa Luận Tốt Nghiệp Cử Nhân Công Nghệ Thông Tin (Năm 2026)**  
> Kiến trúc đa tầng **Clean Architecture** trên nền tảng **ASP.NET Core 8 Web API**, **Entity Framework Core 8**, **SQL Server**, **SignalR Realtime Hubs**, **JWT & RBAC** và Giao diện Web Hiện đại **Vanilla HTML5 / CSS3 / ES6+ JavaScript**.

---

## 📑 Mục Lục
1. [Công Nghệ & Kiến Trúc Hệ Thống](#-công-nghệ--kiến-trúc-hệ-thống)
2. [Các Phân Hệ & Tính Năng Nổi Bật](#-các-phân-hệ--tính-năng-nổi-bật)
   - [1. Cổng Mua Sắm Dành Cho Khách Hàng (Customer Storefront)](#1-cổng-mua-sắm-dành-cho-khách-hàng-customer-storefront)
   - [2. Cổng Quản Trị & Điều Hành (Admin & Manager Space)](#2-cổng-quản-trị--điều-hành-admin--manager-space)
   - [3. Cổng Nhân Viên Vận Chuyển Hiện Đại (Modern Shipper Portal)](#3-cổng-nhân-viên-vận-chuyển-hiện-đại-modern-shipper-portal)
3. [Tài Khoản & Phân Quyền Kiểm Thử (RBAC Matrix)](#-tài-khoản--phân-quyền-kiểm-thử-rbac-matrix)
4. [Bảng Điều Hướng & Đường Dẫn Web](#-bảng-điều-hướng--đường-dẫn-web)
5. [Hướng Dẫn Cài Đặt & Khởi Chạy](#-hướng-dẫn-cài-đặt--khởi-chạy)
   - [Bước 1: Cài đặt Cơ sở Dữ liệu SQL Server](#bước-1-cài-đặt-cơ-sở-dữ-liệu-sql-server)
   - [Bước 2: Cấu hình Connection String](#bước-2-cấu-hình-connection-string)
   - [Bước 3: Khởi chạy Ứng dụng Backend & Web](#bước-3-khởi-chạy-ứng-dụng-backend--web)
6. [Tài Liệu Nghiệp Vụ & Kịch Bản Demo Đính Kèm](#-tài-liệu-nghiệp-vụ--kịch-bản-demo-đính-kèm)
7. [Bản Quyền & Tác Giả](#-bản-quyền--tác-giả)

---

## 🛠 Công Nghệ & Kiến Trúc Hệ Thống

Dự án áp dụng mô hình **Clean Architecture (Onion Architecture)** 4 tầng chặt chẽ, đảm bảo tính tách biệt trách nhiệm (SoC), dễ mở rộng và bảo trì:

```
ToyStoreManagement/
├── ToyStore.Domain/           # Thực thể cốt lõi (Entities), Enums, Value Objects
├── ToyStore.Application/      # DTOs, Business Interfaces, CQRS Services, Logic nghiệp vụ
├── ToyStore.Infrastructure/   # EF Core DbContext, Migrations, Repositories, SignalR Hubs
└── ToyStore.API/              # Controllers, Middlewares, Configurations, Static Web Assets (wwwroot)
```

- **Backend Framework**: C# 12 / .NET 8 (ASP.NET Core Web API).
- **Database & ORM**: Microsoft SQL Server 2019+, Entity Framework Core 8.0 với Code-First và T-SQL Scripting chuẩn hóa.
- **Xác thực & Phân quyền**: ASP.NET Core Identity kết hợp JWT (JSON Web Tokens) với 5 vai trò (RBAC): `Admin`, `Manager`, `Staff`, `Shipper`, `Customer`.
- **Giao tiếp Thời gian thực (Realtime Communication)**: ASP.NET Core SignalR:
  - `/hubs/support-chat`: Trung tâm Chat trực tuyến giữa Khách hàng và CSKH.
  - `/hubs/order-tracking`: Theo dõi trạng thái đơn hàng và tiến trình điều phối giao vận tức thời.
- **Frontend Web**:
  - Giao diện người dùng thuần hiện đại: **HTML5 Semantic**, **Modern Vanilla CSS3** (hệ thống CSS Custom Properties, Glassmorphism, Micro-animations, Mobile-first layout).
  - Tương tác động: **Vanilla JavaScript (ES6+)** dạng Module, tích hợp thư viện **Chart.js** cho báo cáo phân tích số liệu.
- **Triển khai & Hosting**: Hỗ trợ chạy môi trường cục bộ (Localhost), Docker Container, Cloud Web Service (Render), và Cloud Database (Somee MS SQL Server).

---

## ✨ Các Phân Hệ & Tính Năng Nổi Bật

### 1. Cổng Mua Sắm Dành Cho Khách Hàng (Customer Storefront)
- **Khám phá sản phẩm & Bộ lọc thông minh (`/customer.html`, `/products.html`)**:
  - Trưng bày bộ sưu tập đồ chơi mới nhất, đồ chơi bán chạy và danh mục theo lứa tuổi.
  - Bộ lọc đa chiều: Danh mục, Thương hiệu, Khoảng giá, Nhóm tuổi (tháng/tuổi), Giới tính.
- **Chi tiết sản phẩm & Chuyển đổi Biến thể 2 chiều (`/product-detail.html`)**:
  - **Tự động nhận diện & đồng bộ ảnh biến thể (`resolveVariantImage`)**: Khi chuyển nhóm thuộc tính (ví dụ: *Trắng - Nhỏ* sang *Đen - Nhỏ*), hệ thống tự động tìm đúng ảnh của biến thể hoặc nhóm màu tương ứng và chuyển đổi ảnh mượt mà với hiệu ứng chuyển cảnh (fade transition).
  - **Đồng bộ Thumbnail bên trái**: Ô ảnh nhỏ tự động nhận diện, cập nhật viền nổi bật (`.active`) và cuộn mượt vào tầm nhìn.
  - **Tương tác 2 chiều linh hoạt**: Nhấp vào thumbnail bên trái sẽ tự động chọn nhóm biến thể (Màu sắc, Kích thước) tương ứng bên phải.
  - Hiển thị tình trạng tồn kho thực tế, SKU tương ứng, giá ưu đãi và các chính sách cam kết an toàn đồ chơi.
- **Giỏ hàng trực quan (Cart Drawer)**:
  - Slide-over Drawer thuận tiện, đồng bộ tức thời với `localStorage`.
  - Thanh tiến trình tính toán tự động ưu đãi Freeship khi đạt ngưỡng giá trị đơn hàng.
- **Quy trình Thanh toán & Đặt hàng (Checkout Flow)**:
  - Nhập địa chỉ giao hàng, áp dụng mã Voucher giảm giá, chọn phương thức thanh toán (COD hoặc Chuyển khoản ngân hàng qua mã QR).
- **Tích điểm thưởng & Đổi quà (`/rewards.html`)**:
  - Tự động tích lũy điểm thưởng từ mỗi đơn hàng thành công; quản lý hạng thành viên, tra cứu lịch sử tích/tiêu điểm và đổi điểm lấy Voucher mua sắm.
- **Đánh giá sản phẩm đã mua (`/order-review.html`)**:
  - Đánh giá xếp hạng sao (1 - 5 sao) và để lại phản hồi thực tế sau khi nhận hàng.
- **Hỗ trợ CSKH & Quy trình Đổi trả hàng**:
  - Tạo yêu cầu đổi trả trong vòng 7 ngày đối với các đơn hàng đã hoàn tất, đính kèm ảnh minh chứng và lý do.
  - Chat trực tuyến theo thời gian thực (Realtime Chat) với nhân viên tư vấn qua SignalR.

---

### 2. Cổng Quản Trị & Điều Hành (Admin & Manager Space)
- **Dashboard Thống kê & Phân tích Dòng tiền Đa chiều (`/index.html`)**:
  - Bộ lọc thời gian linh hoạt: Hôm nay, 7 ngày, 30 ngày, Quý này, Năm nay hoặc Tùy chọn ngày.
  - **Bóc tách Dòng tiền thực tế (Cashflow Breakdown)**: Phân tách minh bạch giữa *Doanh thu thực thu*, *Tiền COD đang giữ bởi Shipper*, *Doanh thu tạm tính đơn mới*, và *Thất thoát do hủy/hoàn*.
  - **Báo cáo Tài chính chuyên sâu**: Doanh thu gộp, Giá vốn hàng bán (COGS), Lợi nhuận gộp và Tỷ suất biên lợi nhuận (Gross Margin %).
  - **Biểu đồ tỷ trọng Danh mục**: Phân tích cơ cấu đóng góp doanh thu của từng nhóm ngành hàng đồ chơi.
  - **Cảnh báo Tồn kho**: Cảnh báo tức thì các mặt hàng sắp cạn kho và danh sách hàng tồn đọng / chậm luân chuyển (Slow-moving / Dead Stock).
- **Quản lý Hàng hóa & Biến thể**:
  - Quản lý cây Danh mục, Thương hiệu, Nhà cung cấp, Sản phẩm, Biến thể SKU và Bộ thuộc tính động.
  - Quản lý tồn kho thực tế và lượng hàng đã được giữ chỗ (Reserved Quantity).
- **Điều phối Đơn hàng & Lập chuyến Giao hàng**:
  - Theo dõi vòng đời đơn hàng toàn diện, duyệt đơn, gom đơn theo tuyến đường, tạo mã chuyến giao (`DeliveryBatchCode`) và phân công cho Shipper phụ trách.
- **Đối soát Công nợ Thu hộ COD 3 Bước (COD Reconciliation)**:
  - Quy trình quản lý dòng tiền thu hộ COD nghiêm ngặt:
    1. *Chưa thu* (Đơn đang vận chuyển)
    2. *Shipper đã thu tiền* (Giao hàng thành công, tiền lưu tại ví COD của Shipper)
    3. *Đã nộp quỹ / Kế toán xác nhận* (Đối soát thành công, tiền ghi nhận vào két quỹ cửa hàng).
- **Nhập kho & Thanh lý hàng hóa**:
  - Lập phiếu nhập kho từ nhà cung cấp, cập nhật giá vốn trung bình và số lượng tồn.
  - Lập phiếu thanh lý đồ chơi tồn đọng, ghi nhận vết kiểm toán bất biến vào bảng `InventoryTransactions`.
- **Chăm sóc Khách hàng & Duyệt Đổi trả**:
  - Quầy tiếp nhận tin nhắn hỗ trợ realtime của khách hàng.
  - Kiểm tra và duyệt yêu cầu hoàn trả; xác nhận hàng về kho trước khi tự động phục hồi số lượng tồn kho.
- **Quản trị Người dùng & Phân quyền (RBAC)**:
  - Quản lý 5 vai trò hệ thống, kích hoạt/khóa tài khoản, cấp phát vai trò và giám sát nhật ký hoạt động.

---

### 3. Cổng Nhân Viên Vận Chuyển Hiện Đại (Modern Shipper Portal)
Giao diện ứng dụng vận chuyển (`/shipper.html`) được tái thiết kế toàn diện theo tiêu chuẩn của các ứng dụng logistics hàng đầu (Grab Driver, Shopee Xpress, Ahamove, GHN):

- **Thiết kế Mobile-First chuyên nghiệp**:
  - Header bám dính (sticky) kính mờ, trạng thái trực tuyến với hiệu ứng chấm xanh nhấp nháy (pulsing green indicator) và chuông thông báo giao vận.
  - Sử dụng **100% Vector SVG Icon** sắc nét, loại bỏ hoàn toàn các emoji không cần thiết.
- **Thẻ Chỉ số Ca Làm Việc (Shift Overview KPIs)**:
  - Bảng tổng kết 4 chỉ số tức thời: *Đang giao*, *Đã hoàn thành*, *Tiền COD đang giữ*, và *Thu nhập phí ship*.
- **Bộ Lọc Đơn Hàng Theo Thời Gian Đa Năng**:
  - Thanh công cụ chuyển đổi nhanh: *Tất cả*, *Hôm nay*, *Hôm qua*, *7 ngày qua*, và *Chọn ngày tùy chỉnh (Date Range Picker)* kèm ô tìm kiếm tức thời theo mã đơn, người nhận, số điện thoại.
- **Lộ Trình Giao Hàng Trực Quan (Waypoint Route)**:
  - Hiển thị trực quan điểm xuất phát từ kho hàng đến địa chỉ người nhận.
  - Tích hợp nút **Gọi điện 1 chạm** và nút **Mở chỉ đường Google Maps** chính xác.
- **Quy trình Thao tác Thực địa 5 Bước**:
  - Nhận đơn ➔ Bắt đầu giao ➔ Giao thành công (thu COD) hoặc Báo giao thất bại (chọn lý do cụ thể: khách hẹn lại, không liên lạc được, từ chối nhận).
  - Tự động đồng bộ trạng thái qua SignalR về Admin Dashboard và Storefront của Khách hàng.
- **Tab Lịch Sử & Quản Lý Ví COD**:
  - Xem lại lịch sử các đơn hàng đã hoàn tất giao trong ca.
  - Quản lý ví thu hộ COD, theo dõi các khoản đã nộp quỹ và các khoản đang chờ kế toán đối soát duyệt.

---

## 🔑 Tài Khoản & Phân Quyền Kiểm Thử (RBAC Matrix)

Dữ liệu tài khoản đã được nạp sẵn và đồng bộ trong tệp dữ liệu [SeedData_Optimized.sql](file:///d:/KhoaLuanCuNhan/KhoaLuanCuNhan_QuanLyCuaHangDoChoiTreEm/SeedData_Optimized.sql):

| Vai Trò | Email / Tên Đăng Nhập | Mật Khẩu Mặc Định | Họ Và Tên | Cổng Truy Cập (URL) | Quyền Hạn Chính |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Admin** | `admin@toystore.vn` | `Admin@123` | Quản Trị Viên | `/index.html` | Toàn quyền quản trị hệ thống, tài chính, đối soát COD, nhân sự |
| **Admin (2)** | `nguyenhuynhgiavy@gmail.com` | `Admin@123` | Nguyen Huynh Gia Vy | `/index.html` | Tài khoản tác giả khóa luận |
| **Manager** | `manager@toystore.vn` | `Manager@123` | Quản Lý Cửa Hàng | `/manager.html` (hoặc `/index.html`) | Quản lý kho, duyệt đơn hàng, tạo lô giao hàng, kiểm tra doanh thu |
| **Staff** | `staff@toystore.vn` | `Staff@123` | Nhân Viên Bán Hàng | `/manager.html` | Bán hàng tại quầy, kiểm kê hàng hóa, tiếp nhận đơn |
| **Shipper 1** | `shipper@toystore.vn` | `Shipper@123` | Nguyễn Văn Giao | `/shipper.html` | Nhận đơn giao, cập nhật lộ trình thực tế, nộp tiền COD |
| **Shipper 2** | `shipper2@toystore.vn` | `Shipper@123` | Trần Văn Tốc | `/shipper.html` | Tài xế giao hàng tuyến 2 |
| **Khách Hàng (VIP)**| `anhtuyet@gmail.com` | `Customer@123` | Nguyễn Thị Ánh Tuyết | `/customer.html` | Khách hàng VIP: có sẵn lịch sử đơn hàng, điểm thưởng và địa chỉ |
| **Khách Hàng Mẫu** | `baolong@gmail.com`<br>`hoangyen@gmail.com`<br>`ducthang@gmail.com` | `Customer@123` | Khách Hàng Demo | `/customer.html` | Khám phá đồ chơi, đặt hàng COD/QR, đổi quà tích điểm, đánh giá |

> **Ghi chú**: Xem danh sách chi tiết toàn bộ các tài khoản trong file [DanhSach_TaiKhoan_MatKhau_CacRole.txt](file:///d:/KhoaLuanCuNhan/KhoaLuanCuNhan_QuanLyCuaHangDoChoiTreEm/DanhSach_TaiKhoan_MatKhau_CacRole.txt).

---

## 🌐 Bảng Điều Hướng & Đường Dẫn Web

Sau khi khởi chạy ứng dụng (mặc định tại cổng `http://localhost:5225`):

| Phân Hệ / Chức Năng | Đường Dẫn Web (URL) | Đối Tượng Sử Dụng |
| :--- | :--- | :--- |
| 🛒 **Trang Chủ Khách Hàng** | [http://localhost:5225/customer.html](http://localhost:5225/customer.html) | Khách mua sắm |
| 🧸 **Bộ Sưu Tập & Danh Sách Sản Phẩm** | [http://localhost:5225/products.html](http://localhost:5225/products.html) | Khách mua sắm |
| 🔍 **Chi Tiết Sản Phẩm & Chọn Biến Thể** | [http://localhost:5225/product-detail.html?id=8](http://localhost:5225/product-detail.html?id=8) | Khách mua sắm |
| 🎁 **Tích Điểm Thưởng & Đổi Quà** | [http://localhost:5225/rewards.html](http://localhost:5225/rewards.html) | Khách mua sắm |
| ⭐ **Đánh Giá Đơn Hàng Đã Giao** | [http://localhost:5225/order-review.html](http://localhost:5225/order-review.html) | Khách mua sắm |
| ⚙️ **Bảng Điều Khiển Quản Trị (Admin)** | [http://localhost:5225/index.html](http://localhost:5225/index.html) | Admin / Quản trị viên |
| 📋 **Cổng Điều Hành Cửa Hàng (Manager)** | [http://localhost:5225/manager.html](http://localhost:5225/manager.html) | Manager / Staff |
| 🛵 **Cổng Vận Chuyển Giao Hàng (Shipper App)** | [http://localhost:5225/shipper.html](http://localhost:5225/shipper.html) | Shipper / Đội ngũ giao vận |
| 📜 **Tài Liệu Swagger API** | [http://localhost:5225/swagger](http://localhost:5225/swagger) | Developer / Tester |

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### Bước 1: Cài đặt Cơ sở Dữ liệu SQL Server

Hệ thống cung cấp sẵn 2 tệp T-SQL chuẩn hóa trong thư mục gốc:
1. **[ToyStoreManagement.sql](file:///d:/KhoaLuanCuNhan/KhoaLuanCuNhan_QuanLyCuaHangDoChoiTreEm/ToyStoreManagement.sql)**: DDL khởi tạo toàn bộ bảng, khóa chính, khóa ngoại, chỉ mục (Index) và quan hệ ràng buộc.
2. **[SeedData_Optimized.sql](file:///d:/KhoaLuanCuNhan/KhoaLuanCuNhan_QuanLyCuaHangDoChoiTreEm/SeedData_Optimized.sql)**: Tệp dữ liệu mẫu tối ưu hóa hoàn chỉnh (~1.850 dòng T-SQL) tạo sẵn người dùng, vai trò Identity, danh mục đồ chơi, sản phẩm đa biến thể, đơn hàng, dữ liệu đối soát COD, đánh giá sao, voucher và điểm thưởng.

#### Cách thực thi trên SQL Server Local (SSMS / Azure Data Studio):
1. Mở **SQL Server Management Studio (SSMS)** hoặc **Azure Data Studio**, kết nối tới instance cục bộ (ví dụ: `.` hoặc `localhost`).
2. Mở file [ToyStoreManagement.sql](file:///d:/KhoaLuanCuNhan/KhoaLuanCuNhan_QuanLyCuaHangDoChoiTreEm/ToyStoreManagement.sql) và nhấn **Execute** để tạo cấu trúc cơ sở dữ liệu `ToyStoreManagement`.
3. Mở file [SeedData_Optimized.sql](file:///d:/KhoaLuanCuNhan/KhoaLuanCuNhan_QuanLyCuaHangDoChoiTreEm/SeedData_Optimized.sql) và nhấn **Execute** để nạp toàn bộ dữ liệu kiểm thử.

#### Cách thực thi trên Somee Cloud Database (Nếu dùng Cloud):
1. Đăng nhập trang quản trị Somee ➔ Chọn Database của bạn.
2. Điều hướng tới menu **MS SQL** ➔ Chọn **Run T-SQL query**.
3. Dán nội dung file [SeedData_Optimized.sql](file:///d:/KhoaLuanCuNhan/KhoaLuanCuNhan_QuanLyCuaHangDoChoiTreEm/SeedData_Optimized.sql) vào khung truy vấn và nhấn **Execute**. Script đã được chia batch bằng lệnh `GO`, tương thích 100% với Somee.

---

### Bước 2: Cấu hình Connection String

Mở file [appsettings.json](file:///d:/KhoaLuanCuNhan/KhoaLuanCuNhan_QuanLyCuaHangDoChoiTreEm/ToyStore.API/appsettings.json) trong dự án `ToyStore.API`:

```json
"ConnectionStrings": {
  "DefaultConnection": "Data Source=.;Initial Catalog=ToyStoreManagement;Integrated Security=True;Persist Security Info=False;Pooling=False;MultipleActiveResultSets=True;Encrypt=True;TrustServerCertificate=True;"
}
```

> **Lưu ý**: Thay đổi `Data Source=.` thành tên Server SQL của bạn nếu sử dụng Named Instance (ví dụ: `.\SQLEXPRESS`). Nếu triển khai lên Render/Somee, sử dụng chuỗi kết nối Cloud chứa User ID và Password.

---

### Bước 3: Khởi chạy Ứng dụng Backend & Web

#### Cách 1: Khởi chạy bằng .NET CLI (Khuyên dùng)
Mở cửa sổ dòng lệnh (Terminal / PowerShell) tại thư mục dự án:

```powershell
# Di chuyển vào thư mục gốc của đồ án
cd d:\KhoaLuanCuNhan\KhoaLuanCuNhan_QuanLyCuaHangDoChoiTreEm

# Biên dịch toàn bộ Solution
dotnet build

# Chạy ứng dụng API & Web Server
dotnet run --project ToyStore.API/ToyStore.API.csproj
```

Khi Terminal thông báo:
```
info: Microsoft.Hosting.Lifetime[14]
      Now listening on: http://localhost:5225
```
Mở trình duyệt web và truy cập: [http://localhost:5225/customer.html](http://localhost:5225/customer.html) để bắt đầu trải nghiệm!

#### Cách 2: Khởi chạy bằng Visual Studio 2022 / JetBrains Rider
- Mở tệp solution `ToyStoreManagement.sln`.
- Nhấp chuột phải vào dự án `ToyStore.API` ➔ Chọn **Set as Startup Project**.
- Nhấn phím `F5` hoặc `Ctrl + F5` để khởi động máy chủ.

---

## 📚 Tài Liệu Nghiệp Vụ & Kịch Bản Demo Đính Kèm

Nhằm hỗ trợ quá trình nghiên cứu, báo cáo tiến độ và bảo vệ đồ án trước Hội đồng chấm khóa luận, thư mục dự án cung cấp bộ tài liệu nghiệp vụ chi tiết:

1. **[KichBan_Demo_ToanBo_ChucNang.txt](file:///d:/KhoaLuanCuNhan/KhoaLuanCuNhan_QuanLyCuaHangDoChoiTreEm/KichBan_Demo_ToanBo_ChucNang.txt)**:
   - Kịch bản demo liền mạch (Seamless End-to-End Flow) thời lượng 15 - 20 phút.
   - Hướng dẫn thiết lập đa cửa sổ trình duyệt (Admin, Customer, Shipper) để trình diễn tương tác Realtime SignalR giữa các phân hệ mà không cần đăng xuất/đăng nhập lại.
2. **[DanhSach_TaiKhoan_MatKhau_CacRole.txt](file:///d:/KhoaLuanCuNhan/KhoaLuanCuNhan_QuanLyCuaHangDoChoiTreEm/DanhSach_TaiKhoan_MatKhau_CacRole.txt)**:
   - Danh sách chi tiết toàn bộ tài khoản, mật khẩu, họ tên, vai trò và đường dẫn đăng nhập chuẩn hóa.
3. **[PhanTich_QuyTrinh_NghiepVu.txt](file:///d:/KhoaLuanCuNhan/KhoaLuanCuNhan_QuanLyCuaHangDoChoiTreEm/PhanTich_QuyTrinh_NghiepVu.txt)**:
   - Đặc tả chi tiết 8 quy trình nghiệp vụ cốt lõi: Cung ứng - Nhập kho - Bán hàng - Gom lô điều phối - Giao nhận thực địa - Đối soát COD - Đổi trả hàng hậu mãi - Báo cáo dòng tiền.

---

## 📌 Lưu Ý Kỹ Thuật Khi Vận Hành

1. **Truy cập qua Web Server**:
   Luôn truy cập các trang giao diện qua địa chỉ Web server nội bộ (`http://localhost:5225/...`). Tránh mở tệp `.html` trực tiếp qua giao thức tệp cục bộ (`file:///...`) để bảo đảm các lệnh gọi Fetch API và SignalR Hubs hoạt động chính xác.
2. **Bảo mật JWT Token**:
   Token đăng nhập được lưu trữ an toàn trong `localStorage` (`toyStoreToken`, `toyStoreUser`). Khi đổi tài khoản kiểm thử giữa các vai trò khác nhau trên cùng một trình duyệt, hãy sử dụng nút **Đăng xuất** trên thanh điều hướng hoặc mở trình duyệt ở chế độ Ẩn danh (Incognito Window).
3. **Đồng bộ SignalR**:
   Khi một đơn hàng được Shipper cập nhật trạng thái hoặc khi phát sinh tin nhắn hỗ trợ, SignalR Hubs sẽ tự động gửi sự kiện đến các client đang kết nối để cập nhật giao diện ngay lập tức mà không cần F5 tải lại trang.

---

## 📄 Bản Quyền

- **Đề tài**: Hệ Thống Quản Lý Cửa Hàng Đồ Chơi Trẻ Em Toàn Diện (ToyStore Management System).
- **Loại hình**: Khóa Luận Tốt Nghiệp Cử Nhân Công Nghệ Thông Tin.
- **Năm hoàn thành**: 2026.
