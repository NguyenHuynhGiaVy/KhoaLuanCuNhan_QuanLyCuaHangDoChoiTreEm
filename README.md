# 🧸 ToyStoreManagement

Hệ thống quản lý cửa hàng đồ chơi trẻ em.

## 🛠 Công nghệ

- C# / ASP.NET Core Web API
- SQL Server
- Entity Framework Core
- JWT Authentication
- HTML / CSS / JavaScript
- Visual Studio 2022

## 🚀 Cách chạy project

### Bước 1: Tạo Database

Mở **SQL Server Management Studio (SSMS)**.

1. Kết nối vào SQL Server trên máy.
2. Mở file SQL Script của project.
3. Chạy **Execute (F5)** để tạo Database và dữ liệu mẫu.

> Nếu SQL Server trên máy có tên khác thành viên khác thì không sao.

### Bước 2: Cấu hình Connection String

Mở:

`ToyStoreManagement.API/appsettings.json`

Tìm:

```json
"ConnectionStrings": {
  "DefaultConnection": "..."
}

Sửa phần Server= thành tên SQL Server trên máy của mình.

Ví dụ:

"ConnectionStrings": {
  "DefaultConnection": "Server=DESKTOP-ABC123\\SQLEXPRESS;Database=ToyStoreManagement;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true"
}

⚠️ Mỗi máy có thể có Server= khác nhau. Không copy nguyên Connection String của máy thành viên khác.

Bước 3: Chạy Visual Studio
Mở ToyStoreManagement.sln.
Chọn ToyStoreManagement.API → Set as Startup Project.
Nhấn F5 hoặc Ctrl + F5.
Kiểm tra Swagger đã mở.
Truy cập trang Web trên trình duyệt.
❗ Nếu API không kết nối

Kiểm tra lại:

SQL Server đang chạy.
Database ToyStoreManagement đã được tạo.
Server= trong appsettings.json đúng với máy hiện tại.
API đang chạy bằng ToyStoreManagement.API.
