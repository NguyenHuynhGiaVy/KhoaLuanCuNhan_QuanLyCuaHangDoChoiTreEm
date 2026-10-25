using System;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;

namespace ToyStoreManagement.Infrastructure.Data
{
    public static class DatabasePatchHelper
    {
        public static async Task ApplyPatchesAsync(ApplicationDbContext context)
        {
            try
            {
                // 1. Mở khóa tài khoản Admin trong AspNetUsers
                await context.Database.ExecuteSqlRawAsync(@"
                    IF EXISTS (SELECT 1 FROM [dbo].[AspNetUsers] WHERE [Email] = 'admin@toystore.vn' AND [IsActive] = 0)
                    BEGIN
                        UPDATE [dbo].[AspNetUsers] SET [IsActive] = 1 WHERE [Email] = 'admin@toystore.vn';
                    END
                ");

                // 2. Bổ sung các cột cho bảng Shippings
                await context.Database.ExecuteSqlRawAsync(@"
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Shippings]') AND name = 'DeliveryBatchCode')
                    BEGIN
                        ALTER TABLE [dbo].[Shippings] ADD [DeliveryBatchCode] nvarchar(50) NULL;
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Shippings]') AND name = 'EstimatedDeliveryAt')
                    BEGIN
                        ALTER TABLE [dbo].[Shippings] ADD [EstimatedDeliveryAt] datetime2 NULL;
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Shippings]') AND name = 'EstimatedDeliveryFromDate')
                    BEGIN
                        ALTER TABLE [dbo].[Shippings] ADD [EstimatedDeliveryFromDate] datetime2 NULL;
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Shippings]') AND name = 'EstimatedDeliveryToDate')
                    BEGIN
                        ALTER TABLE [dbo].[Shippings] ADD [EstimatedDeliveryToDate] datetime2 NULL;
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Shippings]') AND name = 'ShipperId')
                    BEGIN
                        ALTER TABLE [dbo].[Shippings] ADD [ShipperId] int NULL;
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Shippings]') AND name = 'FailReason')
                    BEGIN
                        ALTER TABLE [dbo].[Shippings] ADD [FailReason] nvarchar(500) NULL;
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Shippings]') AND name = 'AttemptCount')
                    BEGIN
                        ALTER TABLE [dbo].[Shippings] ADD [AttemptCount] int NOT NULL DEFAULT 0;
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Shippings]') AND name = 'FailedAt')
                    BEGIN
                        ALTER TABLE [dbo].[Shippings] ADD [FailedAt] datetime2 NULL;
                    END
                ");

                // 2.1 Bổ sung bảng Shippers
                await context.Database.ExecuteSqlRawAsync(@"
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

                        -- Seed mẫu 2 nhân viên giao hàng nếu bảng mới tạo
                        INSERT INTO [dbo].[Shippers] ([FullName], [PhoneNumber], [VehicleNumber], [AssignedArea], [IsActive], [CreatedAt])
                        VALUES 
                            (N'Nguyễn Văn Giao', '0909123456', N'59-X1 123.45', N'Quận 1, Quận 3, Quận 5', 1, GETUTCDATE()),
                            (N'Trần Văn Tốc', '0918765432', N'59-Y2 678.90', N'Bình Thạnh, Phú Nhuận, Gò Vấp', 1, GETUTCDATE());
                    END
                ");

                // 3. Bổ sung cột cho bảng Payments
                await context.Database.ExecuteSqlRawAsync(@"
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Payments]') AND name = 'GatewayTransactionCode')
                    BEGIN
                        ALTER TABLE [dbo].[Payments] ADD [GatewayTransactionCode] nvarchar(100) NULL;
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Payments]') AND name = 'CodStatus')
                    BEGIN
                        ALTER TABLE [dbo].[Payments] ADD [CodStatus] int NOT NULL DEFAULT 0;
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Payments]') AND name = 'CodCollectedAt')
                    BEGIN
                        ALTER TABLE [dbo].[Payments] ADD [CodCollectedAt] datetime2 NULL;
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Payments]') AND name = 'CodSubmittedAt')
                    BEGIN
                        ALTER TABLE [dbo].[Payments] ADD [CodSubmittedAt] datetime2 NULL;
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Payments]') AND name = 'CodNote')
                    BEGIN
                        ALTER TABLE [dbo].[Payments] ADD [CodNote] nvarchar(500) NULL;
                    END
                ");

                // 4. Bổ sung bảng CustomerAddresses nếu chưa có
                await context.Database.ExecuteSqlRawAsync(@"
                    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CustomerAddresses')
                    BEGIN
                        CREATE TABLE [dbo].[CustomerAddresses] (
                            [CustomerAddressId] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                            [CustomerId] int NOT NULL,
                            [ReceiverName] nvarchar(150) NOT NULL,
                            [ReceiverPhone] nvarchar(20) NOT NULL,
                            [AddressDetail] nvarchar(300) NOT NULL,
                            [ProvinceCode] nvarchar(20) NOT NULL,
                            [ProvinceName] nvarchar(150) NOT NULL,
                            [WardCode] nvarchar(20) NOT NULL,
                            [WardName] nvarchar(150) NOT NULL,
                            [IsDefault] bit NOT NULL,
                            [CreatedAt] datetime2 NOT NULL,
                            [UpdatedAt] datetime2 NULL,
                            CONSTRAINT [FK_CustomerAddresses_Customers_CustomerId] FOREIGN KEY ([CustomerId]) 
                                REFERENCES [dbo].[Customers]([CustomerId]) ON DELETE CASCADE
                        );
                    END
                ");

                // 5. Bổ sung bảng SupportConversations & SupportMessages
                await context.Database.ExecuteSqlRawAsync(@"
                    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'SupportConversations')
                    BEGIN
                        CREATE TABLE [dbo].[SupportConversations] (
                            [SupportConversationId] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                            [CustomerId] int NOT NULL,
                            [AssignedManagerUserId] nvarchar(450) NULL,
                            [Status] int NOT NULL,
                            [CreatedAt] datetime2 NOT NULL,
                            [UpdatedAt] datetime2 NOT NULL,
                            [LastMessageAt] datetime2 NULL,
                            CONSTRAINT [FK_SupportConversations_Customers_CustomerId] FOREIGN KEY ([CustomerId]) 
                                REFERENCES [dbo].[Customers]([CustomerId])
                        );
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'SupportMessages')
                    BEGIN
                        CREATE TABLE [dbo].[SupportMessages] (
                            [SupportMessageId] bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
                            [SupportConversationId] int NOT NULL,
                            [SenderUserId] nvarchar(450) NOT NULL,
                            [SenderRole] nvarchar(32) NOT NULL,
                            [Content] nvarchar(4000) NOT NULL,
                            [SentAt] datetime2 NOT NULL,
                            [ReadAt] datetime2 NULL,
                            CONSTRAINT [FK_SupportMessages_SupportConversations_SupportConversationId] FOREIGN KEY ([SupportConversationId]) 
                                REFERENCES [dbo].[SupportConversations]([SupportConversationId]) ON DELETE CASCADE
                        );
                    END
                ");

                // 6. Bổ sung bảng LiquidationReceipts & LiquidationReceiptDetails
                await context.Database.ExecuteSqlRawAsync(@"
                    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'LiquidationReceipts')
                    BEGIN
                        CREATE TABLE [dbo].[LiquidationReceipts] (
                            [LiquidationReceiptId] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                            [ReceiptCode] nvarchar(50) NOT NULL,
                            [CreatedByUserId] nvarchar(450) NOT NULL,
                            [Note] nvarchar(2000) NULL,
                            [Status] int NOT NULL,
                            [CreatedAt] datetime2 NOT NULL,
                            [CompletedAt] datetime2 NULL
                        );
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'LiquidationReceiptDetails')
                    BEGIN
                        CREATE TABLE [dbo].[LiquidationReceiptDetails] (
                            [LiquidationReceiptDetailId] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                            [LiquidationReceiptId] int NOT NULL,
                            [VariantId] int NOT NULL,
                            [Quantity] int NOT NULL,
                            CONSTRAINT [FK_LiquidationReceiptDetails_LiquidationReceipts_LiquidationReceiptId] FOREIGN KEY ([LiquidationReceiptId]) 
                                REFERENCES [dbo].[LiquidationReceipts]([LiquidationReceiptId]) ON DELETE CASCADE,
                            CONSTRAINT [FK_LiquidationReceiptDetails_ProductVariants_VariantId] FOREIGN KEY ([VariantId]) 
                                REFERENCES [dbo].[ProductVariants]([VariantId])
                        );
                    END
                ");

                // 7. Bổ sung bảng OrderTrackingLogs (Lưu lịch sử Audit/Workflow luồng vận chuyển)
                await context.Database.ExecuteSqlRawAsync(@"
                    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'OrderTrackingLogs')
                    BEGIN
                        CREATE TABLE [dbo].[OrderTrackingLogs] (
                            [TrackingLogId] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                            [OrderId] int NOT NULL,
                            [ShippingId] int NULL,
                            [Action] nvarchar(100) NOT NULL,
                            [PreviousStatus] nvarchar(100) NULL,
                            [NewStatus] nvarchar(100) NOT NULL,
                            [PerformedByUserId] nvarchar(450) NULL,
                            [PerformedByName] nvarchar(150) NOT NULL,
                            [PerformedByRole] nvarchar(50) NOT NULL,
                            [Note] nvarchar(500) NULL,
                            [CreatedAt] datetime2 NOT NULL DEFAULT GETUTCDATE(),
                            CONSTRAINT [FK_OrderTrackingLogs_Orders_OrderId] FOREIGN KEY ([OrderId]) 
                                REFERENCES [dbo].[Orders]([OrderId]) ON DELETE CASCADE
                        );
                    END

                    -- Tự động liên kết UserId của tài khoản shipper@toystore.vn với Shipper trong bảng Shippers
                    IF EXISTS (SELECT 1 FROM [dbo].[AspNetUsers] WHERE [Email] = 'shipper@toystore.vn')
                    BEGIN
                        DECLARE @ShipperUserId nvarchar(450) = (SELECT TOP 1 [Id] FROM [dbo].[AspNetUsers] WHERE [Email] = 'shipper@toystore.vn');
                        UPDATE [dbo].[Shippers] SET [UserId] = @ShipperUserId 
                        WHERE [UserId] IS NULL AND ([PhoneNumber] = '0909123456' OR [FullName] LIKE N'%Nguyễn Văn Giao%');
                    END
                ");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Database Patch Warning] {ex.Message}");
            }
        }
    }
}
