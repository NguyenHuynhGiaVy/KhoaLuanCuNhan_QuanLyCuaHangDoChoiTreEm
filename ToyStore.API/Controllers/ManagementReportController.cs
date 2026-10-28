using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ToyStoreManagement.Infrastructure.Data;

namespace ToyStoreManagement.API.Controllers
{
    [Route("api/ManagementReport")]
    [ApiController]
    [Authorize(Policy = "StaffAccess")]
    public class ManagementReportController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public ManagementReportController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet("import-statistics")]
        public async Task<IActionResult> GetImportStatistics([FromQuery] DateTime? date = null)
        {
            var day = (date ?? DateTime.UtcNow).Date;
            var nextDay = day.AddDays(1);
            var receipts = await _context.ImportReceipts
                .AsNoTracking()
                .Where(x => x.ImportDate >= day && x.ImportDate < nextDay && x.Status != 4)
                .Select(x => new
                {
                    x.ImportReceiptId,
                    x.ReceiptCode,
                    x.ImportDate,
                    x.TotalAmount,
                    SupplierName = x.Supplier != null ? x.Supplier.Name : "Không xác định",
                    ItemQuantity = x.ImportReceiptDetails
                        .Select(detail => (int?)detail.Quantity)
                        .Sum() ?? 0
                })
                .ToListAsync();

            return Ok(new
            {
                date = day,
                receiptCount = receipts.Count,
                totalItemQuantity = receipts.Sum(x => x.ItemQuantity),
                totalAmount = receipts.Sum(x => x.TotalAmount),
                receipts
            });
        }

        [HttpGet("inventory")]
        public async Task<IActionResult> GetInventorySnapshot([FromQuery] DateTime? asOf = null)
        {
            var snapshotDate = (asOf ?? DateTime.UtcNow).Date.AddDays(1);
            var variants = await _context.ProductVariants
                .AsNoTracking()
                .Select(x => new
                {
                    x.VariantId,
                    x.SKU,
                    ProductName = x.Product.Name,
                    x.CostPrice
                })
                .ToListAsync();

            var inventories = await _context.Inventories
                .AsNoTracking()
                .ToDictionaryAsync(x => x.VariantId);
            var transactionsUntilSnapshot = await _context.InventoryTransactions
                .AsNoTracking()
                .Where(x => x.CreatedAt < snapshotDate)
                .GroupBy(x => x.VariantId)
                .Select(x => new
                {
                    VariantId = x.Key,
                    Quantity = x.Sum(item => item.Quantity),
                    TransactionCount = x.Count()
                })
                .ToDictionaryAsync(x => x.VariantId);
            var futureChanges = await _context.InventoryTransactions
                .AsNoTracking()
                .Where(x => x.CreatedAt >= snapshotDate)
                .GroupBy(x => x.VariantId)
                .Select(x => new { VariantId = x.Key, Quantity = x.Sum(item => item.Quantity) })
                .ToDictionaryAsync(x => x.VariantId, x => x.Quantity);

            var items = variants.Select(item =>
            {
                var inventoryExists = inventories.TryGetValue(item.VariantId, out var inventory);
                var historicalTransactions = transactionsUntilSnapshot.GetValueOrDefault(item.VariantId);
                var quantity = inventoryExists
                    ? inventory!.Quantity - futureChanges.GetValueOrDefault(item.VariantId)
                    : historicalTransactions?.Quantity ?? 0;
                var reservedQuantity = inventory?.ReservedQuantity ?? 0;
                var availableQuantity = Math.Max(0, quantity - reservedQuantity);
                return new
                {
                    item.VariantId,
                    item.SKU,
                    item.ProductName,
                    quantity,
                    availableQuantity,
                    reservedQuantity,
                    item.CostPrice,
                    inventoryValue = quantity * item.CostPrice,
                    needsImport = availableQuantity <= 10,
                    inventoryExists,
                    hasReportHistory = historicalTransactions?.TransactionCount > 0
                        || (inventoryExists && inventory!.UpdatedAt < snapshotDate)
                };
            })
            .Where(item => item.hasReportHistory
                && (item.quantity != 0 || item.reservedQuantity != 0 || item.availableQuantity != 0))
            .ToList();

            return Ok(new
            {
                asOf = snapshotDate.AddDays(-1),
                totalQuantity = items.Sum(x => x.quantity),
                totalValue = items.Sum(x => x.inventoryValue),
                needsImportCount = items.Count(x => x.needsImport),
                items
            });
        }

        [HttpPost("inventory/reconcile-approved-imports")]
        [Authorize(Policy = "AdminOrManager")]
        public async Task<IActionResult> ReconcileApprovedImports()
        {
            await using var transaction = await _context.Database.BeginTransactionAsync();
            var receipts = await _context.ImportReceipts
                .Include(x => x.ImportReceiptDetails)
                .Where(x => x.Status == 3)
                .ToListAsync();
            var repaired = new List<object>();

            foreach (var receipt in receipts)
            {
                foreach (var detail in receipt.ImportReceiptDetails)
                {
                    var received = await _context.InventoryTransactions
                        .Where(x => x.ReferenceType == "ImportReceipt"
                            && x.ReferenceId == receipt.ImportReceiptId
                            && x.VariantId == detail.VariantId)
                        .SumAsync(x => (int?)x.Quantity) ?? 0;
                    var missing = detail.Quantity - received;
                    if (missing <= 0)
                        continue;

                    var inventory = await _context.Inventories
                        .FirstOrDefaultAsync(x => x.VariantId == detail.VariantId);
                    if (inventory == null)
                    {
                        inventory = new ToyStoreManagement.Domain.Entities.Inventory
                        {
                            VariantId = detail.VariantId,
                            Quantity = 0,
                            ReservedQuantity = 0,
                            UpdatedAt = DateTime.UtcNow
                        };
                        _context.Inventories.Add(inventory);
                    }

                    inventory.Quantity += missing;
                    inventory.UpdatedAt = DateTime.UtcNow;
                    _context.InventoryTransactions.Add(new ToyStoreManagement.Domain.Entities.InventoryTransaction
                    {
                        VariantId = detail.VariantId,
                        TransactionType = 1,
                        Quantity = missing,
                        ReferenceType = "ImportReceipt",
                        ReferenceId = receipt.ImportReceiptId,
                        Note = $"Bổ sung tồn kho từ phiếu đã duyệt {receipt.ReceiptCode}.",
                        CreatedAt = receipt.ImportDate
                    });
                    repaired.Add(new
                    {
                        receipt.ImportReceiptId,
                        receipt.ReceiptCode,
                        detail.VariantId,
                        quantity = missing
                    });
                }
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
            return Ok(new { repairedCount = repaired.Count, repaired });
        }

        [HttpGet("voucher-alerts")]
        public async Task<IActionResult> GetVoucherAlerts([FromQuery] int lowUsageThreshold = 5)
        {
            lowUsageThreshold = Math.Clamp(lowUsageThreshold, 0, 1000000);
            var now = DateTime.UtcNow;
            var vouchers = await _context.Vouchers
                .AsNoTracking()
                .Where(x => x.EndDate < now
                    || (x.UsageLimit > 0 && x.UsageLimit - x.UsedCount <= lowUsageThreshold))
                .Select(x => new
                {
                    x.VoucherId,
                    x.Code,
                    x.Name,
                    x.StartDate,
                    x.EndDate,
                    x.Status,
                    x.UsageLimit,
                    x.UsedCount,
                    remainingUses = x.UsageLimit > 0 ? Math.Max(0, x.UsageLimit - x.UsedCount) : (int?)null,
                    alertType = x.EndDate < now ? "expired" : "low-usage"
                })
                .OrderBy(x => x.EndDate)
                .ToListAsync();

            return Ok(new
            {
                checkedAt = now,
                lowUsageThreshold,
                expiredCount = vouchers.Count(x => x.alertType == "expired"),
                lowUsageCount = vouchers.Count(x => x.alertType == "low-usage"),
                vouchers
            });
        }

        [HttpGet("orders")]
        public async Task<IActionResult> GetOrderOverview(
            [FromQuery] DateTime? from = null,
            [FromQuery] DateTime? to = null)
        {
            var start = (from ?? DateTime.MinValue).Date;
            var end = (to ?? DateTime.UtcNow).Date.AddDays(1);
            var orders = await _context.Orders
                .AsNoTracking()
                .Include(x => x.Shipping)
                .Include(x => x.Payment)
                .Where(x => x.OrderDate >= start && x.OrderDate < end)
                .Select(x => new
                {
                    x.OrderId,
                    x.OrderCode,
                    x.OrderDate,
                    x.Status,
                    x.TotalAmount,
                    ShippingStatus = x.Shipping != null ? (int?)x.Shipping.Status : null,
                    EstimatedDeliveryFromDate = x.Shipping != null ? x.Shipping.EstimatedDeliveryFromDate : null,
                    EstimatedDeliveryToDate = x.Shipping != null ? x.Shipping.EstimatedDeliveryToDate : null,
                    ShippedAt = x.Shipping != null ? x.Shipping.ShippedAt : null,
                    DeliveryStartedAt = x.Shipping != null ? x.Shipping.DeliveryStartedAt : null,
                    DeliveredAt = x.Shipping != null ? x.Shipping.DeliveredAt : null,
                    PaymentStatus = x.Payment != null ? (int?)x.Payment.Status : null,
                    PaymentMethod = x.Payment != null ? (int?)x.Payment.PaymentMethod : null,
                    CodStatus = x.Payment != null ? (int?)x.Payment.CodStatus : null
                })
                .ToListAsync();

            var deliveredOrders = orders
                .Where(x => x.ShippingStatus == 4 || (!x.ShippingStatus.HasValue && x.Status == 4))
                .ToList();
            var notDeliveredOrders = orders
                .Where(x => x.Status != 5 && x.ShippingStatus != 4 && !(x.Status == 4 && !x.ShippingStatus.HasValue))
                .ToList();
            var overdue = orders
                .Where(x => x.Status != 5 && x.ShippingStatus != 4
                    && x.EstimatedDeliveryToDate.HasValue
                    && x.EstimatedDeliveryToDate.Value.Date < DateTime.UtcNow.AddHours(7).Date)
                .ToList();

            return Ok(new
            {
                from = start,
                to = end.AddDays(-1),
                totalOrders = orders.Count,
                deliveredCount = deliveredOrders.Count,
                notDeliveredCount = notDeliveredOrders.Count,
                statusCounts = orders.GroupBy(x => x.Status)
                    .ToDictionary(x => x.Key.ToString(), x => x.Count()),
                overdueCount = overdue.Count,
                overdueOrders = overdue,
                orders
            });
        }

        [HttpGet("collections")]
        public async Task<IActionResult> GetCollections(
            [FromQuery] DateTime? from = null,
            [FromQuery] DateTime? to = null)
        {
            var start = (from ?? DateTime.UtcNow.Date.AddDays(-30)).Date;
            var end = (to ?? DateTime.UtcNow).Date.AddDays(1);
            if (end <= start)
                return BadRequest(new { message = "Ngày kết thúc phải bằng hoặc sau ngày bắt đầu." });

            var payments = await _context.Payments
                .AsNoTracking()
                .Where(p => p.Status == 1
                    && ((p.PaymentMethod != 0 && p.PaidAt.HasValue)
                        || (p.PaymentMethod == 0 && p.CodStatus == 3 && p.CodConfirmedAt.HasValue))
                    && (p.PaymentMethod == 0
                        ? p.CodConfirmedAt >= start && p.CodConfirmedAt < end
                        : p.PaidAt >= start && p.PaidAt < end))
                .Select(p => new
                {
                    p.PaymentId,
                    p.OrderId,
                    p.PaymentMethod,
                    p.Amount,
                    p.Status,
                    p.PaidAt,
                    p.CodStatus,
                    p.CodConfirmedAt,
                    OrderCode = p.Order.OrderCode,
                    OrderDate = p.Order.OrderDate,
                    OrderStatus = p.Order.Status,
                    OrderTotal = p.Order.TotalAmount,
                    CustomerName = p.Order.Customer != null
                        ? p.Order.Customer.FullName
                        : (p.Order.Shipping != null ? p.Order.Shipping.ReceiverName : null),
                    ReceiverPhone = p.Order.Shipping != null ? p.Order.Shipping.ReceiverPhone : null,
                    ShippingFee = p.Order.Shipping != null ? p.Order.Shipping.ShippingFee : p.Order.ShippingFee,
                    ShippingStatus = p.Order.Shipping != null ? (int?)p.Order.Shipping.Status : null,
                    EstimatedDeliveryFromDate = p.Order.Shipping != null ? p.Order.Shipping.EstimatedDeliveryFromDate : null,
                    EstimatedDeliveryToDate = p.Order.Shipping != null ? p.Order.Shipping.EstimatedDeliveryToDate : null,
                    PickedUpAt = p.Order.Shipping != null ? p.Order.Shipping.ShippedAt : null,
                    DeliveryStartedAt = p.Order.Shipping != null ? p.Order.Shipping.DeliveryStartedAt : null,
                    DeliveredAt = p.Order.Shipping != null ? p.Order.Shipping.DeliveredAt : null,
                    ShipperName = p.Order.Shipping != null && p.Order.Shipping.Shipper != null
                        ? p.Order.Shipping.Shipper.FullName
                        : null
                })
                .OrderBy(x => x.PaymentMethod == 0 ? x.CodConfirmedAt : x.PaidAt)
                .ToListAsync();

            var records = payments.Select(p =>
            {
                var receivedAt = p.PaymentMethod == 0 ? p.CodConfirmedAt : p.PaidAt;
                var fundAmount = Math.Max(0, p.Amount - p.ShippingFee);
                var delivered = p.ShippingStatus == 4 || (!p.ShippingStatus.HasValue && p.OrderStatus == 4);

                return new
                {
                    p.PaymentId,
                    p.OrderId,
                    p.OrderCode,
                    p.OrderDate,
                    p.OrderStatus,
                    p.CustomerName,
                    p.ReceiverPhone,
                    paymentMethod = p.PaymentMethod,
                    receivedAt,
                    customerPaidAmount = p.Amount,
                    p.ShippingFee,
                    fundAmount,
                    recognizedRevenue = delivered ? Math.Max(0, p.OrderTotal - p.ShippingFee) : 0,
                    isDelivered = delivered,
                    p.ShippingStatus,
                    p.EstimatedDeliveryFromDate,
                    p.EstimatedDeliveryToDate,
                    p.PickedUpAt,
                    p.DeliveryStartedAt,
                    p.DeliveredAt,
                    p.ShipperName
                };
            }).ToList();

            return Ok(new
            {
                from = start,
                to = end.AddDays(-1),
                totalRecords = records.Count,
                onlineReceived = records.Where(x => x.paymentMethod != 0).Sum(x => x.fundAmount),
                codReceived = records.Where(x => x.paymentMethod == 0).Sum(x => x.fundAmount),
                totalFundReceived = records.Sum(x => x.fundAmount),
                totalRecognizedRevenue = records.Sum(x => x.recognizedRevenue),
                records
            });
        }

        [HttpGet("cash-flow/orders")]
        public async Task<IActionResult> GetCashFlowOrders(
            [FromQuery] DateTime? from = null,
            [FromQuery] DateTime? to = null)
        {
            return await GetCollections(from, to);
        }
    }
}
