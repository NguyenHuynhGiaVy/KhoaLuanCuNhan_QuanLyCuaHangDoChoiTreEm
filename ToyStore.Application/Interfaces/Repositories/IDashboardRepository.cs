using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStoreManagement.Application.DTOs.Dashboard;

namespace ToyStoreManagement.Application.Interfaces.Repositories
{
    public interface IDashboardRepository
    {
        Task<DashboardSummaryDto> GetSummaryAsync(DateTime? from = null, DateTime? to = null);

        Task<FinancialReportDto> GetFinancialReportAsync(
            DateTime? from = null,
            DateTime? to = null,
            string groupBy = "day");

        Task<RevenueStatisticsDto> GetRevenueStatisticsAsync();

        Task<RevenueChartDto> GetRevenueChartAsync(
            string period,
            DateTime? from = null,
            DateTime? to = null,
            string groupBy = "day");

        Task<OrderStatisticsDto> GetOrderStatisticsAsync(DateTime? from = null, DateTime? to = null);

        Task<IEnumerable<BestSellingProductDto>> GetBestSellingProductsAsync(
            int top = 10,
            DateTime? from = null,
            DateTime? to = null);

        Task<InventoryStatisticsDto> GetInventoryStatisticsAsync();

        Task<PromotionStatisticsDto> GetPromotionStatisticsAsync();
    }
}
