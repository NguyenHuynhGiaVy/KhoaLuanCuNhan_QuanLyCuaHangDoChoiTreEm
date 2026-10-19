using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ToyStoreManagement.Application.DTOs.Dashboard;
using ToyStoreManagement.Application.Interfaces.Repositories;
using ToyStoreManagement.Infrastructure.Data;

namespace ToyStoreManagement.Infrastructure.Repositories
{
    public class DashboardRepository : IDashboardRepository
    {
        private readonly ApplicationDbContext _context;

        public DashboardRepository(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<DashboardSummaryDto> GetSummaryAsync(DateTime? from = null, DateTime? to = null)
        {
            var ordersQuery = _context.Orders.AsQueryable();

            if (from.HasValue)
            {
                var startDate = from.Value.Date;
                ordersQuery = ordersQuery.Where(x => x.OrderDate >= startDate);
            }

            if (to.HasValue)
            {
                var endDate = to.Value.Date.AddDays(1);
                ordersQuery = ordersQuery.Where(x => x.OrderDate < endDate);
            }

            var orders = await ordersQuery
                .Select(x => new
                {
                    x.OrderId,
                    x.Status,
                    x.TotalAmount,
                    PaymentMethod = x.Payment != null ? x.Payment.PaymentMethod : 0,
                    PaymentStatus = x.Payment != null ? x.Payment.Status : 0,
                    PaymentAmount = x.Payment != null ? x.Payment.Amount : x.TotalAmount,
                    CodStatus = x.Payment != null ? x.Payment.CodStatus : 0,
                    ShippingStatus = x.Shipping != null ? x.Shipping.Status : 0
                })
                .ToListAsync();

            var totalOrders = orders.Count;
            var completedOrders = orders.Count(x => x.Status == 4);
            var shippingOrders = orders.Count(x => x.Status == 3 || x.ShippingStatus == 1 || x.ShippingStatus == 4);
            var processingOrders = orders.Count(x => x.Status == 1 || x.Status == 2);
            var failedOrders = orders.Count(x => x.ShippingStatus == 3 || x.ShippingStatus == 5);
            var cancelledOrders = orders.Count(x => x.Status == 5);

            var totalRevenue = orders.Where(x => x.Status == 4).Sum(x => x.TotalAmount);
            var expectedRevenue = orders.Where(x => x.Status != 5).Sum(x => x.TotalAmount);

            // Dòng tiền thực tế:
            // 1. Online đã thanh toán: PaymentMethod in (1, 2) and (PaymentStatus == 1 or Status == 4)
            var onlinePaidAmount = orders
                .Where(x => (x.PaymentMethod == 1 || x.PaymentMethod == 2) && (x.PaymentStatus == 1 || x.Status == 4))
                .Sum(x => x.PaymentAmount);

            // 2. COD đã nộp về shop: PaymentMethod == 0 and CodStatus == 2
            var codSubmittedAmount = orders
                .Where(x => x.PaymentMethod == 0 && x.CodStatus == 2)
                .Sum(x => x.PaymentAmount);

            // Tổng thực thu = Online đã thanh toán + COD đã nộp quỹ
            var paidAmount = onlinePaidAmount + codSubmittedAmount;

            // 3. Tiền COD Shipper đang giữ ngoài thực địa: CodStatus == 1
            var codHoldingAmount = orders
                .Where(x => x.PaymentMethod == 0 && x.CodStatus == 1)
                .Sum(x => x.PaymentAmount);

            // 4. Chờ thu COD (các đơn chưa hoàn tất giao):
            var pendingCollectionAmount = orders
                .Where(x => x.PaymentMethod == 0 && x.CodStatus == 0 && x.Status != 5 && x.Status != 4)
                .Sum(x => x.PaymentAmount);

            var unpaidAmount = codHoldingAmount + pendingCollectionAmount;

            // Sản phẩm đã bán trong kỳ
            var orderDetailsQuery = _context.OrderDetails
                .Where(x => x.Order.Status == 4);
            if (from.HasValue) orderDetailsQuery = orderDetailsQuery.Where(x => x.Order.OrderDate >= from.Value.Date);
            if (to.HasValue) orderDetailsQuery = orderDetailsQuery.Where(x => x.Order.OrderDate < to.Value.Date.AddDays(1));
            var totalSoldQuantity = await orderDetailsQuery.SumAsync(x => (int?)x.Quantity) ?? 0;

            // Tồn kho hiện tại
            var currentInventoryQuantity = await _context.Inventories.SumAsync(x => (int?)x.Quantity) ?? 0;
            var lowStockCount = await _context.Inventories.CountAsync(x => x.Quantity - x.ReservedQuantity <= 10);
            var totalProducts = await _context.Products.CountAsync(x => x.Status == 1);
            var totalCustomers = await _context.Customers.CountAsync();

            // Tỷ lệ vận chuyển logistics
            var deliveredCount = orders.Count(x => x.Status == 4 || x.ShippingStatus == 2);
            var failedCount = orders.Count(x => x.ShippingStatus == 3 || x.ShippingStatus == 5);
            var totalCompletedShipping = deliveredCount + failedCount;
            var successRate = totalCompletedShipping > 0
                ? Math.Round((double)deliveredCount / totalCompletedShipping * 100, 1)
                : 100.0;
            var returnRate = totalCompletedShipping > 0
                ? Math.Round((double)failedCount / totalCompletedShipping * 100, 1)
                : 0.0;

            return new DashboardSummaryDto
            {
                TotalRevenue = totalRevenue,
                ExpectedRevenue = expectedRevenue,
                PaidAmount = paidAmount,
                OnlinePaidAmount = onlinePaidAmount,
                CodSubmittedAmount = codSubmittedAmount,
                UnpaidAmount = unpaidAmount,
                CodHoldingAmount = codHoldingAmount,
                PendingCollectionAmount = pendingCollectionAmount,
                TotalOrders = totalOrders,
                CompletedOrders = completedOrders,
                ShippingOrders = shippingOrders,
                ProcessingOrders = processingOrders,
                FailedOrders = failedOrders,
                CancelledOrders = cancelledOrders,
                TotalSoldQuantity = totalSoldQuantity,
                CurrentInventoryQuantity = currentInventoryQuantity,
                LowStockCount = lowStockCount,
                TotalProducts = totalProducts,
                TotalCustomers = totalCustomers,
                DeliverySuccessRate = successRate,
                ReturnRate = returnRate
            };
        }

        public async Task<FinancialReportDto> GetFinancialReportAsync(
            DateTime? from = null,
            DateTime? to = null,
            string groupBy = "day")
        {
            var now = DateTime.UtcNow;
            var startDate = from?.Date ?? now.Date.AddDays(-29);
            var endDate = to?.Date ?? now.Date;

            if (endDate < startDate)
            {
                throw new ArgumentException("Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.");
            }

            groupBy = (groupBy ?? "day").Trim().ToLowerInvariant();
            if (groupBy is not ("day" or "month" or "year"))
            {
                groupBy = "day";
            }

            var endExclusive = endDate.AddDays(1);
            var ordersInPeriod = await _context.Orders
                .Where(x => x.OrderDate >= startDate && x.OrderDate < endExclusive)
                .Select(x => new
                {
                    x.OrderId,
                    x.OrderDate,
                    x.Status,
                    x.TotalAmount,
                    PaymentMethod = x.Payment != null ? x.Payment.PaymentMethod : 0,
                    PaymentStatus = x.Payment != null ? x.Payment.Status : 0,
                    PaymentAmount = x.Payment != null ? x.Payment.Amount : x.TotalAmount,
                    CodStatus = x.Payment != null ? x.Payment.CodStatus : 0
                })
                .ToListAsync();

            var report = new FinancialReportDto
            {
                FromDate = startDate,
                ToDate = endDate,
                GroupBy = groupBy,
                TotalGrossRevenue = ordersInPeriod.Where(x => x.Status == 4).Sum(x => x.TotalAmount),
                TotalOnlineAmount = ordersInPeriod
                    .Where(x => (x.PaymentMethod == 1 || x.PaymentMethod == 2) && (x.PaymentStatus == 1 || x.Status == 4))
                    .Sum(x => x.PaymentAmount),
                TotalCodSubmittedAmount = ordersInPeriod
                    .Where(x => x.PaymentMethod == 0 && x.CodStatus == 2)
                    .Sum(x => x.PaymentAmount),
                TotalCodHoldingAmount = ordersInPeriod
                    .Where(x => x.PaymentMethod == 0 && x.CodStatus == 1)
                    .Sum(x => x.PaymentAmount),
                TotalPendingAmount = ordersInPeriod
                    .Where(x => x.PaymentMethod == 0 && x.CodStatus == 0 && x.Status != 5 && x.Status != 4)
                    .Sum(x => x.PaymentAmount)
            };

            report.TotalPaidAmount = report.TotalOnlineAmount + report.TotalCodSubmittedAmount;

            // Grouping by period
            if (groupBy == "day")
            {
                var groupedByDay = ordersInPeriod
                    .GroupBy(x => x.OrderDate.Date)
                    .ToDictionary(g => g.Key, g => g.ToList());

                for (var date = startDate; date <= endDate; date = date.AddDays(1))
                {
                    var dayOrders = groupedByDay.GetValueOrDefault(date) ?? new();
                    var grossRev = dayOrders.Where(x => x.Status == 4).Sum(x => x.TotalAmount);
                    var online = dayOrders.Where(x => (x.PaymentMethod == 1 || x.PaymentMethod == 2) && (x.PaymentStatus == 1 || x.Status == 4)).Sum(x => x.PaymentAmount);
                    var codSub = dayOrders.Where(x => x.PaymentMethod == 0 && x.CodStatus == 2).Sum(x => x.PaymentAmount);
                    var codHold = dayOrders.Where(x => x.PaymentMethod == 0 && x.CodStatus == 1).Sum(x => x.PaymentAmount);
                    var pend = dayOrders.Where(x => x.PaymentMethod == 0 && x.CodStatus == 0 && x.Status != 5 && x.Status != 4).Sum(x => x.PaymentAmount);
                    var paid = online + codSub;
                    var collectionRate = grossRev > 0 ? Math.Round((double)paid / (double)grossRev * 100, 1) : 100.0;

                    report.Items.Add(new FinancialPeriodItemDto
                    {
                        PeriodLabel = date.ToString("dd/MM/yyyy"),
                        PeriodDate = date,
                        OrderCount = dayOrders.Count,
                        CompletedOrderCount = dayOrders.Count(x => x.Status == 4),
                        GrossRevenue = grossRev,
                        PaidAmount = paid,
                        OnlineAmount = online,
                        CodSubmittedAmount = codSub,
                        CodHoldingAmount = codHold,
                        PendingAmount = pend,
                        CollectionRate = collectionRate
                    });
                }
            }
            else if (groupBy == "month")
            {
                var groupedByMonth = ordersInPeriod
                    .GroupBy(x => new { x.OrderDate.Year, x.OrderDate.Month })
                    .ToDictionary(g => (g.Key.Year, g.Key.Month), g => g.ToList());

                var currentMonth = new DateTime(startDate.Year, startDate.Month, 1);
                var lastMonth = new DateTime(endDate.Year, endDate.Month, 1);

                while (currentMonth <= lastMonth)
                {
                    var key = (currentMonth.Year, currentMonth.Month);
                    var mOrders = groupedByMonth.GetValueOrDefault(key) ?? new();
                    var grossRev = mOrders.Where(x => x.Status == 4).Sum(x => x.TotalAmount);
                    var online = mOrders.Where(x => (x.PaymentMethod == 1 || x.PaymentMethod == 2) && (x.PaymentStatus == 1 || x.Status == 4)).Sum(x => x.PaymentAmount);
                    var codSub = mOrders.Where(x => x.PaymentMethod == 0 && x.CodStatus == 2).Sum(x => x.PaymentAmount);
                    var codHold = mOrders.Where(x => x.PaymentMethod == 0 && x.CodStatus == 1).Sum(x => x.PaymentAmount);
                    var pend = mOrders.Where(x => x.PaymentMethod == 0 && x.CodStatus == 0 && x.Status != 5 && x.Status != 4).Sum(x => x.PaymentAmount);
                    var paid = online + codSub;
                    var collectionRate = grossRev > 0 ? Math.Round((double)paid / (double)grossRev * 100, 1) : 100.0;

                    report.Items.Add(new FinancialPeriodItemDto
                    {
                        PeriodLabel = currentMonth.ToString("MM/yyyy"),
                        PeriodDate = currentMonth,
                        OrderCount = mOrders.Count,
                        CompletedOrderCount = mOrders.Count(x => x.Status == 4),
                        GrossRevenue = grossRev,
                        PaidAmount = paid,
                        OnlineAmount = online,
                        CodSubmittedAmount = codSub,
                        CodHoldingAmount = codHold,
                        PendingAmount = pend,
                        CollectionRate = collectionRate
                    });

                    currentMonth = currentMonth.AddMonths(1);
                }
            }
            else
            {
                var groupedByYear = ordersInPeriod
                    .GroupBy(x => x.OrderDate.Year)
                    .ToDictionary(g => g.Key, g => g.ToList());

                for (var y = startDate.Year; y <= endDate.Year; y++)
                {
                    var yOrders = groupedByYear.GetValueOrDefault(y) ?? new();
                    var grossRev = yOrders.Where(x => x.Status == 4).Sum(x => x.TotalAmount);
                    var online = yOrders.Where(x => (x.PaymentMethod == 1 || x.PaymentMethod == 2) && (x.PaymentStatus == 1 || x.Status == 4)).Sum(x => x.PaymentAmount);
                    var codSub = yOrders.Where(x => x.PaymentMethod == 0 && x.CodStatus == 2).Sum(x => x.PaymentAmount);
                    var codHold = yOrders.Where(x => x.PaymentMethod == 0 && x.CodStatus == 1).Sum(x => x.PaymentAmount);
                    var pend = yOrders.Where(x => x.PaymentMethod == 0 && x.CodStatus == 0 && x.Status != 5 && x.Status != 4).Sum(x => x.PaymentAmount);
                    var paid = online + codSub;
                    var collectionRate = grossRev > 0 ? Math.Round((double)paid / (double)grossRev * 100, 1) : 100.0;

                    report.Items.Add(new FinancialPeriodItemDto
                    {
                        PeriodLabel = y.ToString(),
                        PeriodDate = new DateTime(y, 1, 1),
                        OrderCount = yOrders.Count,
                        CompletedOrderCount = yOrders.Count(x => x.Status == 4),
                        GrossRevenue = grossRev,
                        PaidAmount = paid,
                        OnlineAmount = online,
                        CodSubmittedAmount = codSub,
                        CodHoldingAmount = codHold,
                        PendingAmount = pend,
                        CollectionRate = collectionRate
                    });
                }
            }

            // Cơ cấu doanh thu theo Danh mục
            var categoryRevenues = await _context.OrderDetails
                .Where(od => od.Order.Status == 4 && od.Order.OrderDate >= startDate && od.Order.OrderDate < endExclusive)
                .GroupBy(od => new
                {
                    CategoryId = od.ProductVariant.Product.CategoryId,
                    CategoryName = od.ProductVariant.Product.Category != null ? od.ProductVariant.Product.Category.Name : "Khác"
                })
                .Select(g => new
                {
                    g.Key.CategoryId,
                    g.Key.CategoryName,
                    SoldQuantity = g.Sum(x => x.Quantity),
                    Revenue = g.Sum(x => x.TotalAmount)
                })
                .OrderByDescending(x => x.Revenue)
                .ToListAsync();

            var totalCatRev = categoryRevenues.Sum(x => x.Revenue);
            report.CategoryRevenues = categoryRevenues.Select(c => new CategoryRevenueDto
            {
                CategoryId = c.CategoryId,
                CategoryName = c.CategoryName,
                SoldQuantity = c.SoldQuantity,
                Revenue = c.Revenue,
                Percentage = totalCatRev > 0 ? Math.Round((double)(c.Revenue / totalCatRev) * 100, 1) : 0
            }).ToList();

            // Hiệu suất đội ngũ Shipper
            var shippers = await _context.Shippers
                .Include(s => s.Shippings)
                    .ThenInclude(sh => sh.Order)
                        .ThenInclude(o => o.Payment)
                .ToListAsync();

            report.ShipperPerformances = shippers.Select(s =>
            {
                var shipperDeliveries = s.Shippings
                    .Where(sh => sh.Order != null && sh.Order.OrderDate >= startDate && sh.Order.OrderDate < endExclusive)
                    .ToList();

                var completed = shipperDeliveries.Count(sh => sh.Status == 2 || (sh.Order != null && sh.Order.Status == 4));
                var failed = shipperDeliveries.Count(sh => sh.Status == 3 || sh.Status == 5);
                var inTransit = shipperDeliveries.Count(sh => sh.Status == 1 || sh.Status == 4);
                var codHolding = shipperDeliveries
                    .Where(sh => sh.Order?.Payment != null && sh.Order.Payment.CodStatus == 1)
                    .Sum(sh => sh.Order.Payment.Amount);
                var codSubmitted = shipperDeliveries
                    .Where(sh => sh.Order?.Payment != null && sh.Order.Payment.CodStatus == 2)
                    .Sum(sh => sh.Order.Payment.Amount);
                var finished = completed + failed;
                var sRate = finished > 0 ? Math.Round((double)completed / finished * 100, 1) : 100.0;

                return new ShipperPerformanceDto
                {
                    ShipperId = s.ShipperId,
                    FullName = s.FullName,
                    PhoneNumber = s.PhoneNumber,
                    VehicleNumber = s.VehicleNumber,
                    TotalAssigned = shipperDeliveries.Count,
                    CompletedDeliveries = completed,
                    FailedDeliveries = failed,
                    InTransitCount = inTransit,
                    CodHoldingAmount = codHolding,
                    CodSubmittedAmount = codSubmitted,
                    SuccessRate = sRate
                };
            }).OrderByDescending(x => x.CompletedDeliveries).ToList();

            return report;
        }

        public async Task<RevenueStatisticsDto> GetRevenueStatisticsAsync()
        {
            var now = DateTime.UtcNow;
            var today = now.Date;
            var firstDayOfMonth = new DateTime(now.Year, now.Month, 1);
            var firstDayOfYear = new DateTime(now.Year, 1, 1);

            var todayRevenue = await _context.Orders
                .Where(x => x.Status == 4 && x.OrderDate >= today)
                .SumAsync(x => (decimal?)x.TotalAmount) ?? 0;

            var monthRevenue = await _context.Orders
                .Where(x => x.Status == 4 && x.OrderDate >= firstDayOfMonth)
                .SumAsync(x => (decimal?)x.TotalAmount) ?? 0;

            var yearRevenue = await _context.Orders
                .Where(x => x.Status == 4 && x.OrderDate >= firstDayOfYear)
                .SumAsync(x => (decimal?)x.TotalAmount) ?? 0;

            return new RevenueStatisticsDto
            {
                TodayRevenue = todayRevenue,
                MonthRevenue = monthRevenue,
                YearRevenue = yearRevenue
            };
        }

        public async Task<RevenueChartDto> GetRevenueChartAsync(
            string period,
            DateTime? from = null,
            DateTime? to = null,
            string groupBy = "day")
        {
            var now = DateTime.UtcNow;
            var result = new RevenueChartDto();

            if (string.Equals(period, "custom", StringComparison.OrdinalIgnoreCase))
            {
                if (!from.HasValue || !to.HasValue)
                {
                    throw new ArgumentException("Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc.");
                }

                var startDate = from.Value.Date;
                var endDate = to.Value.Date;
                if (endDate < startDate)
                {
                    throw new ArgumentException("Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.");
                }

                groupBy = (groupBy ?? "day").Trim().ToLowerInvariant();
                var endExclusive = endDate.AddDays(1);
                var completedOrders = await _context.Orders
                    .Where(x => x.Status == 4 && x.OrderDate >= startDate && x.OrderDate < endExclusive)
                    .Select(x => new { x.OrderDate, x.TotalAmount })
                    .ToListAsync();

                if (groupBy == "day")
                {
                    var revenueByDay = completedOrders
                        .GroupBy(x => x.OrderDate.Date)
                        .ToDictionary(x => x.Key, x => x.Sum(order => order.TotalAmount));

                    for (var date = startDate; date <= endDate; date = date.AddDays(1))
                    {
                        result.Labels.Add(date.ToString("dd/MM/yyyy"));
                        result.Data.Add(revenueByDay.GetValueOrDefault(date));
                    }
                }
                else if (groupBy == "month")
                {
                    var revenueByMonth = completedOrders
                        .GroupBy(x => new { x.OrderDate.Year, x.OrderDate.Month })
                        .ToDictionary(x => (x.Key.Year, x.Key.Month), x => x.Sum(order => order.TotalAmount));
                    var month = new DateTime(startDate.Year, startDate.Month, 1);
                    var lastMonth = new DateTime(endDate.Year, endDate.Month, 1);

                    while (month <= lastMonth)
                    {
                        result.Labels.Add(month.ToString("MM/yyyy"));
                        result.Data.Add(revenueByMonth.GetValueOrDefault((month.Year, month.Month)));
                        month = month.AddMonths(1);
                    }
                }
                else
                {
                    var revenueByYear = completedOrders
                        .GroupBy(x => x.OrderDate.Year)
                        .ToDictionary(x => x.Key, x => x.Sum(order => order.TotalAmount));

                    for (var year = startDate.Year; year <= endDate.Year; year++)
                    {
                        result.Labels.Add(year.ToString());
                        result.Data.Add(revenueByYear.GetValueOrDefault(year));
                    }
                }

                return result;
            }

            if (period == "day" || period == "day30")
            {
                var dayCount = period == "day30" ? 30 : 7;
                var firstDate = now.Date.AddDays(-(dayCount - 1));
                var completedOrders = await _context.Orders
                    .Where(x => x.Status == 4 && x.OrderDate >= firstDate)
                    .Select(x => new { x.OrderDate, x.TotalAmount })
                    .ToListAsync();

                var revenuesByDate = completedOrders
                    .GroupBy(x => x.OrderDate.Date)
                    .ToDictionary(x => x.Key, x => x.Sum(order => order.TotalAmount));

                for (int i = dayCount - 1; i >= 0; i--)
                {
                    var date = now.Date.AddDays(-i);
                    var revenue = revenuesByDate.GetValueOrDefault(date);

                    result.Labels.Add(date.ToString("dd/MM"));
                    result.Data.Add(revenue);
                }
            }
            else if (period == "month")
            {
                for (int i = 1; i <= 12; i++)
                {
                    var revenue = await _context.Orders
                        .Where(x => x.Status == 4 && x.OrderDate.Year == now.Year && x.OrderDate.Month == i)
                        .SumAsync(x => (decimal?)x.TotalAmount) ?? 0;

                    result.Labels.Add($"Tháng {i}");
                    result.Data.Add(revenue);
                }
            }
            else if (period == "year")
            {
                for (int i = 4; i >= 0; i--)
                {
                    var year = now.Year - i;
                    var revenue = await _context.Orders
                        .Where(x => x.Status == 4 && x.OrderDate.Year == year)
                        .SumAsync(x => (decimal?)x.TotalAmount) ?? 0;

                    result.Labels.Add(year.ToString());
                    result.Data.Add(revenue);
                }
            }

            return result;
        }

        public async Task<OrderStatisticsDto> GetOrderStatisticsAsync(DateTime? from = null, DateTime? to = null)
        {
            var query = _context.Orders.AsQueryable();
            if (from.HasValue) query = query.Where(x => x.OrderDate >= from.Value.Date);
            if (to.HasValue) query = query.Where(x => x.OrderDate < to.Value.Date.AddDays(1));

            var orders = await query.Select(x => x.Status).ToListAsync();

            return new OrderStatisticsDto
            {
                PendingOrders = orders.Count(x => x == 0),
                ConfirmedOrders = orders.Count(x => x == 1),
                ProcessingOrders = orders.Count(x => x == 2),
                ShippingOrders = orders.Count(x => x == 3),
                CompletedOrders = orders.Count(x => x == 4),
                CancelledOrders = orders.Count(x => x == 5)
            };
        }

        public async Task<IEnumerable<BestSellingProductDto>> GetBestSellingProductsAsync(
            int top = 10,
            DateTime? from = null,
            DateTime? to = null)
        {
            var query = _context.OrderDetails
                .Where(x => x.Order.Status == 4);

            if (from.HasValue) query = query.Where(x => x.Order.OrderDate >= from.Value.Date);
            if (to.HasValue) query = query.Where(x => x.Order.OrderDate < to.Value.Date.AddDays(1));

            var result = await query
                .GroupBy(x => new
                {
                    x.VariantId,
                    SKU = x.ProductVariant.SKU,
                    ProductName = x.ProductVariant.Product.Name,
                    ProductImageUrl = x.ProductVariant.Product.ProductVariants
                        .OrderBy(v => v.VariantId)
                        .Select(v => v.ImageUrl)
                        .FirstOrDefault() ?? x.ProductVariant.ImageUrl,
                    CategoryName = x.ProductVariant.Product.Category != null ? x.ProductVariant.Product.Category.Name : "Đồ chơi"
                })
                .Select(x => new BestSellingProductDto
                {
                    VariantId = x.Key.VariantId,
                    SKU = x.Key.SKU ?? string.Empty,
                    ProductName = x.Key.ProductName ?? string.Empty,
                    ProductImageUrl = x.Key.ProductImageUrl,
                    CategoryName = x.Key.CategoryName,
                    TotalQuantitySold = x.Sum(od => od.Quantity),
                    TotalRevenue = x.Sum(od => od.TotalAmount)
                })
                .OrderByDescending(x => x.TotalQuantitySold)
                .Take(top)
                .ToListAsync();

            return result;
        }

        public async Task<InventoryStatisticsDto> GetInventoryStatisticsAsync()
        {
            var inventories = await _context.Inventories
                .Include(x => x.ProductVariant)
                .ToListAsync();

            return new InventoryStatisticsDto
            {
                TotalVariants = inventories.Count,
                TotalQuantity = inventories.Sum(x => x.Quantity),
                LowStockVariants = inventories.Count(x => x.Quantity - x.ReservedQuantity <= 10),
                TotalInventoryValue = inventories.Sum(x => x.Quantity * x.ProductVariant.CostPrice)
            };
        }

        public async Task<PromotionStatisticsDto> GetPromotionStatisticsAsync()
        {
            var usages = await _context.VoucherUsages.ToListAsync();

            return new PromotionStatisticsDto
            {
                TotalVouchersUsed = usages.Count,
                TotalDiscountAmount = usages.Sum(x => x.DiscountAmount)
            };
        }
    }
}
