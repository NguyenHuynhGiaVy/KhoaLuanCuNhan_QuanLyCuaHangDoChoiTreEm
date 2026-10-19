using System;
using System.Collections.Generic;
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

        public async Task<DashboardSummaryDto> GetSummaryAsync(DateTime? from = null, DateTime? to = null)
        {
            return await _dashboardRepository.GetSummaryAsync(from, to);
        }

        public async Task<FinancialReportDto> GetFinancialReportAsync(
            DateTime? from = null,
            DateTime? to = null,
            string groupBy = "day")
        {
            return await _dashboardRepository.GetFinancialReportAsync(from, to, groupBy);
        }

        public async Task<RevenueStatisticsDto> GetRevenueStatisticsAsync()
        {
            return await _dashboardRepository.GetRevenueStatisticsAsync();
        }

        public async Task<RevenueChartDto> GetRevenueChartAsync(
            string period,
            DateTime? from = null,
            DateTime? to = null,
            string groupBy = "day")
        {
            return await _dashboardRepository.GetRevenueChartAsync(period, from, to, groupBy);
        }

        public async Task<OrderStatisticsDto> GetOrderStatisticsAsync(DateTime? from = null, DateTime? to = null)
        {
            return await _dashboardRepository.GetOrderStatisticsAsync(from, to);
        }

        public async Task<IEnumerable<BestSellingProductDto>> GetBestSellingProductsAsync(
            int top = 10,
            DateTime? from = null,
            DateTime? to = null)
        {
            if (top <= 0) top = 10;
            if (top > 100) top = 100;

            return await _dashboardRepository.GetBestSellingProductsAsync(top, from, to);
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
