using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStoreManagement.Application.DTOs.Dashboard;
using ToyStoreManagement.Application.Interfaces.Repositories;
using ToyStoreManagement.Application.Interfaces.Services;

namespace ToyStoreManagement.Infrastructure.Services
{
    public class DashboardService : IDashboardService
    {
        private readonly IDashboardRepository _dashboardRepository;

        public DashboardService(IDashboardRepository dashboardRepository)
        {
            _dashboardRepository = dashboardRepository;
        }

        public async Task<DashboardSummaryDto> GetSummaryAsync()
        {
            return await _dashboardRepository.GetSummaryAsync();
        }

        public async Task<RevenueStatisticsDto> GetRevenueStatisticsAsync()
        {
            return await _dashboardRepository.GetRevenueStatisticsAsync();
        }

        public async Task<OrderStatisticsDto> GetOrderStatisticsAsync()
        {
            return await _dashboardRepository.GetOrderStatisticsAsync();
        }

        public async Task<IEnumerable<BestSellingProductDto>> GetBestSellingProductsAsync(
            int top = 10)
        {
            if (top <= 0)
            {
                top = 10;
            }

            if (top > 100)
            {
                top = 100;
            }

            return await _dashboardRepository.GetBestSellingProductsAsync(top);
        }

        public async Task<InventoryStatisticsDto> GetInventoryStatisticsAsync()
        {
            return await _dashboardRepository.GetInventoryStatisticsAsync();
        }

        public async Task<PromotionStatisticsDto> GetPromotionStatisticsAsync()
        {
            return await _dashboardRepository.GetPromotionStatisticsAsync();
        }
    }
}