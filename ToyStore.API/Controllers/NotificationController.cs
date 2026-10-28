using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ToyStoreManagement.Infrastructure.Data;

namespace ToyStoreManagement.API.Controllers
{
    [Route("api/Notification")]
    [ApiController]
    public class NotificationController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public NotificationController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet("customer-vouchers")]
        [AllowAnonymous]
        public async Task<IActionResult> GetCustomerVoucherNotifications()
        {
            var now = DateTime.UtcNow;
            var vouchers = await _context.Vouchers
                .AsNoTracking()
                .Where(x => x.Status == 1
                    && x.StartDate <= now
                    && x.EndDate >= now
                    && (x.UsageLimit <= 0 || x.UsedCount < x.UsageLimit))
                .OrderBy(x => x.EndDate)
                .Take(10)
                .Select(x => new
                {
                    x.Code,
                    x.Name,
                    x.DiscountType,
                    x.DiscountValue,
                    x.MinimumOrderValue,
                    x.EndDate,
                    remainingUses = x.UsageLimit > 0
                        ? x.UsageLimit - x.UsedCount
                        : (int?)null
                })
                .ToListAsync();

            return Ok(new
            {
                checkedAt = now,
                message = vouchers.Count == 0
                    ? "Hiện chưa có voucher khả dụng."
                    : $"Đang có {vouchers.Count} voucher ưu đãi dành cho bạn.",
                vouchers
            });
        }

        [HttpGet("staff")]
        [Authorize(Policy = "StaffAccess")]
        public async Task<IActionResult> GetStaffNotifications()
        {
            var since = DateTime.UtcNow.AddDays(-7);
            var notifications = new List<object>();

            notifications.AddRange(await _context.Products
                .AsNoTracking()
                .Where(x => x.CreatedAt >= since)
                .OrderByDescending(x => x.CreatedAt)
                .Take(10)
                .Select(x => (object)new
                {
                    type = "product-created",
                    title = "Sản phẩm mới",
                    message = $"Đã thêm sản phẩm {x.Name}.",
                    createdAt = x.CreatedAt,
                    referenceId = x.ProductId
                })
                .ToListAsync());

            notifications.AddRange(await _context.Categories
                .AsNoTracking()
                .Where(x => x.CreatedAt >= since)
                .OrderByDescending(x => x.CreatedAt)
                .Take(10)
                .Select(x => (object)new
                {
                    type = "category-created",
                    title = "Danh mục mới",
                    message = $"Đã thêm danh mục {x.Name}.",
                    createdAt = x.CreatedAt,
                    referenceId = x.CategoryId
                })
                .ToListAsync());

            notifications.AddRange(await _context.ImportReceipts
                .AsNoTracking()
                .Where(x => x.CreatedAt >= since)
                .OrderByDescending(x => x.CreatedAt)
                .Take(10)
                .Select(x => (object)new
                {
                    type = "import-receipt",
                    title = x.Status == 3 ? "Hàng đã về kho" : "Phiếu nhập mới",
                    message = $"{x.ReceiptCode} · {x.TotalAmount:N0} đ.",
                    createdAt = x.CreatedAt,
                    referenceId = x.ImportReceiptId
                })
                .ToListAsync());

            notifications.AddRange(await _context.InventoryTransactions
                .AsNoTracking()
                .Where(x => x.CreatedAt >= since)
                .OrderByDescending(x => x.CreatedAt)
                .Take(15)
                .Select(x => (object)new
                {
                    type = "inventory-changed",
                    title = "Tồn kho biến động",
                    message = $"SKU #{x.VariantId}: {(x.Quantity > 0 ? "+" : "")}{x.Quantity} sản phẩm.",
                    createdAt = x.CreatedAt,
                    referenceId = x.VariantId
                })
                .ToListAsync());

            notifications.AddRange(await _context.Orders
                .AsNoTracking()
                .Where(x => x.UpdatedAt >= since || x.CreatedAt >= since)
                .OrderByDescending(x => x.UpdatedAt ?? x.CreatedAt)
                .Take(15)
                .Select(x => (object)new
                {
                    type = "order-changed",
                    title = "Đơn hàng thay đổi",
                    message = $"{x.OrderCode} · {x.TotalAmount:N0} đ · trạng thái {x.Status}.",
                    createdAt = x.UpdatedAt ?? x.CreatedAt,
                    referenceId = x.OrderId
                })
                .ToListAsync());

            notifications.AddRange(await _context.Payments
                .AsNoTracking()
                .Where(x => x.CodSubmittedAt >= since || x.CodConfirmedAt >= since)
                .OrderByDescending(x => x.CodConfirmedAt ?? x.CodSubmittedAt)
                .Take(15)
                .Select(x => (object)new
                {
                    type = "cod-submission",
                    title = x.CodStatus == 3 ? "Shipper đã nộp tiền COD" : "Shipper báo nộp COD",
                    message = $"Đơn #{x.OrderId} · {x.Amount:N0} đ.",
                    createdAt = x.CodConfirmedAt ?? x.CodSubmittedAt,
                    referenceId = x.OrderId
                })
                .ToListAsync());

            return Ok(new
            {
                checkedAt = DateTime.UtcNow,
                notifications = notifications
                    .OrderByDescending(x => x.GetType().GetProperty("createdAt")?.GetValue(x))
                    .Take(50)
            });
        }
    }
}
