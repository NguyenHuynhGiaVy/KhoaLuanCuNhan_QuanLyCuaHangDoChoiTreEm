using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ToyStore.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddImportReceiptOrderedByUser : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "OrderedByUserId",
                table: "ImportReceipts",
                type: "nvarchar(450)",
                maxLength: 450,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ImportReceipts_OrderedByUserId",
                table: "ImportReceipts",
                column: "OrderedByUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_ImportReceipts_AspNetUsers_OrderedByUserId",
                table: "ImportReceipts",
                column: "OrderedByUserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ImportReceipts_AspNetUsers_OrderedByUserId",
                table: "ImportReceipts");

            migrationBuilder.DropIndex(
                name: "IX_ImportReceipts_OrderedByUserId",
                table: "ImportReceipts");

            migrationBuilder.DropColumn(
                name: "OrderedByUserId",
                table: "ImportReceipts");
        }
    }
}
