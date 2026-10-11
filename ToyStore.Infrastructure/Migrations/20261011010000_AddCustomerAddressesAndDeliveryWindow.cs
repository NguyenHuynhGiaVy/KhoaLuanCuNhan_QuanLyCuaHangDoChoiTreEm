using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ToyStoreManagement.Infrastructure.Data;

#nullable disable

namespace ToyStore.Infrastructure.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261011010000_AddCustomerAddressesAndDeliveryWindow")]
    public partial class AddCustomerAddressesAndDeliveryWindow : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CustomerAddresses",
                columns: table => new
                {
                    CustomerAddressId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CustomerId = table.Column<int>(type: "int", nullable: false),
                    ReceiverName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    ReceiverPhone = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    AddressDetail = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    ProvinceCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ProvinceName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    WardCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    WardName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    IsDefault = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CustomerAddresses", x => x.CustomerAddressId);
                    table.ForeignKey("FK_CustomerAddresses_Customers_CustomerId", x => x.CustomerId, "Customers", "CustomerId", onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(name: "IX_CustomerAddresses_CustomerId_IsDefault", table: "CustomerAddresses", columns: new[] { "CustomerId", "IsDefault" });
            migrationBuilder.AddColumn<DateTime>(name: "EstimatedDeliveryFromDate", table: "Shippings", type: "datetime2", nullable: true);
            migrationBuilder.AddColumn<DateTime>(name: "EstimatedDeliveryToDate", table: "Shippings", type: "datetime2", nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "EstimatedDeliveryFromDate", table: "Shippings");
            migrationBuilder.DropColumn(name: "EstimatedDeliveryToDate", table: "Shippings");
            migrationBuilder.DropTable(name: "CustomerAddresses");
        }
    }
}
