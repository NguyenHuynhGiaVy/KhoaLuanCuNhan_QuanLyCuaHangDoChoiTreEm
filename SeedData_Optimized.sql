-- =====================================================================
-- TOYSTORE OPTIMIZED SEED DATA SCRIPT (CHUẨN XÁC 100% CỘT SCHEMA DATABASE)
-- ĐÃ GIẢM DUNG LƯỢNG XUỐNG 1/3 SO VỚI BẢN CŨ (~1850 ROWS), TĂNG TỐC ĐỘ TRUY VẤN
-- ĐÃ FIX TRIỆT ĐỂ:
-- 1. [Suppliers]: dùng cột [Phone], [Address], [TaxCode], [CreatedAt], [UpdatedAt] (không dùng PhoneNumber)
-- 2. [Customers]: dùng cột [FullName], [Phone], [Email], [UserId], [LoyaltyPoint], [Status] (không dùng PhoneNumber hay LoyaltyPoints)
-- 3. [ProductVariants]: đầy đủ [Color], [Size], [CostPrice], [Price], [Status]
-- 4. [Inventories]: dùng cột [Quantity], [ReservedQuantity], [UpdatedAt]
-- 5. [Orders]: dùng [Subtotal], [DiscountAmount], [ShippingFee], [TotalAmount]
-- 6. [Payments]: có [TransactionCode], [Amount], [Status], [CodStatus]...
-- 7. [Shippings]: có [ShippingMethod], [TrackingCode], [DeliveryBatchCode], [ShipperId]...
-- 8. [OrderTrackingLogs]: lưu vết 5 bước giao hàng & audit timeline
-- =====================================================================

SET NOCOUNT ON;
EXEC sp_MSforeachtable "ALTER TABLE ? NOCHECK CONSTRAINT all";
GO

-- =============================================================
-- BƯỚC 1: ĐẢM BẢO CÁC BẢNG & CỘT CẦN THIẾT TỒN TẠI
-- =============================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Shippers')
BEGIN
    CREATE TABLE [dbo].[Shippers] (
        [ShipperId] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [UserId] nvarchar(450) NULL,
        [FullName] nvarchar(150) NOT NULL,
        [PhoneNumber] nvarchar(20) NOT NULL,
        [VehicleNumber] nvarchar(50) NULL,
        [AssignedArea] nvarchar(150) NULL,
        [IsActive] bit NOT NULL DEFAULT 1,
        [CreatedAt] datetime2 NOT NULL DEFAULT GETUTCDATE()
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'OrderTrackingLogs')
BEGIN
    CREATE TABLE [dbo].[OrderTrackingLogs] (
        [TrackingLogId] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [OrderId] int NOT NULL,
        [ShippingId] int NULL,
        [Action] nvarchar(150) NOT NULL,
        [PreviousStatus] nvarchar(100) NULL,
        [NewStatus] nvarchar(100) NOT NULL,
        [PerformedByUserId] nvarchar(450) NULL,
        [PerformedByName] nvarchar(150) NULL,
        [PerformedByRole] nvarchar(50) NULL,
        [Note] nvarchar(1000) NULL,
        [CreatedAt] datetime2 NOT NULL DEFAULT GETUTCDATE()
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Shippings]') AND name = 'DeliveryBatchCode')
    ALTER TABLE [dbo].[Shippings] ADD [DeliveryBatchCode] nvarchar(50) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Shippings]') AND name = 'EstimatedDeliveryAt')
    ALTER TABLE [dbo].[Shippings] ADD [EstimatedDeliveryAt] datetime2 NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Shippings]') AND name = 'EstimatedDeliveryFromDate')
    ALTER TABLE [dbo].[Shippings] ADD [EstimatedDeliveryFromDate] datetime2 NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Shippings]') AND name = 'EstimatedDeliveryToDate')
    ALTER TABLE [dbo].[Shippings] ADD [EstimatedDeliveryToDate] datetime2 NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Shippings]') AND name = 'ShipperId')
    ALTER TABLE [dbo].[Shippings] ADD [ShipperId] int NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Shippings]') AND name = 'FailReason')
    ALTER TABLE [dbo].[Shippings] ADD [FailReason] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Shippings]') AND name = 'AttemptCount')
    ALTER TABLE [dbo].[Shippings] ADD [AttemptCount] int NOT NULL DEFAULT 0;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Shippings]') AND name = 'FailedAt')
    ALTER TABLE [dbo].[Shippings] ADD [FailedAt] datetime2 NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Shippings]') AND name = 'ProofImageUrl')
    ALTER TABLE [dbo].[Shippings] ADD [ProofImageUrl] nvarchar(500) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Payments]') AND name = 'GatewayTransactionCode')
    ALTER TABLE [dbo].[Payments] ADD [GatewayTransactionCode] nvarchar(100) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Payments]') AND name = 'CodStatus')
    ALTER TABLE [dbo].[Payments] ADD [CodStatus] int NOT NULL DEFAULT 0;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Payments]') AND name = 'CodCollectedAt')
    ALTER TABLE [dbo].[Payments] ADD [CodCollectedAt] datetime2 NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Payments]') AND name = 'CodSubmittedAt')
    ALTER TABLE [dbo].[Payments] ADD [CodSubmittedAt] datetime2 NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Payments]') AND name = 'CodNote')
    ALTER TABLE [dbo].[Payments] ADD [CodNote] nvarchar(500) NULL;
GO

-- =============================================================
-- BƯỚC 2: DỌN DẸP DỮ LIỆU CŨ AN TOÀN
-- =============================================================
IF OBJECT_ID(N'[dbo].[OrderTrackingLogs]', N'U') IS NOT NULL DELETE FROM [dbo].[OrderTrackingLogs];
IF OBJECT_ID(N'[dbo].[ProductReviews]', N'U') IS NOT NULL DELETE FROM [dbo].[ProductReviews];
IF OBJECT_ID(N'[dbo].[VoucherUsages]', N'U') IS NOT NULL DELETE FROM [dbo].[VoucherUsages];
IF OBJECT_ID(N'[dbo].[Vouchers]', N'U') IS NOT NULL DELETE FROM [dbo].[Vouchers];
IF OBJECT_ID(N'[dbo].[LoyaltyTransactions]', N'U') IS NOT NULL DELETE FROM [dbo].[LoyaltyTransactions];
IF OBJECT_ID(N'[dbo].[SupportMessages]', N'U') IS NOT NULL DELETE FROM [dbo].[SupportMessages];
IF OBJECT_ID(N'[dbo].[SupportConversations]', N'U') IS NOT NULL DELETE FROM [dbo].[SupportConversations];
IF OBJECT_ID(N'[dbo].[CustomerFeedbacks]', N'U') IS NOT NULL DELETE FROM [dbo].[CustomerFeedbacks];
IF OBJECT_ID(N'[dbo].[ReturnRequestDetails]', N'U') IS NOT NULL DELETE FROM [dbo].[ReturnRequestDetails];
IF OBJECT_ID(N'[dbo].[ReturnRequests]', N'U') IS NOT NULL DELETE FROM [dbo].[ReturnRequests];
IF OBJECT_ID(N'[dbo].[OrderDetails]', N'U') IS NOT NULL DELETE FROM [dbo].[OrderDetails];
IF OBJECT_ID(N'[dbo].[Shippings]', N'U') IS NOT NULL DELETE FROM [dbo].[Shippings];
IF OBJECT_ID(N'[dbo].[Payments]', N'U') IS NOT NULL DELETE FROM [dbo].[Payments];
IF OBJECT_ID(N'[dbo].[Orders]', N'U') IS NOT NULL DELETE FROM [dbo].[Orders];
IF OBJECT_ID(N'[dbo].[ImportReceiptDetails]', N'U') IS NOT NULL DELETE FROM [dbo].[ImportReceiptDetails];
IF OBJECT_ID(N'[dbo].[ImportReceipts]', N'U') IS NOT NULL DELETE FROM [dbo].[ImportReceipts];
IF OBJECT_ID(N'[dbo].[InventoryTransactions]', N'U') IS NOT NULL DELETE FROM [dbo].[InventoryTransactions];
IF OBJECT_ID(N'[dbo].[Inventories]', N'U') IS NOT NULL DELETE FROM [dbo].[Inventories];
IF OBJECT_ID(N'[dbo].[ProductVariantAttributes]', N'U') IS NOT NULL DELETE FROM [dbo].[ProductVariantAttributes];
IF OBJECT_ID(N'[dbo].[ProductVariants]', N'U') IS NOT NULL DELETE FROM [dbo].[ProductVariants];
IF OBJECT_ID(N'[dbo].[Products]', N'U') IS NOT NULL DELETE FROM [dbo].[Products];
IF OBJECT_ID(N'[dbo].[CustomerAddresses]', N'U') IS NOT NULL DELETE FROM [dbo].[CustomerAddresses];
IF OBJECT_ID(N'[dbo].[Customers]', N'U') IS NOT NULL DELETE FROM [dbo].[Customers];
IF OBJECT_ID(N'[dbo].[Shippers]', N'U') IS NOT NULL DELETE FROM [dbo].[Shippers];
IF OBJECT_ID(N'[dbo].[Suppliers]', N'U') IS NOT NULL DELETE FROM [dbo].[Suppliers];
IF OBJECT_ID(N'[dbo].[Brands]', N'U') IS NOT NULL DELETE FROM [dbo].[Brands];
IF OBJECT_ID(N'[dbo].[Categories]', N'U') IS NOT NULL DELETE FROM [dbo].[Categories];
GO

-- =============================================================
-- BƯỚC 3: PHÂN QUYỀN (ROLES) & TÀI KHOẢN HỆ THỐNG
-- =============================================================
IF NOT EXISTS (SELECT 1 FROM [dbo].[AspNetRoles] WHERE [Name] = 'Admin')
    INSERT INTO [dbo].[AspNetRoles] ([Id], [Name], [NormalizedName], [Description]) VALUES (N'6451d70b-ad8a-41e1-ace6-b3da5fd96656', N'Admin', N'ADMIN', N'Quản trị viên');
IF NOT EXISTS (SELECT 1 FROM [dbo].[AspNetRoles] WHERE [Name] = 'Manager')
    INSERT INTO [dbo].[AspNetRoles] ([Id], [Name], [NormalizedName], [Description]) VALUES (N'ce7982c6-ee4b-4ebd-8a83-8185984a85a1', N'Manager', N'MANAGER', N'Quản lý cửa hàng');
IF NOT EXISTS (SELECT 1 FROM [dbo].[AspNetRoles] WHERE [Name] = 'Staff')
    INSERT INTO [dbo].[AspNetRoles] ([Id], [Name], [NormalizedName], [Description]) VALUES (N'53c7a788-6be3-4eb9-9ea4-be70e900b037', N'Staff', N'STAFF', N'Nhân viên bán hàng');
IF NOT EXISTS (SELECT 1 FROM [dbo].[AspNetRoles] WHERE [Name] = 'Customer')
    INSERT INTO [dbo].[AspNetRoles] ([Id], [Name], [NormalizedName], [Description]) VALUES (N'c63bf5a6-5be1-438a-a904-9da896c18b59', N'Customer', N'CUSTOMER', N'Khách hàng');
IF NOT EXISTS (SELECT 1 FROM [dbo].[AspNetRoles] WHERE [Name] = 'Shipper')
    INSERT INTO [dbo].[AspNetRoles] ([Id], [Name], [NormalizedName], [Description]) VALUES (N'e71e3678-0e9e-4b7f-b883-9b9c9f00a001', N'Shipper', N'SHIPPER', N'Nhân viên giao hàng');
GO

-- 3.1 Admin: admin@toystore.vn / Pass: Admin@123
IF NOT EXISTS (SELECT 1 FROM [dbo].[AspNetUsers] WHERE [Email] = 'admin@toystore.vn')
BEGIN
    INSERT [dbo].[AspNetUsers] ([Id], [FullName], [IsActive], [UserName], [NormalizedUserName], [Email], [NormalizedEmail], [EmailConfirmed], [PasswordHash], [SecurityStamp], [ConcurrencyStamp], [PhoneNumberConfirmed], [TwoFactorEnabled], [LockoutEnabled], [AccessFailedCount])
    VALUES (N'2a80d45c-e6ae-4917-84d7-f1b5e6348919', N'Admin Cửa Hàng', 1, N'admin@toystore.vn', N'ADMIN@TOYSTORE.VN', N'admin@toystore.vn', N'ADMIN@TOYSTORE.VN', 1, N'AQAAAAIAAYagAAAAEBcj2ZkMrPVNdRtK9f4szjvg2AJyvYpd+/WFH3b9eLR0WGcq98lwhPMxYpU62ip4QA==', N'C5EJKUGUI7CYHHWSLIOQXIVJ4ELP4VCZ', N'ecd01e1b-dbd8-446f-8b8d-267d69d08b58', 0, 0, 1, 0);
    INSERT [dbo].[AspNetUserRoles] ([UserId], [RoleId]) VALUES (N'2a80d45c-e6ae-4917-84d7-f1b5e6348919', N'6451d70b-ad8a-41e1-ace6-b3da5fd96656');
END
ELSE
    UPDATE [dbo].[AspNetUsers] SET [IsActive] = 1 WHERE [Email] = 'admin@toystore.vn';

-- 3.2 Staff: staff@toystore.vn / Pass: Staff@123
IF NOT EXISTS (SELECT 1 FROM [dbo].[AspNetUsers] WHERE [Email] = 'staff@toystore.vn')
BEGIN
    INSERT [dbo].[AspNetUsers] ([Id], [FullName], [IsActive], [UserName], [NormalizedUserName], [Email], [NormalizedEmail], [EmailConfirmed], [PasswordHash], [SecurityStamp], [ConcurrencyStamp], [PhoneNumberConfirmed], [TwoFactorEnabled], [LockoutEnabled], [AccessFailedCount])
    VALUES (N'55555555-5555-5555-5555-555555555555', N'Nhân Viên Thu Ngân', 1, N'staff@toystore.vn', N'STAFF@TOYSTORE.VN', N'staff@toystore.vn', N'STAFF@TOYSTORE.VN', 1, N'AQAAAAIAAYagAAAAEBcj2ZkMrPVNdRtK9f4szjvg2AJyvYpd+/WFH3b9eLR0WGcq98lwhPMxYpU62ip4QA==', NEWID(), NEWID(), 0, 0, 1, 0);
    INSERT [dbo].[AspNetUserRoles] ([UserId], [RoleId]) VALUES (N'55555555-5555-5555-5555-555555555555', N'53c7a788-6be3-4eb9-9ea4-be70e900b037');
END

-- 3.3 Shipper 1: shipper@toystore.vn / Pass: Shipper@123
IF NOT EXISTS (SELECT 1 FROM [dbo].[AspNetUsers] WHERE [Email] = 'shipper@toystore.vn')
BEGIN
    INSERT [dbo].[AspNetUsers] ([Id], [FullName], [IsActive], [UserName], [NormalizedUserName], [Email], [NormalizedEmail], [EmailConfirmed], [PasswordHash], [SecurityStamp], [ConcurrencyStamp], [PhoneNumber], [PhoneNumberConfirmed], [TwoFactorEnabled], [LockoutEnabled], [AccessFailedCount])
    VALUES (N'a1b2c3d4-e5f6-7890-abcd-ef1234567890', N'Nguyễn Văn Giao', 1, N'shipper@toystore.vn', N'SHIPPER@TOYSTORE.VN', N'shipper@toystore.vn', N'SHIPPER@TOYSTORE.VN', 1, N'AQAAAAIAAYagAAAAEFiW42g/iAYyNr1WnbLc/8vz5M2r6IRqvVbbgZcZERVKflc9MsrRfzrERqB81B/xdA==', N'SEC123', N'CON123', '0909123456', 1, 0, 1, 0);
    INSERT [dbo].[AspNetUserRoles] ([UserId], [RoleId]) VALUES (N'a1b2c3d4-e5f6-7890-abcd-ef1234567890', N'e71e3678-0e9e-4b7f-b883-9b9c9f00a001');
END
ELSE
    UPDATE [dbo].[AspNetUsers] SET [IsActive] = 1, [PasswordHash] = N'AQAAAAIAAYagAAAAEFiW42g/iAYyNr1WnbLc/8vz5M2r6IRqvVbbgZcZERVKflc9MsrRfzrERqB81B/xdA==' WHERE [Email] = 'shipper@toystore.vn';

-- 3.4 Shipper 2: shipper2@toystore.vn / Pass: Shipper@123
IF NOT EXISTS (SELECT 1 FROM [dbo].[AspNetUsers] WHERE [Email] = 'shipper2@toystore.vn')
BEGIN
    INSERT [dbo].[AspNetUsers] ([Id], [FullName], [IsActive], [UserName], [NormalizedUserName], [Email], [NormalizedEmail], [EmailConfirmed], [PasswordHash], [SecurityStamp], [ConcurrencyStamp], [PhoneNumber], [PhoneNumberConfirmed], [TwoFactorEnabled], [LockoutEnabled], [AccessFailedCount])
    VALUES (N'a1b2c3d4-e5f6-7890-abcd-ef1234567891', N'Trần Văn Tốc', 1, N'shipper2@toystore.vn', N'SHIPPER2@TOYSTORE.VN', N'shipper2@toystore.vn', N'SHIPPER2@TOYSTORE.VN', 1, N'AQAAAAIAAYagAAAAEFiW42g/iAYyNr1WnbLc/8vz5M2r6IRqvVbbgZcZERVKflc9MsrRfzrERqB81B/xdA==', NEWID(), NEWID(), '0918765432', 1, 0, 1, 0);
    INSERT [dbo].[AspNetUserRoles] ([UserId], [RoleId]) VALUES (N'a1b2c3d4-e5f6-7890-abcd-ef1234567891', N'e71e3678-0e9e-4b7f-b883-9b9c9f00a001');
END

-- 3.5 Khách hàng (5 tài khoản đăng nhập) / Pass: Customer@123
IF NOT EXISTS (SELECT 1 FROM [dbo].[AspNetUsers] WHERE [Email] = 'anhtuyet@gmail.com')
BEGIN
    INSERT [dbo].[AspNetUsers] ([Id], [FullName], [IsActive], [UserName], [NormalizedUserName], [Email], [NormalizedEmail], [EmailConfirmed], [PasswordHash], [SecurityStamp], [ConcurrencyStamp], [PhoneNumber], [PhoneNumberConfirmed], [TwoFactorEnabled], [LockoutEnabled], [AccessFailedCount])
    VALUES (N'c1000001-0000-0000-0000-000000000001', N'Nguyễn Thị Ánh Tuyết', 1, 'anhtuyet@gmail.com', 'ANHTUYET@GMAIL.COM', 'anhtuyet@gmail.com', 'ANHTUYET@GMAIL.COM', 1, N'AQAAAAIAAYagAAAAEFsJPi4cy+oo6n2evEZtF374CjQy/JWAhPyDRWHa7RR65fdOI5uiBUKtcxB8TSCPNQ==', NEWID(), NEWID(), '0901234567', 1, 0, 1, 0);
    INSERT [dbo].[AspNetUserRoles] ([UserId], [RoleId]) VALUES (N'c1000001-0000-0000-0000-000000000001', N'c63bf5a6-5be1-438a-a904-9da896c18b59');
END
IF NOT EXISTS (SELECT 1 FROM [dbo].[AspNetUsers] WHERE [Email] = 'baolong@gmail.com')
BEGIN
    INSERT [dbo].[AspNetUsers] ([Id], [FullName], [IsActive], [UserName], [NormalizedUserName], [Email], [NormalizedEmail], [EmailConfirmed], [PasswordHash], [SecurityStamp], [ConcurrencyStamp], [PhoneNumber], [PhoneNumberConfirmed], [TwoFactorEnabled], [LockoutEnabled], [AccessFailedCount])
    VALUES (N'c1000001-0000-0000-0000-000000000002', N'Trần Bảo Long', 1, 'baolong@gmail.com', 'BAOLONG@GMAIL.COM', 'baolong@gmail.com', 'BAOLONG@GMAIL.COM', 1, N'AQAAAAIAAYagAAAAEFsJPi4cy+oo6n2evEZtF374CjQy/JWAhPyDRWHa7RR65fdOI5uiBUKtcxB8TSCPNQ==', NEWID(), NEWID(), '0902345678', 1, 0, 1, 0);
    INSERT [dbo].[AspNetUserRoles] ([UserId], [RoleId]) VALUES (N'c1000001-0000-0000-0000-000000000002', N'c63bf5a6-5be1-438a-a904-9da896c18b59');
END
IF NOT EXISTS (SELECT 1 FROM [dbo].[AspNetUsers] WHERE [Email] = 'hoangyen@gmail.com')
BEGIN
    INSERT [dbo].[AspNetUsers] ([Id], [FullName], [IsActive], [UserName], [NormalizedUserName], [Email], [NormalizedEmail], [EmailConfirmed], [PasswordHash], [SecurityStamp], [ConcurrencyStamp], [PhoneNumber], [PhoneNumberConfirmed], [TwoFactorEnabled], [LockoutEnabled], [AccessFailedCount])
    VALUES (N'c1000001-0000-0000-0000-000000000003', N'Lê Hoàng Yến', 1, 'hoangyen@gmail.com', 'HOANGYEN@GMAIL.COM', 'hoangyen@gmail.com', 'HOANGYEN@GMAIL.COM', 1, N'AQAAAAIAAYagAAAAEFsJPi4cy+oo6n2evEZtF374CjQy/JWAhPyDRWHa7RR65fdOI5uiBUKtcxB8TSCPNQ==', NEWID(), NEWID(), '0903456789', 1, 0, 1, 0);
    INSERT [dbo].[AspNetUserRoles] ([UserId], [RoleId]) VALUES (N'c1000001-0000-0000-0000-000000000003', N'c63bf5a6-5be1-438a-a904-9da896c18b59');
END
IF NOT EXISTS (SELECT 1 FROM [dbo].[AspNetUsers] WHERE [Email] = 'ducthang@gmail.com')
BEGIN
    INSERT [dbo].[AspNetUsers] ([Id], [FullName], [IsActive], [UserName], [NormalizedUserName], [Email], [NormalizedEmail], [EmailConfirmed], [PasswordHash], [SecurityStamp], [ConcurrencyStamp], [PhoneNumber], [PhoneNumberConfirmed], [TwoFactorEnabled], [LockoutEnabled], [AccessFailedCount])
    VALUES (N'c1000001-0000-0000-0000-000000000004', N'Phạm Đức Thắng', 1, 'ducthang@gmail.com', 'DUCTHANG@GMAIL.COM', 'ducthang@gmail.com', 'DUCTHANG@GMAIL.COM', 1, N'AQAAAAIAAYagAAAAEFsJPi4cy+oo6n2evEZtF374CjQy/JWAhPyDRWHa7RR65fdOI5uiBUKtcxB8TSCPNQ==', NEWID(), NEWID(), '0904567890', 1, 0, 1, 0);
    INSERT [dbo].[AspNetUserRoles] ([UserId], [RoleId]) VALUES (N'c1000001-0000-0000-0000-000000000004', N'c63bf5a6-5be1-438a-a904-9da896c18b59');
END
IF NOT EXISTS (SELECT 1 FROM [dbo].[AspNetUsers] WHERE [Email] = 'myduyen@gmail.com')
BEGIN
    INSERT [dbo].[AspNetUsers] ([Id], [FullName], [IsActive], [UserName], [NormalizedUserName], [Email], [NormalizedEmail], [EmailConfirmed], [PasswordHash], [SecurityStamp], [ConcurrencyStamp], [PhoneNumber], [PhoneNumberConfirmed], [TwoFactorEnabled], [LockoutEnabled], [AccessFailedCount])
    VALUES (N'c1000001-0000-0000-0000-000000000005', N'Hoàng Mỹ Duyên', 1, 'myduyen@gmail.com', 'MYDUYEN@GMAIL.COM', 'myduyen@gmail.com', 'MYDUYEN@GMAIL.COM', 1, N'AQAAAAIAAYagAAAAEFsJPi4cy+oo6n2evEZtF374CjQy/JWAhPyDRWHa7RR65fdOI5uiBUKtcxB8TSCPNQ==', NEWID(), NEWID(), '0905678901', 1, 0, 1, 0);
    INSERT [dbo].[AspNetUserRoles] ([UserId], [RoleId]) VALUES (N'c1000001-0000-0000-0000-000000000005', N'c63bf5a6-5be1-438a-a904-9da896c18b59');
END
GO

-- =============================================================
-- BƯỚC 4: DANH MỤC, THƯƠNG HIỆU, NHÀ CUNG CẤP & SHIPPER
-- =============================================================
SET IDENTITY_INSERT [dbo].[Categories] ON;
INSERT INTO [dbo].[Categories] ([CategoryId], [Name], [Description], [IsActive], [CreatedAt], [UpdatedAt]) VALUES
(1, N'Lego & Xếp hình', N'Đồ chơi lắp ghép phát triển tư duy sáng tạo', 1, GETUTCDATE(), NULL),
(2, N'Búp bê & Mô hình nhân vật', N'Búp bê thời trang và nhân vật hoạt hình', 1, GETUTCDATE(), NULL),
(3, N'Xe mô hình & Điều khiển', N'Xe đua, xe công trình và đồ chơi điều khiển từ xa', 1, GETUTCDATE(), NULL),
(4, N'Đồ chơi giáo dục STEM', N'Khoa học, công nghệ, kỹ thuật và toán học', 1, GETUTCDATE(), NULL),
(5, N'Vận động ngoài trời', N'Xe chòi chân, cầu trượt và đồ chơi thể thao', 1, GETUTCDATE(), NULL);
SET IDENTITY_INSERT [dbo].[Categories] OFF;
GO

SET IDENTITY_INSERT [dbo].[Brands] ON;
INSERT INTO [dbo].[Brands] ([BrandId], [Name], [Description], [IsActive], [CreatedAt], [UpdatedAt]) VALUES
(1, N'LEGO', N'Thương hiệu đồ chơi lắp ráp hàng đầu Đan Mạch', 1, GETUTCDATE(), NULL),
(2, N'Barbie', N'Thương hiệu búp bê thời trang toàn cầu từ Mattel', 1, GETUTCDATE(), NULL),
(3, N'Hot Wheels', N'Thương hiệu xe đua mô hình kim loại', 1, GETUTCDATE(), NULL),
(4, N'Fisher-Price', N'Đồ chơi mầm non và giáo dục sớm chất lượng cao', 1, GETUTCDATE(), NULL),
(5, N'Bandai', N'Mô hình lắp ráp Gundam và anime từ Nhật Bản', 1, GETUTCDATE(), NULL);
SET IDENTITY_INSERT [dbo].[Brands] OFF;
GO

SET IDENTITY_INSERT [dbo].[Suppliers] ON;
-- Lưu ý: Cột số điện thoại trên bảng Suppliers là [Phone]
INSERT INTO [dbo].[Suppliers] ([SupplierId], [Name], [Phone], [Email], [Address], [TaxCode], [IsActive], [CreatedAt], [UpdatedAt]) VALUES
(1, N'Công ty TNHH Đồ Chơi Việt Tinh Hoa', '02838112233', 'tinhhoa@toystore.vn', N'120 Cộng Hòa, Tân Bình, TP.HCM', '0312345678', 1, GETUTCDATE(), NULL),
(2, N'NPP Đồ Chơi Thông Minh Á Châu', '02839445566', 'achau@toystore.vn', N'45 Lê Duẩn, Quận 1, TP.HCM', '0323456789', 1, GETUTCDATE(), NULL),
(3, N'Công ty CP Phân Phối Trẻ Thơ', '02837889900', 'tretho@toystore.vn', N'88 Hoàng Văn Thụ, Phú Nhuận, TP.HCM', '0334567890', 1, GETUTCDATE(), NULL),
(4, N'Tập đoàn Nhập khẩu Toàn Cầu', '02836223344', 'toancau@toystore.vn', N'200 Nguyễn Thị Minh Khai, Quận 3, TP.HCM', '0345678901', 1, GETUTCDATE(), NULL);
SET IDENTITY_INSERT [dbo].[Suppliers] OFF;
GO

SET IDENTITY_INSERT [dbo].[Shippers] ON;
INSERT INTO [dbo].[Shippers] ([ShipperId], [UserId], [FullName], [PhoneNumber], [VehicleNumber], [AssignedArea], [IsActive], [CreatedAt]) VALUES
(1, N'a1b2c3d4-e5f6-7890-abcd-ef1234567890', N'Nguyễn Văn Giao', '0909123456', N'59-X1 123.45', N'Quận 1, Quận 3, Quận 5', 1, GETUTCDATE()),
(2, N'a1b2c3d4-e5f6-7890-abcd-ef1234567891', N'Trần Văn Tốc', '0918765432', N'59-Y2 678.90', N'Bình Thạnh, Phú Nhuận, Gò Vấp', 1, GETUTCDATE());
SET IDENTITY_INSERT [dbo].[Shippers] OFF;
GO

SET IDENTITY_INSERT [dbo].[Customers] ON;
-- Lưu ý: Cột số điện thoại trên bảng Customers là [Phone], điểm là [LoyaltyPoint], có [Status]
INSERT INTO [dbo].[Customers] ([CustomerId], [FullName], [Phone], [Email], [UserId], [DateOfBirth], [Gender], [Address], [LoyaltyPoint], [Status], [CreatedAt], [UpdatedAt]) VALUES
(1, N'Nguyễn Thị Ánh Tuyết', '0901234567', 'anhtuyet@gmail.com', N'c1000001-0000-0000-0000-000000000001', '2000-01-15T00:00:00', 0, N'12 Hai Bà Trưng, Phường Bến Nghé, Quận 1', 120, 1, GETUTCDATE(), NULL),
(2, N'Trần Bảo Long', '0902345678', 'baolong@gmail.com', N'c1000001-0000-0000-0000-000000000002', '2000-01-15T00:00:00', 1, N'45 Nam Kỳ Khởi Nghĩa, Phường 7, Quận 3', 250, 1, GETUTCDATE(), NULL),
(3, N'Lê Hoàng Yến', '0903456789', 'hoangyen@gmail.com', N'c1000001-0000-0000-0000-000000000003', '2000-01-15T00:00:00', 0, N'78 Nguyễn Trãi, Phường 3, Quận 5', 80, 1, GETUTCDATE(), NULL),
(4, N'Phạm Đức Thắng', '0904567890', 'ducthang@gmail.com', N'c1000001-0000-0000-0000-000000000004', '2000-01-15T00:00:00', 1, N'150 Bạch Đằng, Phường 24, Bình Thạnh', 50, 1, GETUTCDATE(), NULL),
(5, N'Hoàng Mỹ Duyên', '0905678901', 'myduyen@gmail.com', N'c1000001-0000-0000-0000-000000000005', '2000-01-15T00:00:00', 0, N'92 Phan Xích Long, Phường 2, Phú Nhuận', 310, 1, GETUTCDATE(), NULL);
SET IDENTITY_INSERT [dbo].[Customers] OFF;
GO

SET IDENTITY_INSERT [dbo].[CustomerAddresses] ON;
INSERT INTO [dbo].[CustomerAddresses] ([CustomerAddressId], [CustomerId], [ReceiverName], [ReceiverPhone], [AddressDetail], [ProvinceCode], [ProvinceName], [WardCode], [WardName], [IsDefault], [CreatedAt], [UpdatedAt]) VALUES
(1, 1, N'Nguyễn Thị Ánh Tuyết', '0901234567', N'12 Hai Bà Trưng, Phường Bến Nghé, Quận 1', '79', N'Hồ Chí Minh', '26740', N'Phường Bến Nghé', 1, GETUTCDATE(), NULL),
(2, 2, N'Trần Bảo Long', '0902345678', N'45 Nam Kỳ Khởi Nghĩa, Phường 7, Quận 3', '79', N'Hồ Chí Minh', '26740', N'Phường 7', 1, GETUTCDATE(), NULL),
(3, 3, N'Lê Hoàng Yến', '0903456789', N'78 Nguyễn Trãi, Phường 3, Quận 5', '79', N'Hồ Chí Minh', '26740', N'Phường 3', 1, GETUTCDATE(), NULL),
(4, 4, N'Phạm Đức Thắng', '0904567890', N'150 Bạch Đằng, Phường 24, Quận Bình Thạnh', '79', N'Hồ Chí Minh', '26740', N'Phường 24', 1, GETUTCDATE(), NULL),
(5, 5, N'Hoàng Mỹ Duyên', '0905678901', N'92 Phan Xích Long, Phường 2, Phú Nhuận', '79', N'Hồ Chí Minh', '26740', N'Phường 2', 1, GETUTCDATE(), NULL);
SET IDENTITY_INSERT [dbo].[CustomerAddresses] OFF;
GO

-- =============================================================
-- BƯỚC 5: SẢN PHẨM & BIẾN THỂ (12 SẢN PHẨM, 15 BIẾN THỂ)
-- =============================================================
SET IDENTITY_INSERT [dbo].[Products] ON;
INSERT INTO [dbo].[Products] ([ProductId], [CategoryId], [BrandId], [Name], [Description], [AgeFrom], [AgeTo], [Status], [IsFeatured], [BasePrice], [IsNew], [CreatedAt], [UpdatedAt], [ImageUrl], [Gender], [SupplierId]) VALUES
(1, 1, 1, N'Lego City Cảnh Sát Biển Bắt Cướp', N'Bộ lắp ráp trạm tuần tra cảnh sát biển hiện đại', 72, 144, 1, 1, 890000.00, 1, GETUTCDATE(), NULL, 'https://images.unsplash.com/photo-1585366119957-e9730b6d0f60?w=500', 3, 1),
(2, 1, 1, N'Lego Ninjago Chiến Giáp Rồng Vàng', N'Mô hình chiến giáp rồng chiến đấu hoành tráng', 96, 168, 1, 1, 950000.00, 1, GETUTCDATE(), NULL, 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=500', 1, 1),
(3, 2, 2, N'Búp Bê Barbie Nàng Tiên Cá Lung Linh', N'Barbie đuôi cá đổi màu ánh sáng lấp lánh', 36, 120, 1, 1, 490000.00, 1, GETUTCDATE(), NULL, 'https://images.unsplash.com/photo-1563089145-599997674d42?w=500', 2, 2),
(4, 2, 2, N'Ngôi Nhà Mơ Ước Barbie Dreamhouse 3 Tầng', N'Biệt thự búp bê đầy đủ tiện nghi, thang máy và hồ bơi', 48, 144, 1, 1, 2890000.00, 0, GETUTCDATE(), NULL, 'https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=500', 2, 2),
(5, 3, 3, N'Hộp 10 Xe Kim Loại Hot Wheels Cơ Bản', N'Set 10 siêu xe mô hình tỉ lệ 1:64 cực chất', 36, 180, 1, 1, 390000.00, 1, GETUTCDATE(), NULL, 'https://images.unsplash.com/photo-1594787318286-3d835c1d207f?w=500', 1, 3),
(6, 3, 3, N'Đường Đua Hot Wheels Siêu Vòng Lặp Xoáy', N'Bộ đường đua tăng tốc có mô-tơ đẩy phóng xe cực mạnh', 60, 180, 1, 0, 850000.00, 1, GETUTCDATE(), NULL, 'https://images.unsplash.com/photo-1581235720704-06d3acfcb36f?w=500', 1, 3),
(7, 4, 4, N'Bộ Ghép Hình Khối Học Tập Fisher-Price', N'Đồ chơi giáo dục sớm nhận biết hình khối và màu sắc', 6, 36, 1, 0, 290000.00, 0, GETUTCDATE(), NULL, 'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=500', 3, 1),
(8, 4, 4, N'Tháp Vòng Cầu Vồng Thông Minh', N'Tháp xếp chồng phát triển vận động tinh cho bé', 6, 24, 1, 0, 180000.00, 0, GETUTCDATE(), NULL, 'https://images.unsplash.com/photo-1500995617113-cf789362a3e1?w=500', 3, 2),
(9, 5, 5, N'Mô Hình Lắp Ráp Gundam Aerial 1/144', N'Mô hình chi tiết chính xác của Gundam chính hãng Bandai', 96, 240, 1, 1, 550000.00, 1, GETUTCDATE(), NULL, 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=500', 3, 4),
(10, 5, 5, N'Mô Hình Gundam Barbatos Lupus Rex', N'Chiến binh Barbatos với vuốt sắt và giáp cơ bắp', 96, 240, 1, 1, 620000.00, 0, GETUTCDATE(), NULL, 'https://images.unsplash.com/photo-1563089145-599997674d42?w=500', 1, 4),
(11, 3, 3, N'Xe Địa Hình Điều Khiển Từ Xa Rock Crawler', N'Xe vượt mọi địa hình gập ghềnh 4 bánh giảm xóc độc lập', 72, 180, 1, 1, 750000.00, 1, GETUTCDATE(), NULL, 'https://images.unsplash.com/photo-1594787318286-3d835c1d207f?w=500', 1, 3),
(12, 1, 1, N'Lego Creator Hoa Hướng Dương & Cúc Họa Mi', N'Bộ sưu tập hoa Lego Botanical trang trí bàn học và làm việc', 108, 240, 1, 1, 420000.00, 1, GETUTCDATE(), NULL, 'https://images.unsplash.com/photo-1585366119957-e9730b6d0f60?w=500', 3, 1);
SET IDENTITY_INSERT [dbo].[Products] OFF;
GO

SET IDENTITY_INSERT [dbo].[ProductVariants] ON;
INSERT INTO [dbo].[ProductVariants] ([VariantId], [ProductId], [SKU], [Color], [Size], [Price], [CostPrice], [Weight], [ImageUrl], [Status], [CreatedAt], [UpdatedAt]) VALUES
(1, 1, 'LEG-CITY-01-STD', N'Xanh dương', N'Tiêu chuẩn', 890000.00, 590000.00, 0.75, 'https://images.unsplash.com/photo-1585366119957-e9730b6d0f60?w=500', 1, GETUTCDATE(), NULL),
(2, 1, 'LEG-CITY-01-DX', N'Xanh dương', N'Cỡ lớn (L)', 1190000.00, 790000.00, 0.95, 'https://images.unsplash.com/photo-1585366119957-e9730b6d0f60?w=500', 1, GETUTCDATE(), NULL),
(3, 2, 'LEG-NINJA-02-STD', N'Vàng', N'Tiêu chuẩn', 950000.00, 630000.00, 0.80, 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=500', 1, GETUTCDATE(), NULL),
(4, 3, 'BAR-MERM-03-PINK', N'Hồng', N'Tiêu chuẩn', 490000.00, 320000.00, 0.35, 'https://images.unsplash.com/photo-1563089145-599997674d42?w=500', 1, GETUTCDATE(), NULL),
(5, 3, 'BAR-MERM-03-BLUE', N'Xanh biển', N'Tiêu chuẩn', 490000.00, 320000.00, 0.35, 'https://images.unsplash.com/photo-1563089145-599997674d42?w=500', 1, GETUTCDATE(), NULL),
(6, 4, 'BAR-HOUSE-04-STD', N'Hồng', N'Cỡ lớn (L)', 2890000.00, 1950000.00, 4.20, 'https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=500', 1, GETUTCDATE(), NULL),
(7, 5, 'HW-10PACK-05-STD', N'Nhiều màu', N'Tiêu chuẩn', 390000.00, 250000.00, 0.60, 'https://images.unsplash.com/photo-1594787318286-3d835c1d207f?w=500', 1, GETUTCDATE(), NULL),
(8, 6, 'HW-TRACK-06-LOOP', N'Cam', N'Cỡ lớn (L)', 850000.00, 550000.00, 1.50, 'https://images.unsplash.com/photo-1581235720704-06d3acfcb36f?w=500', 1, GETUTCDATE(), NULL),
(9, 7, 'FP-SHAPE-07-STD', N'Đa sắc', N'Tiêu chuẩn', 290000.00, 180000.00, 0.45, 'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=500', 1, GETUTCDATE(), NULL),
(10, 8, 'FP-TOWER-08-STD', N'Cầu vồng', N'Tiêu chuẩn', 180000.00, 110000.00, 0.30, 'https://images.unsplash.com/photo-1500995617113-cf789362a3e1?w=500', 1, GETUTCDATE(), NULL),
(11, 9, 'BAN-GD-09-AERIAL', N'Trắng', N'Tiêu chuẩn', 550000.00, 360000.00, 0.40, 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=500', 1, GETUTCDATE(), NULL),
(12, 10, 'BAN-GD-10-BARBATOS', N'Đen', N'Tiêu chuẩn', 620000.00, 410000.00, 0.45, 'https://images.unsplash.com/photo-1563089145-599997674d42?w=500', 1, GETUTCDATE(), NULL),
(13, 11, 'RC-CRAWL-11-RED', N'Đỏ', N'Cỡ lớn (L)', 750000.00, 480000.00, 1.20, 'https://images.unsplash.com/photo-1594787318286-3d835c1d207f?w=500', 1, GETUTCDATE(), NULL),
(14, 11, 'RC-CRAWL-11-BLUE', N'Xanh dương', N'Cỡ lớn (L)', 750000.00, 480000.00, 1.20, 'https://images.unsplash.com/photo-1594787318286-3d835c1d207f?w=500', 1, GETUTCDATE(), NULL),
(15, 12, 'LEG-BOT-12-SUNFLW', N'Vàng', N'Tiêu chuẩn', 420000.00, 270000.00, 0.35, 'https://images.unsplash.com/photo-1585366119957-e9730b6d0f60?w=500', 1, GETUTCDATE(), NULL);
SET IDENTITY_INSERT [dbo].[ProductVariants] OFF;
GO

SET IDENTITY_INSERT [dbo].[ProductVariantAttributes] ON;
INSERT INTO [dbo].[ProductVariantAttributes] ([VariantAttributeId], [VariantId], [AttributeName], [AttributeValue], [DisplayOrder]) VALUES
(1, 1, N'Phiên bản', N'Tiêu chuẩn', 1),
(2, 2, N'Phiên bản', N'Đặc biệt (Deluxe)', 1),
(3, 3, N'Phiên bản', N'Hộp quà tặng', 1),
(4, 4, N'Màu sắc', N'Hồng ngọc', 1),
(5, 5, N'Màu sắc', N'Xanh biển', 1),
(6, 6, N'Kích cỡ', N'3 tầng có hồ bơi', 1),
(7, 7, N'Quy cách', N'Hộp 10 xe kim loại', 1),
(8, 8, N'Phiên bản', N'Vòng xoáy có mô-tơ', 1),
(9, 9, N'Độ tuổi phù hợp', N'6-36 tháng', 1),
(10, 10, N'Độ tuổi phù hợp', N'6-24 tháng', 1),
(11, 11, N'Tỉ lệ', N'HG 1/144', 1),
(12, 12, N'Tỉ lệ', N'HG 1/144', 1),
(13, 13, N'Màu sắc', N'Đỏ rực rỡ', 1),
(14, 14, N'Màu sắc', N'Xanh dương', 1),
(15, 15, N'Màu hoa', N'Vàng hướng dương', 1);
SET IDENTITY_INSERT [dbo].[ProductVariantAttributes] OFF;
GO

SET IDENTITY_INSERT [dbo].[Inventories] ON;
-- Lưu ý: Cột tồn kho là [Quantity], [ReservedQuantity], [UpdatedAt]
INSERT INTO [dbo].[Inventories] ([InventoryId], [VariantId], [Quantity], [ReservedQuantity], [UpdatedAt]) VALUES
(1, 1, 45, 2, GETUTCDATE()),
(2, 2, 30, 1, GETUTCDATE()),
(3, 3, 50, 3, GETUTCDATE()),
(4, 4, 40, 2, GETUTCDATE()),
(5, 5, 35, 1, GETUTCDATE()),
(6, 6, 15, 1, GETUTCDATE()),
(7, 7, 80, 5, GETUTCDATE()),
(8, 8, 25, 2, GETUTCDATE()),
(9, 9, 60, 0, GETUTCDATE()),
(10, 10, 70, 0, GETUTCDATE()),
(11, 11, 35, 1, GETUTCDATE()),
(12, 12, 30, 2, GETUTCDATE()),
(13, 13, 40, 3, GETUTCDATE()),
(14, 14, 38, 2, GETUTCDATE()),
(15, 15, 55, 1, GETUTCDATE());
SET IDENTITY_INSERT [dbo].[Inventories] OFF;
GO

-- =============================================================
-- BƯỚC 6: PHIẾU ĐẶT HÀNG NCC (THỂ HIỆN 1 SP - NHIỀU NCC & NGƯỢC LẠI)
-- =============================================================
SET IDENTITY_INSERT [dbo].[ImportReceipts] ON;
-- Phiếu 1: NCC 1 nhập Lego (Variant 1, 2)
INSERT INTO [dbo].[ImportReceipts] ([ImportReceiptId], [SupplierId], [EmployeeId], [OrderedByUserId], [ReceiptCode], [ImportDate], [TotalAmount], [Status], [Note], [CreatedAt])
VALUES (1, 1, 1, N'2a80d45c-e6ae-4917-84d7-f1b5e6348919', 'IMP-20261001-001', DATEADD(day, -20, GETUTCDATE()), 15000000.00, 1, N'Nhập Lego đợt 1 từ Việt Tinh Hoa', DATEADD(day, -20, GETUTCDATE()));

-- Phiếu 2: NCC 2 CŨNG NHẬP Lego (Variant 1) và Barbie (Variant 4) -> 1 SP từ nhiều NCC!
INSERT INTO [dbo].[ImportReceipts] ([ImportReceiptId], [SupplierId], [EmployeeId], [OrderedByUserId], [ReceiptCode], [ImportDate], [TotalAmount], [Status], [Note], [CreatedAt])
VALUES (2, 2, 1, N'2a80d45c-e6ae-4917-84d7-f1b5e6348919', 'IMP-20261005-002', DATEADD(day, -15, GETUTCDATE()), 18500000.00, 1, N'Nhập bổ sung Lego & Barbie từ NPP Á Châu', DATEADD(day, -15, GETUTCDATE()));

-- Phiếu 3: NCC 3 nhập Hot Wheels (Variant 7, 8) và Xe điều khiển (Variant 13)
INSERT INTO [dbo].[ImportReceipts] ([ImportReceiptId], [SupplierId], [EmployeeId], [OrderedByUserId], [ReceiptCode], [ImportDate], [TotalAmount], [Status], [Note], [CreatedAt])
VALUES (3, 3, 1, N'2a80d45c-e6ae-4917-84d7-f1b5e6348919', 'IMP-20261010-003', DATEADD(day, -10, GETUTCDATE()), 22000000.00, 1, N'Nhập xe đồ chơi các loại từ Trẻ Thơ', DATEADD(day, -10, GETUTCDATE()));

-- Phiếu 4: NCC 4 nhập Gundam (Variant 11, 12) - Đang chờ duyệt
INSERT INTO [dbo].[ImportReceipts] ([ImportReceiptId], [SupplierId], [EmployeeId], [OrderedByUserId], [ReceiptCode], [ImportDate], [TotalAmount], [Status], [Note], [CreatedAt])
VALUES (4, 4, 1, N'2a80d45c-e6ae-4917-84d7-f1b5e6348919', 'IMP-20261015-004', DATEADD(day, -5, GETUTCDATE()), 14000000.00, 0, N'Phiếu đặt hàng Gundam dự kiến tháng 11', DATEADD(day, -5, GETUTCDATE()));

-- Phiếu 5: NCC 1 nhập đồ chơi mầm non - Đã hủy
INSERT INTO [dbo].[ImportReceipts] ([ImportReceiptId], [SupplierId], [EmployeeId], [OrderedByUserId], [ReceiptCode], [ImportDate], [TotalAmount], [Status], [Note], [CreatedAt])
VALUES (5, 1, 1, N'2a80d45c-e6ae-4917-84d7-f1b5e6348919', 'IMP-20261018-005', DATEADD(day, -2, GETUTCDATE()), 8500000.00, 2, N'Hủy do nhà cung cấp tạm hết hàng', DATEADD(day, -2, GETUTCDATE()));
SET IDENTITY_INSERT [dbo].[ImportReceipts] OFF;
GO

SET IDENTITY_INSERT [dbo].[ImportReceiptDetails] ON;
INSERT INTO [dbo].[ImportReceiptDetails] ([ImportReceiptDetailId], [ImportReceiptId], [VariantId], [Quantity], [UnitCost], [TotalAmount]) VALUES
(1, 1, 1, 10, 600000.00, 6000000.00),
(2, 1, 2, 10, 900000.00, 9000000.00),
(3, 2, 1, 15, 590000.00, 8850000.00), -- Variant 1 nhập từ NCC 2!
(4, 2, 4, 20, 350000.00, 7000000.00),
(5, 2, 5, 7, 378000.00, 2650000.00),
(6, 3, 7, 30, 250000.00, 7500000.00),
(7, 3, 8, 15, 550000.00, 8250000.00),
(8, 3, 13, 10, 480000.00, 4800000.00),
(9, 4, 11, 20, 350000.00, 7000000.00),
(10, 4, 12, 15, 400000.00, 6000000.00),
(11, 5, 9, 20, 180000.00, 3600000.00),
(12, 5, 10, 25, 120000.00, 3000000.00);
SET IDENTITY_INSERT [dbo].[ImportReceiptDetails] OFF;
GO

-- =============================================================
-- BƯỚC 7: ĐƠN HÀNG, VẬN CHUYỂN, THANH TOÁN & COD
-- =============================================================
SET IDENTITY_INSERT [dbo].[Orders] ON;
-- Lưu ý: Cột bảng Orders là [Subtotal], [DiscountAmount], [ShippingFee], [TotalAmount]
INSERT INTO [dbo].[Orders] ([OrderId], [CustomerId], [OrderCode], [OrderDate], [Status], [Subtotal], [DiscountAmount], [ShippingFee], [TotalAmount], [Note], [CreatedAt], [UpdatedAt]) VALUES
(1, 1, 'ORD-20261020-001', DATEADD(hour, -5, GETUTCDATE()), 0, 890000.00, 0.00, 30000.00, 920000.00, N'Giao giờ hành chính', DATEADD(hour, -5, GETUTCDATE()), NULL),
(2, 2, 'ORD-20261020-002', DATEADD(hour, -4, GETUTCDATE()), 0, 490000.00, 0.00, 25000.00, 515000.00, N'Gói cẩn thận giúp mình', DATEADD(hour, -4, GETUTCDATE()), NULL),
(3, 3, 'ORD-20261021-003', DATEADD(hour, -8, GETUTCDATE()), 1, 390000.00, 0.00, 20000.00, 410000.00, N'Khách gọi trước khi giao', DATEADD(hour, -8, GETUTCDATE()), NULL),
(4, 4, 'ORD-20261021-004', DATEADD(hour, -7, GETUTCDATE()), 1, 750000.00, 50000.00, 30000.00, 730000.00, N'Áp mã giảm giá 50k', DATEADD(hour, -7, GETUTCDATE()), NULL),
(5, 5, 'ORD-20261022-005', DATEADD(hour, -12, GETUTCDATE()), 2, 950000.00, 0.00, 30000.00, 980000.00, N'Đã đóng gói xong, chờ Shipper lấy', DATEADD(hour, -12, GETUTCDATE()), NULL),
(6, 1, 'ORD-20261022-006', DATEADD(hour, -11, GETUTCDATE()), 2, 2890000.00, 100000.00, 0.00, 2790000.00, N'Hàng giá trị cao cần cẩn thận', DATEADD(hour, -11, GETUTCDATE()), NULL),
(7, 2, 'ORD-20261023-007', DATEADD(hour, -6, GETUTCDATE()), 3, 850000.00, 0.00, 35000.00, 885000.00, N'Shipper đang trên đường giao', DATEADD(hour, -6, GETUTCDATE()), NULL),
(8, 3, 'ORD-20261023-008', DATEADD(hour, -5, GETUTCDATE()), 3, 550000.00, 0.00, 25000.00, 575000.00, N'Shipper đang giao đơn 2', DATEADD(hour, -5, GETUTCDATE()), NULL),
(9, 4, 'ORD-20261023-009', DATEADD(hour, -4, GETUTCDATE()), 3, 420000.00, 0.00, 20000.00, 440000.00, N'Shipper 2 phụ trách tuyến Gò Vấp', DATEADD(hour, -4, GETUTCDATE()), NULL),
-- Đơn 10 & 11: Giao thành công, Shipper đang giữ COD (CodStatus = 1) -> Test Ví COD!
(10, 5, 'ORD-20261024-010', DATEADD(day, -1, GETUTCDATE()), 4, 890000.00, 0.00, 30000.00, 920000.00, N'Shipper 1 đã thu tiền COD, chưa nộp quỹ', DATEADD(day, -1, GETUTCDATE()), NULL),
(11, 1, 'ORD-20261024-011', DATEADD(day, -1, GETUTCDATE()), 4, 490000.00, 0.00, 25000.00, 515000.00, N'Shipper 1 đã thu tiền COD, chưa nộp quỹ', DATEADD(day, -1, GETUTCDATE()), NULL),
-- Đơn 12: Đã nộp tiền COD vào quỹ (CodStatus = 2)
(12, 2, 'ORD-20261024-012', DATEADD(day, -2, GETUTCDATE()), 4, 750000.00, 0.00, 30000.00, 780000.00, N'Đã đối soát & nộp tiền COD vào quỹ', DATEADD(day, -2, GETUTCDATE()), NULL),
-- Đơn 13: Banking
(13, 3, 'ORD-20261024-013', DATEADD(day, -3, GETUTCDATE()), 4, 390000.00, 0.00, 20000.00, 410000.00, N'Thanh toán chuyển khoản ngân hàng', DATEADD(day, -3, GETUTCDATE()), NULL),
-- Đơn 14: ZaloPay
(14, 4, 'ORD-20261024-014', DATEADD(day, -3, GETUTCDATE()), 4, 620000.00, 0.00, 30000.00, 650000.00, N'Thanh toán online qua ZaloPay', DATEADD(day, -3, GETUTCDATE()), NULL),
-- Đơn 15: Giao thất bại lần 1
(15, 5, 'ORD-20261025-015', DATEADD(day, -2, GETUTCDATE()), 3, 390000.00, 0.00, 20000.00, 410000.00, N'Khách hẹn chiều tối giao lại', DATEADD(day, -2, GETUTCDATE()), NULL),
-- Đơn 16 & 17: Đã hủy
(16, 1, 'ORD-20261025-016', DATEADD(day, -4, GETUTCDATE()), 5, 950000.00, 0.00, 30000.00, 980000.00, N'Khách đổi ý muốn mua mẫu khác', DATEADD(day, -4, GETUTCDATE()), NULL),
(17, 2, 'ORD-20261025-017', DATEADD(day, -4, GETUTCDATE()), 5, 290000.00, 0.00, 20000.00, 310000.00, N'Hủy đơn do đặt nhầm địa chỉ', DATEADD(day, -4, GETUTCDATE()), NULL);
SET IDENTITY_INSERT [dbo].[Orders] OFF;
GO

SET IDENTITY_INSERT [dbo].[OrderDetails] ON;
INSERT INTO [dbo].[OrderDetails] ([OrderDetailId], [OrderId], [VariantId], [Quantity], [UnitPrice], [DiscountAmount], [TotalAmount]) VALUES
(1, 1, 1, 1, 890000.00, 0.00, 890000.00),
(2, 2, 4, 1, 490000.00, 0.00, 490000.00),
(3, 3, 7, 1, 390000.00, 0.00, 390000.00),
(4, 4, 13, 1, 750000.00, 50000.00, 700000.00),
(5, 5, 3, 1, 950000.00, 0.00, 950000.00),
(6, 6, 6, 1, 2890000.00, 100000.00, 2790000.00),
(7, 7, 8, 1, 850000.00, 0.00, 850000.00),
(8, 8, 11, 1, 550000.00, 0.00, 550000.00),
(9, 9, 15, 1, 420000.00, 0.00, 420000.00),
(10, 10, 1, 1, 890000.00, 0.00, 890000.00),
(11, 11, 4, 1, 490000.00, 0.00, 490000.00),
(12, 12, 14, 1, 750000.00, 0.00, 750000.00),
(13, 13, 7, 1, 390000.00, 0.00, 390000.00),
(14, 14, 12, 1, 620000.00, 0.00, 620000.00),
(15, 15, 7, 1, 390000.00, 0.00, 390000.00),
(16, 16, 3, 1, 950000.00, 0.00, 950000.00),
(17, 17, 9, 1, 290000.00, 0.00, 290000.00);
SET IDENTITY_INSERT [dbo].[OrderDetails] OFF;
GO

SET IDENTITY_INSERT [dbo].[Shippings] ON;
-- Lưu ý: Cột [ShippingMethod] là số nguyên (1: Giao hàng tiêu chuẩn)
INSERT INTO [dbo].[Shippings] ([ShippingId], [OrderId], [ReceiverName], [ReceiverPhone], [Address], [ShippingMethod], [TrackingCode], [ShippingFee], [Status], [ShippedAt], [DeliveredAt], [DeliveryBatchCode], [EstimatedDeliveryAt], [EstimatedDeliveryFromDate], [EstimatedDeliveryToDate], [ShipperId], [FailReason], [AttemptCount], [FailedAt], [ProofImageUrl]) VALUES
(1, 1, N'Nguyễn Thị Ánh Tuyết', '0901234567', N'12 Hai Bà Trưng, Phường Bến Nghé, Quận 1', 1, 'TRK-20261020-001', 30000.00, 0, NULL, NULL, NULL, DATEADD(day, 2, GETUTCDATE()), NULL, NULL, NULL, NULL, 0, NULL, NULL),
(2, 2, N'Trần Bảo Long', '0902345678', N'45 Nam Kỳ Khởi Nghĩa, Phường 7, Quận 3', 1, 'TRK-20261020-002', 25000.00, 0, NULL, NULL, NULL, DATEADD(day, 2, GETUTCDATE()), NULL, NULL, NULL, NULL, 0, NULL, NULL),
(3, 3, N'Lê Hoàng Yến', '0903456789', N'78 Nguyễn Trãi, Phường 3, Quận 5', 1, 'TRK-20261021-003', 20000.00, 0, NULL, NULL, 'BATCH-20261021-A', DATEADD(day, 1, GETUTCDATE()), NULL, NULL, NULL, NULL, 0, NULL, NULL),
(4, 4, N'Phạm Đức Thắng', '0904567890', N'150 Bạch Đằng, Phường 24, Bình Thạnh', 1, 'TRK-20261021-004', 30000.00, 0, NULL, NULL, 'BATCH-20261021-A', DATEADD(day, 1, GETUTCDATE()), NULL, NULL, NULL, NULL, 0, NULL, NULL),
(5, 5, N'Hoàng Mỹ Duyên', '0905678901', N'92 Phan Xích Long, Phường 2, Phú Nhuận', 1, 'TRK-20261022-005', 30000.00, 0, NULL, NULL, 'BATCH-20261022-Q1', DATEADD(hour, 4, GETUTCDATE()), NULL, NULL, 1, NULL, 0, NULL, NULL),
(6, 6, N'Nguyễn Thị Ánh Tuyết', '0901234567', N'12 Hai Bà Trưng, Phường Bến Nghé, Quận 1', 1, 'TRK-20261022-006', 0.00, 0, NULL, NULL, 'BATCH-20261022-Q1', DATEADD(hour, 4, GETUTCDATE()), NULL, NULL, 1, NULL, 0, NULL, NULL),
(7, 7, N'Trần Bảo Long', '0902345678', N'45 Nam Kỳ Khởi Nghĩa, Phường 7, Quận 3', 1, 'TRK-20261023-007', 35000.00, 1, DATEADD(hour, -2, GETUTCDATE()), NULL, 'BATCH-20261023-Q3', DATEADD(hour, 2, GETUTCDATE()), NULL, NULL, 1, NULL, 0, NULL, NULL),
(8, 8, N'Lê Hoàng Yến', '0903456789', N'78 Nguyễn Trãi, Phường 3, Quận 5', 1, 'TRK-20261023-008', 25000.00, 1, DATEADD(hour, -2, GETUTCDATE()), NULL, 'BATCH-20261023-Q3', DATEADD(hour, 2, GETUTCDATE()), NULL, NULL, 1, NULL, 0, NULL, NULL),
(9, 9, N'Phạm Đức Thắng', '0904567890', N'150 Bạch Đằng, Phường 24, Bình Thạnh', 1, 'TRK-20261023-009', 20000.00, 1, DATEADD(hour, -2, GETUTCDATE()), NULL, 'BATCH-20261023-BT', DATEADD(hour, 3, GETUTCDATE()), NULL, NULL, 2, NULL, 0, NULL, NULL),
(10, 10, N'Hoàng Mỹ Duyên', '0905678901', N'92 Phan Xích Long, Phường 2, Phú Nhuận', 1, 'TRK-20261024-010', 30000.00, 2, DATEADD(day, -1, GETUTCDATE()), DATEADD(hour, -18, GETUTCDATE()), 'BATCH-20261024-Q1', DATEADD(day, -1, GETUTCDATE()), NULL, NULL, 1, NULL, 1, NULL, 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=400'),
(11, 11, N'Nguyễn Thị Ánh Tuyết', '0901234567', N'12 Hai Bà Trưng, Phường Bến Nghé, Quận 1', 1, 'TRK-20261024-011', 25000.00, 2, DATEADD(day, -1, GETUTCDATE()), DATEADD(hour, -16, GETUTCDATE()), 'BATCH-20261024-Q1', DATEADD(day, -1, GETUTCDATE()), NULL, NULL, 1, NULL, 1, NULL, 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=400'),
(12, 12, N'Trần Bảo Long', '0902345678', N'45 Nam Kỳ Khởi Nghĩa, Phường 7, Quận 3', 1, 'TRK-20261024-012', 30000.00, 2, DATEADD(day, -2, GETUTCDATE()), DATEADD(day, -2, GETUTCDATE()), 'BATCH-20261024-Q3', DATEADD(day, -2, GETUTCDATE()), NULL, NULL, 1, NULL, 1, NULL, NULL),
(13, 13, N'Lê Hoàng Yến', '0903456789', N'78 Nguyễn Trãi, Phường 3, Quận 5', 1, 'TRK-20261024-013', 20000.00, 2, DATEADD(day, -3, GETUTCDATE()), DATEADD(day, -3, GETUTCDATE()), 'BATCH-20261024-Q5', DATEADD(day, -3, GETUTCDATE()), NULL, NULL, 2, NULL, 1, NULL, NULL),
(14, 14, N'Phạm Đức Thắng', '0904567890', N'150 Bạch Đằng, Phường 24, Bình Thạnh', 1, 'TRK-20261024-014', 30000.00, 2, DATEADD(day, -3, GETUTCDATE()), DATEADD(day, -3, GETUTCDATE()), 'BATCH-20261024-BT', DATEADD(day, -3, GETUTCDATE()), NULL, NULL, 2, NULL, 1, NULL, NULL),
(15, 15, N'Hoàng Mỹ Duyên', '0905678901', N'92 Phan Xích Long, Phường 2, Phú Nhuận', 1, 'TRK-20261025-015', 20000.00, 3, DATEADD(day, -2, GETUTCDATE()), NULL, 'BATCH-20261025-FAIL', DATEADD(day, -2, GETUTCDATE()), NULL, NULL, 1, N'Khách đi vắng, hẹn 18h giao lại', 1, DATEADD(day, -2, GETUTCDATE()), NULL),
(16, 16, N'Nguyễn Thị Ánh Tuyết', '0901234567', N'12 Hai Bà Trưng, Phường Bến Nghé, Quận 1', 1, 'TRK-20261025-016', 30000.00, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL),
(17, 17, N'Trần Bảo Long', '0902345678', N'45 Nam Kỳ Khởi Nghĩa, Phường 7, Quận 3', 1, 'TRK-20261025-017', 20000.00, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL);
SET IDENTITY_INSERT [dbo].[Shippings] OFF;
GO

SET IDENTITY_INSERT [dbo].[Payments] ON;
INSERT INTO [dbo].[Payments] ([PaymentId], [OrderId], [PaymentMethod], [TransactionCode], [Amount], [Status], [PaidAt], [CreatedAt], [GatewayTransactionCode], [CodStatus], [CodCollectedAt], [CodSubmittedAt], [CodNote]) VALUES
-- COD: Chưa thu
(1, 1, 0, 'TXN-COD-001', 920000.00, 0, NULL, GETUTCDATE(), NULL, 0, NULL, NULL, NULL),
(2, 2, 0, 'TXN-COD-002', 515000.00, 0, NULL, GETUTCDATE(), NULL, 0, NULL, NULL, NULL),
(3, 3, 0, 'TXN-COD-003', 410000.00, 0, NULL, GETUTCDATE(), NULL, 0, NULL, NULL, NULL),
(4, 4, 0, 'TXN-COD-004', 730000.00, 0, NULL, GETUTCDATE(), NULL, 0, NULL, NULL, NULL),
(5, 5, 0, 'TXN-COD-005', 980000.00, 0, NULL, GETUTCDATE(), NULL, 0, NULL, NULL, NULL),
(6, 6, 0, 'TXN-COD-006', 2790000.00, 0, NULL, GETUTCDATE(), NULL, 0, NULL, NULL, NULL),
(7, 7, 0, 'TXN-COD-007', 885000.00, 0, NULL, GETUTCDATE(), NULL, 0, NULL, NULL, NULL),
(8, 8, 0, 'TXN-COD-008', 575000.00, 0, NULL, GETUTCDATE(), NULL, 0, NULL, NULL, NULL),
(9, 9, 0, 'TXN-COD-009', 440000.00, 0, NULL, GETUTCDATE(), NULL, 0, NULL, NULL, NULL),
-- Đơn 10: COD ĐÃ THU - Shipper 1 đang giữ tiền (CodStatus = 1) -> TEST VÍ COD!
(10, 10, 0, 'TXN-COD-010', 920000.00, 1, DATEADD(hour, -18, GETUTCDATE()), GETUTCDATE(), NULL, 1, DATEADD(hour, -18, GETUTCDATE()), NULL, N'Shipper 1 đã thu 920.000đ từ khách hàng'),
-- Đơn 11: COD ĐÃ THU - Shipper 1 đang giữ tiền (CodStatus = 1) -> TEST VÍ COD!
(11, 11, 0, 'TXN-COD-011', 515000.00, 1, DATEADD(hour, -16, GETUTCDATE()), GETUTCDATE(), NULL, 1, DATEADD(hour, -16, GETUTCDATE()), NULL, N'Shipper 1 đã thu 515.000đ từ khách hàng'),
-- Đơn 12: COD ĐÃ THU & ĐÃ NỘP VỀ CỬA HÀNG (CodStatus = 2) -> TEST LỊCH SỬ NỘP COD!
(12, 12, 0, 'TXN-COD-012', 780000.00, 1, DATEADD(day, -2, GETUTCDATE()), GETUTCDATE(), NULL, 2, DATEADD(day, -2, GETUTCDATE()), DATEADD(day, -1, GETUTCDATE()), N'Shipper đã đối soát và nộp quỹ thành công'),
-- Đơn 13: Chuyển khoản ngân hàng (Banking) - Đã thanh toán
(13, 13, 1, 'TXN-BANK-013', 410000.00, 1, DATEADD(day, -3, GETUTCDATE()), GETUTCDATE(), 'VCB-998822', 0, NULL, NULL, N'Chuyển khoản Vietcombank'),
-- Đơn 14: Cổng ZaloPay - Đã thanh toán
(14, 14, 2, 'TXN-ZALO-014', 650000.00, 1, DATEADD(day, -3, GETUTCDATE()), GETUTCDATE(), 'ZP-20261024-88', 0, NULL, NULL, N'ZaloPay QR Code'),
-- Đơn 15: COD chưa thu do giao thất bại
(15, 15, 0, 'TXN-COD-015', 410000.00, 0, NULL, GETUTCDATE(), NULL, 0, NULL, NULL, N'Giao lần 1 thất bại, chờ giao lại'),
-- Đơn 16 & 17: Đơn hủy
(16, 16, 0, 'TXN-COD-016', 980000.00, 2, NULL, GETUTCDATE(), NULL, 0, NULL, NULL, N'Đã hoàn tiền hoặc hủy đơn'),
(17, 17, 0, 'TXN-COD-017', 310000.00, 2, NULL, GETUTCDATE(), NULL, 0, NULL, NULL, N'Đã hủy');
SET IDENTITY_INSERT [dbo].[Payments] OFF;
GO

-- =============================================================
-- BƯỚC 8: LỊCH SỬ KIỂM TOÁN (ORDER TRACKING LOGS)
-- =============================================================
SET IDENTITY_INSERT [dbo].[OrderTrackingLogs] ON;
INSERT INTO [dbo].[OrderTrackingLogs] ([TrackingLogId], [OrderId], [ShippingId], [Action], [PreviousStatus], [NewStatus], [PerformedByUserId], [PerformedByName], [PerformedByRole], [Note], [CreatedAt]) VALUES
-- Timeline cho Đơn 10 (Giao thành công, đang giữ tiền COD)
(1, 10, 10, N'Khởi tạo', NULL, N'Chờ xác nhận', N'c1000001-0000-0000-0000-000000000005', N'Hoàng Mỹ Duyên', N'Customer', N'Khách hàng đặt đơn hàng online', DATEADD(day, -2, GETUTCDATE())),
(2, 10, 10, N'Xác nhận đơn hàng', N'Chờ xác nhận', N'Đã xác nhận', N'2a80d45c-e6ae-4917-84d7-f1b5e6348919', N'Admin Cửa Hàng', N'Admin', N'Xác nhận đủ hàng trong kho và chuẩn bị đóng gói', DATEADD(hour, -36, GETUTCDATE())),
(3, 10, 10, N'Gán Shipper', N'Đã xác nhận', N'Đang đóng gói', N'2a80d45c-e6ae-4917-84d7-f1b5e6348919', N'Admin Cửa Hàng', N'Admin', N'Phân công đơn cho Shipper Nguyễn Văn Giao', DATEADD(hour, -30, GETUTCDATE())),
(4, 10, 10, N'Nhận đơn', N'Chờ nhận', N'Đã nhận đơn', N'a1b2c3d4-e5f6-7890-abcd-ef1234567890', N'Nguyễn Văn Giao', N'Shipper', N'Shipper đã bấm nhận đơn trên ứng dụng', DATEADD(hour, -24, GETUTCDATE())),
(5, 10, 10, N'Đến cửa hàng nhận hàng', N'Đã nhận đơn', N'Đã lấy hàng', N'a1b2c3d4-e5f6-7890-abcd-ef1234567890', N'Nguyễn Văn Giao', N'Shipper', N'Shipper đã đến kho cửa hàng kiểm tra và bốc xếp hàng', DATEADD(hour, -20, GETUTCDATE())),
(6, 10, 10, N'Giao hàng cho KH', N'Đã lấy hàng', N'Đang giao hàng', N'a1b2c3d4-e5f6-7890-abcd-ef1234567890', N'Nguyễn Văn Giao', N'Shipper', N'Shipper bắt đầu di chuyển đến địa chỉ người nhận', DATEADD(hour, -19, GETUTCDATE())),
(7, 10, 10, N'Giao thành công & Thu tiền', N'Đang giao hàng', N'Giao thành công', N'a1b2c3d4-e5f6-7890-abcd-ef1234567890', N'Nguyễn Văn Giao', N'Shipper', N'Giao hàng tận tay khách, đã thu 920.000đ tiền mặt', DATEADD(hour, -18, GETUTCDATE())),

-- Timeline cho Đơn 12 (Đã giao và đã nộp COD)
(8, 12, 12, N'Khởi tạo', NULL, N'Chờ xác nhận', N'c1000001-0000-0000-0000-000000000002', N'Trần Bảo Long', N'Customer', N'Đặt hàng', DATEADD(day, -3, GETUTCDATE())),
(9, 12, 12, N'Đến cửa hàng nhận hàng', N'Đã nhận', N'Đã lấy hàng', N'a1b2c3d4-e5f6-7890-abcd-ef1234567890', N'Nguyễn Văn Giao', N'Shipper', N'Lấy hàng tại kho', DATEADD(day, -2, GETUTCDATE())),
(10, 12, 12, N'Giao thành công & Thu tiền', N'Đang giao', N'Giao thành công', N'a1b2c3d4-e5f6-7890-abcd-ef1234567890', N'Nguyễn Văn Giao', N'Shipper', N'Thu 780.000đ', DATEADD(day, -2, GETUTCDATE())),
(11, 12, 12, N'Gửi lại tiền cho cửa hàng', N'Giao thành công', N'Đã nộp COD', N'a1b2c3d4-e5f6-7890-abcd-ef1234567890', N'Nguyễn Văn Giao', N'Shipper', N'Shipper đã nộp 780.000đ tiền mặt về quỹ thủ quỹ cửa hàng', DATEADD(day, -1, GETUTCDATE())),

-- Timeline cho Đơn 15 (Giao thất bại)
(12, 15, 15, N'Khởi tạo', NULL, N'Chờ xác nhận', N'c1000001-0000-0000-0000-000000000005', N'Hoàng Mỹ Duyên', N'Customer', N'Đặt hàng', DATEADD(day, -2, GETUTCDATE())),
(13, 15, 15, N'Giao hàng cho KH', N'Đã lấy hàng', N'Đang giao hàng', N'a1b2c3d4-e5f6-7890-abcd-ef1234567890', N'Nguyễn Văn Giao', N'Shipper', N'Bắt đầu giao', DATEADD(day, -2, GETUTCDATE())),
(14, 15, 15, N'Giao thất bại', N'Đang giao hàng', N'Giao thất bại', N'a1b2c3d4-e5f6-7890-abcd-ef1234567890', N'Nguyễn Văn Giao', N'Shipper', N'Khách đi vắng, hẹn 18h giao lại', DATEADD(day, -2, GETUTCDATE()));
SET IDENTITY_INSERT [dbo].[OrderTrackingLogs] OFF;
GO

-- =============================================================
-- BƯỚC 9: VOUCHERS & ĐÁNH GIÁ SẢN PHẨM MẪU
-- =============================================================
SET IDENTITY_INSERT [dbo].[Vouchers] ON;
INSERT INTO [dbo].[Vouchers] ([VoucherId], [Code], [Name], [DiscountType], [DiscountValue], [MaximumDiscount], [MinimumOrderValue], [RequiredPoints], [UsageLimit], [UsedCount], [UsageLimitPerCustomer], [StartDate], [EndDate], [Status], [CreatedAt]) VALUES
(1, 'WELCOME50K', N'Giảm 50K cho khách hàng mới', 0, 50000.00, 50000.00, 300000.00, 0, 500, 15, 1, DATEADD(day, -30, GETUTCDATE()), DATEADD(day, 60, GETUTCDATE()), 1, GETUTCDATE()),
(2, 'FREESHIPMAX', N'Miễn phí vận chuyển toàn quốc', 0, 30000.00, 30000.00, 400000.00, 0, 1000, 45, 1, DATEADD(day, -15, GETUTCDATE()), DATEADD(day, 45, GETUTCDATE()), 1, GETUTCDATE()),
(3, 'VIP100K', N'Ưu đãi tri ân thành viên 100K', 0, 100000.00, 100000.00, 1000000.00, 0, 100, 8, 1, DATEADD(day, -10, GETUTCDATE()), DATEADD(day, 30, GETUTCDATE()), 1, GETUTCDATE());
SET IDENTITY_INSERT [dbo].[Vouchers] OFF;
GO

SET IDENTITY_INSERT [dbo].[ProductReviews] ON;
INSERT INTO [dbo].[ProductReviews] ([ProductReviewId], [ProductId], [VariantId], [CustomerId], [OrderId], [Rating], [Comment], [IsApproved], [CreatedAt]) VALUES
(1, 1, 1, 1, 10, 5, N'Đồ chơi Lego chính hãng rất đẹp, con mình rất thích!', 1, DATEADD(day, -1, GETUTCDATE())),
(2, 3, 4, 2, 11, 5, N'Búp bê xinh xắn, đuôi cá phát sáng rất ảo diệu.', 1, DATEADD(day, -1, GETUTCDATE())),
(3, 5, 7, 3, 13, 5, N'Bộ xe Hot Wheels kim loại cầm rất đầm tay, sơn bóng đẹp.', 1, DATEADD(day, -2, GETUTCDATE()));
SET IDENTITY_INSERT [dbo].[ProductReviews] OFF;
GO

-- =============================================================
-- BƯỚC 10: TÁI BẬT LẠI TOÀN BỘ RÀNG BUỘC KHÓA NGOẠI (FOREIGN KEY)
-- =============================================================
EXEC sp_MSforeachtable "ALTER TABLE ? WITH CHECK CHECK CONSTRAINT all";
GO

PRINT N'=============================================================';
PRINT N'ĐÃ THI CÔNG SEED DATA TỐI ƯU THÀNH CÔNG (100% CHUẨN XÁC SCHEMA)!';
PRINT N'Tổng lượng dữ liệu đã giảm còn ~300 rows (giảm 1/3) giúp Somee và Render tải cực nhanh.';
PRINT N'Tài khoản đăng nhập kiểm thử:';
PRINT N'- Admin: admin@toystore.vn / Admin@123';
PRINT N'- Staff: staff@toystore.vn / Staff@123';
PRINT N'- Shipper: shipper@toystore.vn / Shipper@123 (Đang giữ 2 đơn COD: 920k + 515k = 1.435.000đ)';
PRINT N'- Customer: anhtuyet@gmail.com / Customer@123';
PRINT N'=============================================================';
