ToyStoreManagement

Hệ thống quản lý cửa hàng đồ chơi gồm Backend ASP.NET Core Web API,
Frontend Website và cơ sở dữ liệu SQL Server.

1. Yêu cầu môi trường

Cài đặt:

Visual Studio 2022

.NET SDK phù hợp với project

SQL Server

SQL Server Management Studio (SSMS)

Git

2. Clone project

Mở Terminal hoặc Git Bash:

git clone <LINK_GITHUB_REPOSITORY>

Sau đó mở solution bằng Visual Studio 2022.

3. Cấu trúc project

ToyStoreManagement
│
├── ToyStoreManagement.API
├── ToyStoreManagement.Application
├── ToyStoreManagement.Domain
├── ToyStoreManagement.Infrastructure
├── ToyStoreManagement.Web
│
└── Database
    └── ToyStoreManagementDb.sql

Trong đó:

ToyStoreManagement.API: Backend Web API và Swagger.

ToyStoreManagement.Application: DTO, Interface Repository,
Interface Service.

ToyStoreManagement.Domain: Entity và các thành phần Domain.

ToyStoreManagement.Infrastructure: DbContext, Repository, Service,
Configuration.

ToyStoreManagement.Web: Frontend Website.

Database/ToyStoreManagementDb.sql: Script tạo cơ sở dữ liệu.

4. Cấu hình Database

Bước 1: Mở SQL Server Management Studio

Kết nối tới SQL Server trên máy.

Bước 2: Chạy script Database

Mở file:

Database/ToyStoreManagementDb.sql

Sau đó chạy toàn bộ script.

Database cần tạo:

ToyStoreManagementDb

Bước 3: Kiểm tra Connection String

Mở:

ToyStoreManagement.API/appsettings.json

Kiểm tra phần:

"ConnectionStrings": {
  "DefaultConnection": "Server=.;Database=ToyStoreManagementDb;Trusted_Connection=True;TrustServerCertificate=True;"
}

Nếu SQL Server trên máy sử dụng Server Name khác thì sửa Server= cho
phù hợp.

Ví dụ:

Server=localhost

hoặc:

Server=.\SQLEXPRESS

Sau khi sửa connection string, lưu file.

5. Chạy Backend API

Trong Visual Studio:

Chọn project:

ToyStoreManagement.API

Chọn profile:

https

Nhấn Run.

Backend API chạy tại:

https://localhost:7078

Swagger:

https://localhost:7078/swagger

Swagger dùng để kiểm tra và test các API của hệ thống.

6. Chạy Frontend Website

Chọn project:

ToyStoreManagement.Web

Để Frontend chạy đúng port của nhóm, chọn profile:

http

Sau đó nhấn Run.

Frontend chạy tại:

http://localhost:5225

Trang khách hàng:

http://localhost:5225/customer.html

Trang quản trị:

http://localhost:5225/admin.html

Không chọn profile https nếu muốn sử dụng Frontend chính tại port
5225.

7. Cấu hình Frontend gọi API

Frontend sử dụng Backend API tại:

https://localhost:7078/api

Kiểm tra file cấu hình/API URL trong Frontend và đảm bảo Base URL trỏ
tới:

https://localhost:7078/api

Ví dụ:

const API_BASE_URL = "https://localhost:7078/api";

Frontend:

http://localhost:5225

gọi API:

https://localhost:7078/api

8. Thứ tự chạy hệ thống

Mỗi thành viên sau khi clone project nên chạy theo thứ tự:

1. Clone GitHub
        ↓
2. Mở Solution bằng Visual Studio 2022
        ↓
3. Chạy Database/ToyStoreManagementDb.sql
        ↓
4. Kiểm tra Connection String
        ↓
5. Chạy ToyStoreManagement.API
        ↓
6. API → https://localhost:7078
        ↓
7. Swagger → https://localhost:7078/swagger
        ↓
8. Chạy ToyStoreManagement.Web bằng profile http
        ↓
9. UI → http://localhost:5225

9. Địa chỉ sử dụng

Thành phần         Địa chỉ

Frontend Website   http://localhost:5225
Customer UI        http://localhost:5225/customer.html
Admin UI           http://localhost:5225/admin.html
Backend API        https://localhost:7078
Swagger            https://localhost:7078/swagger
Database           ToyStoreManagementDb

10. Tài khoản test

Nếu database script đã có tài khoản mẫu, sử dụng các tài khoản được cung
cấp trong dữ liệu seed của database.

Các role chính:

Admin
Manager
Staff
Customer

Quyền truy cập được kiểm soát bằng JWT và Role Authorization.

11. Lưu ý khi chạy lần đầu

Lỗi port đã được sử dụng

Nếu gặp:

Failed to bind to address
Address already in use

Kiểm tra process đang sử dụng port.

Ví dụ port 5225:

netstat -ano | findstr :5225

Ví dụ port 7078:

netstat -ano | findstr :7078

Sau đó dừng process tương ứng hoặc đóng instance Visual Studio/API đang
chạy.

Lỗi kết nối SQL Server

Kiểm tra:

SQL Server đang chạy.

Database ToyStoreManagementDb đã được tạo.

ConnectionStrings trong appsettings.json đúng.

Tài khoản Windows/SQL Server có quyền truy cập database.

Frontend không gọi được API

Kiểm tra:

Frontend: http://localhost:5225
API:      https://localhost:7078

và kiểm tra API Base URL trong JavaScript:

const API_BASE_URL = "https://localhost:7078/api";

Đồng thời đảm bảo Backend API đang chạy.

12. Quy tắc khi làm việc nhóm

Trước khi code:

git pull

Sau khi hoàn thành:

git add .
git commit -m "mô tả công việc"
git push

Không commit các file chứa thông tin cá nhân hoặc thông tin bảo mật.

13. Tóm tắt nhanh

DATABASE
└── ToyStoreManagementDb
        ↑
        │
BACKEND API
└── https://localhost:7078
        │
        ├── /swagger
        │
        ↓
FRONTEND WEB
└── http://localhost:5225
        │
        ├── customer.html
        └── admin.html

Khi clone project về máy mới, chỉ cần:

Clone → Chạy SQL Script → Kiểm tra Connection String
→ Run API (https/7078) → Run Web (http/5225)
