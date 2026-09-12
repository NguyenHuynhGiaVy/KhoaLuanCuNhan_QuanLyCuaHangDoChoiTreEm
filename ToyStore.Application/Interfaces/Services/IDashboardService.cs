using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStoreManagement.Application.DTOs.Dashboard;

namespace ToyStoreManagement.Application.Interfaces.Services
{
    public interface IDashboardService
    {
        Task<DashboardSummaryDto> GetSummaryAsync();

        Task<RevenueStatisticsDto> GetRevenueStatisticsAsync();

        Task<OrderStatisticsDto> GetOrderStatisticsAsync();

        Task<IEnumerable<BestSellingProductDto>> GetBestSellingProductsAsync(int top = 10);

        Task<InventoryStatisticsDto> GetInventoryStatisticsAsync();

        Task<PromotionStatisticsDto> GetPromotionStatisticsAsync();
    }
}