using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using ToyStoreManagement.Application.Interfaces.Services;

namespace ToyStoreManagement.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Policy = "StaffAccess")]
    public class DashboardController : ControllerBase
    {
        private readonly IDashboardService _dashboardService;

        public DashboardController(IDashboardService dashboardService)
        {
            _dashboardService = dashboardService;
        }

        // GET: api/Dashboard/summary?from=&to=
        [HttpGet("summary")]
        public async Task<IActionResult> GetSummary(
            [FromQuery] DateTime? from = null,
            [FromQuery] DateTime? to = null)
        {
            try
            {
                var result = await _dashboardService.GetSummaryAsync(from, to);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        // GET: api/Dashboard/financial-report?from=&to=&groupBy=day|month|year
        [HttpGet("financial-report")]
        public async Task<IActionResult> GetFinancialReport(
            [FromQuery] DateTime? from = null,
            [FromQuery] DateTime? to = null,
            [FromQuery] string groupBy = "day")
        {
            try
            {
                var result = await _dashboardService.GetFinancialReportAsync(from, to, groupBy);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        // GET: api/Dashboard/revenue
        [HttpGet("revenue")]
        public async Task<IActionResult> GetRevenueStatistics()
        {
            try
            {
                var result = await _dashboardService.GetRevenueStatisticsAsync();
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        // GET: api/Dashboard/revenue-chart?period=&from=&to=&groupBy=
        [HttpGet("revenue-chart")]
        public async Task<IActionResult> GetRevenueChart(
            [FromQuery] string period = "day",
            [FromQuery] DateTime? from = null,
            [FromQuery] DateTime? to = null,
            [FromQuery] string groupBy = "day")
        {
            try
            {
                var result = await _dashboardService.GetRevenueChartAsync(period, from, to, groupBy);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        // GET: api/Dashboard/orders?from=&to=
        [HttpGet("orders")]
        public async Task<IActionResult> GetOrderStatistics(
            [FromQuery] DateTime? from = null,
            [FromQuery] DateTime? to = null)
        {
            try
            {
                var result = await _dashboardService.GetOrderStatisticsAsync(from, to);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        // GET: api/Dashboard/best-selling?top=10&from=&to=
        [HttpGet("best-selling")]
        public async Task<IActionResult> GetBestSellingProducts(
            [FromQuery] int top = 10,
            [FromQuery] DateTime? from = null,
            [FromQuery] DateTime? to = null)
        {
            try
            {
                var result = await _dashboardService.GetBestSellingProductsAsync(top, from, to);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        // GET: api/Dashboard/inventory
        [HttpGet("inventory")]
        public async Task<IActionResult> GetInventoryStatistics()
        {
            try
            {
                var result = await _dashboardService.GetInventoryStatisticsAsync();
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        // GET: api/Dashboard/promotions
        [HttpGet("promotions")]
        public async Task<IActionResult> GetPromotionStatistics()
        {
            try
            {
                var result = await _dashboardService.GetPromotionStatisticsAsync();
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }
    }
}
