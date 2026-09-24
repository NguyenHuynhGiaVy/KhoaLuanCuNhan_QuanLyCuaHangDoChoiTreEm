using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
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

        public async Task<DashboardSummaryDto> GetSummaryAsync()
        {
            var totalRevenue = await _context.Orders
                .Where(x => x.Status == 4)
                .SumAsync(x => (decimal?)x.TotalAmount) ?? 0;

            var totalOrders = await _context.Orders.CountAsync();

            var totalProducts = await _context.Products.CountAsync();

            var totalCustomers = await _context.Customers.CountAsync();

            return new DashboardSummaryDto
            {
                TotalRevenue = totalRevenue,
                TotalOrders = totalOrders,
                TotalProducts = totalProducts,
                TotalCustomers = totalCustomers
            };
        }

        public async Task<RevenueStatisticsDto> GetRevenueStatisticsAsync()
        {
            var now = DateTime.UtcNow;

            var today = now.Date;

            var firstDayOfMonth = new DateTime(
                now.Year,
                now.Month,
                1
            );

            var firstDayOfYear = new DateTime(
                now.Year,
                1,
                1
            );

            var todayRevenue = await _context.Orders
                .Where(x =>
                    x.Status == 4 &&
                    x.OrderDate >= today)
                .SumAsync(x => (decimal?)x.TotalAmount) ?? 0;

            var monthRevenue = await _context.Orders
                .Where(x =>
                    x.Status == 4 &&
                    x.OrderDate >= firstDayOfMonth)
                .SumAsync(x => (decimal?)x.TotalAmount) ?? 0;

            var yearRevenue = await _context.Orders
                .Where(x =>
                    x.Status == 4 &&
                    x.OrderDate >= firstDayOfYear)
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
                if (groupBy is not ("day" or "month" or "year"))
                {
                    throw new ArgumentException("Mốc thời gian không hợp lệ.");
                }

                var daySpan = (endDate - startDate).TotalDays;
                if (groupBy == "day" && daySpan > 366)
                {
                    throw new ArgumentException("Khoảng theo ngày tối đa là 366 ngày. Hãy chọn mốc theo tháng hoặc năm.");
                }

                if (groupBy == "month" && daySpan > 3650)
                {
                    throw new ArgumentException("Khoảng theo tháng tối đa là 10 năm. Hãy chọn mốc theo năm.");
                }

                if (groupBy == "year" && endDate.Year - startDate.Year > 30)
                {
                    throw new ArgumentException("Khoảng theo năm tối đa là 31 năm.");
                }

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
                var revenuesByDate = await _context.Orders
                    .Where(x => x.Status == 4 && x.OrderDate >= firstDate)
                    .GroupBy(x => x.OrderDate.Date)
                    .Select(x => new { Date = x.Key, Revenue = x.Sum(order => order.TotalAmount) })
                    .ToDictionaryAsync(x => x.Date, x => x.Revenue);

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
                // 12 months of current year
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
                // Last 5 years
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

        public async Task<OrderStatisticsDto> GetOrderStatisticsAsync()
        {
            return new OrderStatisticsDto
            {
                PendingOrders = await _context.Orders
                    .CountAsync(x => x.Status == 0),

                ConfirmedOrders = await _context.Orders
                    .CountAsync(x => x.Status == 1),

                ProcessingOrders = await _context.Orders
                    .CountAsync(x => x.Status == 2),

                ShippingOrders = await _context.Orders
                    .CountAsync(x => x.Status == 3),

                CompletedOrders = await _context.Orders
                    .CountAsync(x => x.Status == 4),

                CancelledOrders = await _context.Orders
                    .CountAsync(x => x.Status == 5)
            };
        }

        public async Task<IEnumerable<BestSellingProductDto>> GetBestSellingProductsAsync(
            int top = 10)
        {
            var result = await _context.OrderDetails
                .Where(x => x.Order.Status == 4)
                .GroupBy(x => new
                {
                    x.VariantId,
                    x.ProductVariant.SKU,
                    ProductName = x.ProductVariant.Product.Name
                })
                .Select(x => new BestSellingProductDto
                {
                    VariantId = x.Key.VariantId,
                    SKU = x.Key.SKU,
                    ProductName = x.Key.ProductName,
                    TotalQuantitySold = x.Sum(x => x.Quantity),
                    TotalRevenue = x.Sum(x => x.TotalAmount)
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

                LowStockVariants = inventories.Count(
                    x => x.Quantity - x.ReservedQuantity <= 10),

                TotalInventoryValue = inventories.Sum(
                    x => x.Quantity * x.ProductVariant.CostPrice)
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
