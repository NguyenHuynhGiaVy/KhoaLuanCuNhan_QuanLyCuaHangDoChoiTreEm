using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ToyStoreManagement.Infrastructure.Data;

#nullable disable

namespace ToyStore.Infrastructure.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260923010000_FixInventoryTransactionVariantForeignKey")]
    public partial class FixInventoryTransactionVariantForeignKey : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_InventoryTransactions_ProductVariants_ProductVariantVariantId",
                table: "InventoryTransactions");

            migrationBuilder.DropIndex(
                name: "IX_InventoryTransactions_ProductVariantVariantId",
                table: "InventoryTransactions");

            migrationBuilder.DropColumn(
                name: "ProductVariantVariantId",
                table: "InventoryTransactions");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryTransactions_VariantId",
                table: "InventoryTransactions",
                column: "VariantId");

            migrationBuilder.AddForeignKey(
                name: "FK_InventoryTransactions_ProductVariants_VariantId",
                table: "InventoryTransactions",
                column: "VariantId",
                principalTable: "ProductVariants",
                principalColumn: "VariantId",
                onDelete: ReferentialAction.Cascade);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_InventoryTransactions_ProductVariants_VariantId",
                table: "InventoryTransactions");

            migrationBuilder.DropIndex(
                name: "IX_InventoryTransactions_VariantId",
                table: "InventoryTransactions");

            migrationBuilder.AddColumn<int>(
                name: "ProductVariantVariantId",
                table: "InventoryTransactions",
                type: "int",
                nullable: true);

            migrationBuilder.Sql(
                "UPDATE [InventoryTransactions] SET [ProductVariantVariantId] = [VariantId] WHERE [ProductVariantVariantId] IS NULL");

            migrationBuilder.AlterColumn<int>(
                name: "ProductVariantVariantId",
                table: "InventoryTransactions",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_InventoryTransactions_ProductVariantVariantId",
                table: "InventoryTransactions",
                column: "ProductVariantVariantId");

            migrationBuilder.AddForeignKey(
                name: "FK_InventoryTransactions_ProductVariants_ProductVariantVariantId",
                table: "InventoryTransactions",
                column: "ProductVariantVariantId",
                principalTable: "ProductVariants",
                principalColumn: "VariantId",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
