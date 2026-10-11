using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ToyStore.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddVoucherRedemptionTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Một số cơ sở dữ liệu phát triển đã có sẵn các cột này từ lần cập nhật
            // thủ công trước khi migration được ghi nhận. Kiểm tra trước để nâng cấp an toàn.
            migrationBuilder.Sql(@"
IF COL_LENGTH(N'[dbo].[Vouchers]', N'RequiredPoints') IS NULL
BEGIN
    ALTER TABLE [Vouchers] ADD [RequiredPoints] int NOT NULL CONSTRAINT [DF_Vouchers_RequiredPoints] DEFAULT 0;
END;");

            migrationBuilder.Sql(@"
IF COL_LENGTH(N'[dbo].[LoyaltyTransactions]', N'VoucherId') IS NULL
BEGIN
    ALTER TABLE [LoyaltyTransactions] ADD [VoucherId] int NULL;
END;");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE [name] = N'IX_LoyaltyTransactions_CustomerId_VoucherId'
      AND [object_id] = OBJECT_ID(N'[dbo].[LoyaltyTransactions]')
)
BEGIN
    CREATE UNIQUE INDEX [IX_LoyaltyTransactions_CustomerId_VoucherId]
        ON [LoyaltyTransactions] ([CustomerId], [VoucherId])
        WHERE [VoucherId] IS NOT NULL AND [TransactionType] = 2;
END;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_LoyaltyTransactions_CustomerId_VoucherId",
                table: "LoyaltyTransactions");

            migrationBuilder.DropColumn(
                name: "RequiredPoints",
                table: "Vouchers");

            migrationBuilder.DropColumn(
                name: "VoucherId",
                table: "LoyaltyTransactions");

        }
    }
}
