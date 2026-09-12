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
