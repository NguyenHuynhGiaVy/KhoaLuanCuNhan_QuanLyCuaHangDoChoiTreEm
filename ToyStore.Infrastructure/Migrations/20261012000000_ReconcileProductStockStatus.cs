using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ToyStoreManagement.Infrastructure.Data;

#nullable disable

namespace ToyStore.Infrastructure.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261012000000_ReconcileProductStockStatus")]
    public partial class ReconcileProductStockStatus : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Đồng bộ các sản phẩm đã được nhập kho trước khi cơ chế tự chuyển trạng
            // thái được bổ sung. Không đụng đến trạng thái thanh lý/ngừng nhập (2).
            migrationBuilder.Sql(@"
UPDATE [p]
SET [p].[Status] = 1,
    [p].[UpdatedAt] = SYSUTCDATETIME()
FROM [Products] AS [p]
WHERE [p].[Status] IN (0, 3)
  AND EXISTS (
      SELECT 1
      FROM [ProductVariants] AS [pv]
      INNER JOIN [Inventories] AS [i] ON [i].[VariantId] = [pv].[VariantId]
      WHERE [pv].[ProductId] = [p].[ProductId]
        AND [i].[Quantity] > 0
  );");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Không thể khôi phục chính xác trạng thái cũ sau khi đã đồng bộ dữ liệu.
        }
    }
}
