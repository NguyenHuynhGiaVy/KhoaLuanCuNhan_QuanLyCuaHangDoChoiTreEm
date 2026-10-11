using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ToyStoreManagement.Infrastructure.Data;

#nullable disable

namespace ToyStore.Infrastructure.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261011000000_AddShippingDeliveryPlanning")]
    public partial class AddShippingDeliveryPlanning : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DeliveryBatchCode",
                table: "Shippings",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "EstimatedDeliveryAt",
                table: "Shippings",
                type: "datetime2",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Shippings_DeliveryBatchCode",
                table: "Shippings",
                column: "DeliveryBatchCode");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Shippings_DeliveryBatchCode",
                table: "Shippings");

            migrationBuilder.DropColumn(
                name: "DeliveryBatchCode",
                table: "Shippings");

            migrationBuilder.DropColumn(
                name: "EstimatedDeliveryAt",
                table: "Shippings");
        }
    }
}
