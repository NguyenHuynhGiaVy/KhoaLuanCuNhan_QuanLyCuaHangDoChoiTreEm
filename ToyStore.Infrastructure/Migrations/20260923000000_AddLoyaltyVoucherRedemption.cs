using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ToyStoreManagement.Infrastructure.Data;

#nullable disable

namespace ToyStore.Infrastructure.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260923000000_AddLoyaltyVoucherRedemption")]
    public partial class AddLoyaltyVoucherRedemption : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "RequiredPoints",
                table: "Vouchers",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "VoucherId",
                table: "LoyaltyTransactions",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_LoyaltyTransactions_CustomerId_VoucherId",
                table: "LoyaltyTransactions",
                columns: new[] { "CustomerId", "VoucherId" },
                unique: true,
                filter: "[VoucherId] IS NOT NULL AND [TransactionType] = 2");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_LoyaltyTransactions_CustomerId_VoucherId",
                table: "LoyaltyTransactions");

            migrationBuilder.DropColumn(
                name: "VoucherId",
                table: "LoyaltyTransactions");

            migrationBuilder.DropColumn(
                name: "RequiredPoints",
                table: "Vouchers");
        }
    }
}
