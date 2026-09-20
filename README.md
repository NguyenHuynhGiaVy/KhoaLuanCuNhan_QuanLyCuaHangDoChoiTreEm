# 🧸 ToyStoreManagement

> **Hệ thống Quản lý Cửa hàng Đồ chơi Trẻ em (ToyStore Management System)**
> Kiến trúc Đa tầng (Clean Architecture) với ASP.NET Core Web API 8, EF Core, SQL Server, JWT Authentication và Giao diện Web Vanilla HTML5/CSS3/JavaScript.

---

## 🛠 Công Nghệ Sử Dụng

- **Backend Framework**: C# / ASP.NET Core 8.0 Web API
- **Database & ORM**: SQL Server, Entity Framework Core 8
- **Xác thực & Phân quyền**: ASP.NET Core Identity, JWT (JSON Web Token)
- **Frontend**: HTML5, CSS3 (Custom Responsive Styling), Vanilla JavaScript (ES6+)
- **Công cụ phát triển**: Visual Studio 2022 / VS Code, Swagger / OpenAPI UI

---

## ✨ Tính Năng Nổi Bật

### 🛍️ Dành Cho Khách Hàng (Customer Storefront)
- **Khám phá sản phẩm**: Xem danh sách sản phẩm mới nhất, sản phẩm nổi bật, chi tiết sản phẩm với nhiều biến thể (SKU, thuộc tính, màu sắc, kích thước).
- **Bộ lọc sản phẩm thông minh**: Lọc sản phẩm theo danh mục, thương hiệu, khoảng giá, độ tuổi (tháng/tuổi) và giới tính.
- **Giỏ hàng trực quan (Cart Drawer)**: Slide-over Drawer giỏ hàng tiện lợi, tự động lưu giỏ hàng (`localStorage`), tính toán tạm tính, ưu đãi miễn phí giao hàng (đơn từ 500.000đ).
- **Thanh toán đơn hàng (Checkout)**: Đặt hàng nhanh chóng, nhập thông tin giao hàng, áp dụng Voucher giảm giá và chọn phương thức thanh toán (COD / Chuyển khoản).
- **Tài khoản cá nhân**: Đăng ký, đăng nhập, đổi mật khẩu bảo mật và quản lý thông tin cá nhân.

### ⚙️ Dành Cho Quản Trị Viên & Nhân Viên (Admin & Staff Space)
- **Tổng quan (Dashboard)**: Thống kê doanh thu theo ngày/tháng/năm (Chart.js), theo dõi tổng đơn hàng, sản phẩm đang kinh doanh và số lượng khách hàng.
- **Quản lý hàng hóa**: Sản phẩm, biến thể sản phẩm (SKU, giá, thuộc tính), danh mục, thương hiệu, tồn kho realtime.
- **Quản lý vận hành**: Đơn hàng (cập nhật trạng thái đơn hàng), nhà cung cấp, phiếu nhập kho.
- **Marketing**: Quản lý các chương trình khuyến mãi và mã giảm giá (Voucher).
- **Phân quyền người dùng (Role-Based Access Control)**:
  - Phân quyền 4 cấp độ: `Admin` (Quản trị hệ thống), `Manager` (Quản lý cửa hàng), `Staff` (Nhân viên), `Customer` (Khách hàng).
  - Giao diện Admin quản lý tài khoản: xem danh sách tài khoản, chuyển đổi vai trò (Role) và khóa/kích hoạt tài khoản.
- **Bảo mật tài khoản Admin**: Chức năng đổi mật khẩu trực tiếp trên giao diện Admin.

---

## 🚀 Hướng Dẫn Chạy Dự Án

### Bước 1: Tạo Database SQL Server
1. Mở **SQL Server Management Studio (SSMS)** hoặc **Azure Data Studio**.
2. Kết nối vào SQL Server trên máy của bạn.
3. Mở file SQL Script `ToyStoreManagement.sql` nằm ở thư mục gốc của project.
4. Chạy **Execute (F5)** để khởi tạo Database `ToyStoreManagement` cùng dữ liệu mẫu.

---

### Bước 2: Cấu hình Connection String
Mở file `ToyStore.API/appsettings.json` và cập nhật thông tin tên Server SQL trên máy của bạn:

```json
"ConnectionStrings": {
  "DefaultConnection": "Data Source=YOUR_SERVER_NAME;Initial Catalog=ToyStoreManagement;Integrated Security=True;Persist Security Info=False;Pooling=False;MultipleActiveResultSets=True;Encrypt=True;TrustServerCertificate=True;"
}
```

*Lưu ý: Thay `YOUR_SERVER_NAME` bằng tên SQL Server trên máy (ví dụ: `DESKTOP-ABC123\SQLEXPRESS` hoặc `.` hoặc `localhost`).*

---

### Bước 3: Khởi Chạy Ứng Dụng

#### Cách 1: Chạy bằng Visual Studio 2022
1. Mở file solution `ToyStoreManagement.sln`.
2. Chuột phải vào project **ToyStore.API** → Chọn **Set as Startup Project**.
3. Nhấn **F5** hoặc **Ctrl + F5** để khởi chạy.

#### Cách 2: Chạy bằng .NET CLI (Terminal / Command Prompt)
Mở Terminal tại thư mục gốc của dự án và chạy lệnh:

```bash
dotnet run --project ToyStore.API/ToyStore.API.csproj
```

---

## 🌐 Các Đường Dẫn Truy Cập Web

Sau khi ứng dụng khởi chạy thành công (mặc định tại cổng `http://localhost:5225`):

| Trang Web | URL Truy Cập |
| :--- | :--- |
| 🛒 **Trang chủ Khách hàng** | [http://localhost:5225](http://localhost:5225) hoặc [http://localhost:5225/customer.html](http://localhost:5225/customer.html) |
| 🧸 **Danh sách sản phẩm** | [http://localhost:5225/products.html](http://localhost:5225/products.html) |
| ⚙️ **Quản trị Admin** | [http://localhost:5225/admin](http://localhost:5225/admin) hoặc [http://localhost:5225/index.html](http://localhost:5225/index.html) |
| 📜 **Swagger API Docs** | [http://localhost:5225/swagger](http://localhost:5225/swagger) |

---

## ❗ Lưu Ý Khi Kiểm Tra Giao Diện

- **Vui lòng truy cập qua đường dẫn HTTP (`http://localhost:5225/...`)**: Không double-click trực tiếp file `.html` từ ổ đĩa (giao thức `file://`) để tránh bị trình duyệt chặn các yêu cầu kết nối API (`fetch`).
- Project đã tích hợp cơ chế **Smart API Fallback** tự động nhận diện và gửi request đến `http://localhost:5225/api/...`.

---
/index.html](http://localhost:5225/index.html) |
| 📜 **Swagger API Docs** | [http://localhost:5225/swagger](http://localhost:5225/swagger) |

---

## ❗ Lưu Ý Khi Kiểm Tra Giao Diện

- **Vui lòng truy cập qua đường dẫn HTTP (`http://localhost:5225/...`)**: Không double-click trực tiếp file `.html` từ ổ đĩa (giao thức `file://`) để tránh bị trình duyệt chặn các yêu cầu kết nối API (`fetch`).
- Project đã tích hợp cơ chế **Smart API Fallback** tự động nhận diện và gửi request đến `http://localhost:5225/api/...`.

---

## 📄 Bản Quyền

© 2026 **ToyStore Management System**. All rights reserved.
