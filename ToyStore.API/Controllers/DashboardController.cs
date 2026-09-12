using Microsoft.AspNetCore.Mvc;

using Microsoft.AspNetCore.Authorization;
using ToyStoreManagement.Application.Interfaces.Services;

namespace ToyStoreManagement.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Policy = "AdminOrManager")]
    public class DashboardController : ControllerBase
    {
        private readonly IDashboardService _dashboardService;

        public DashboardController(IDashboardService dashboardService)
        {
            _dashboardService = dashboardService;
        }

        // GET: api/Dashboard/summary
        [HttpGet("summary")]
        public async Task<IActionResult> GetSummary()
        {
            try
            {
                var result = await _dashboardService.GetSummaryAsync();
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
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
                return BadRequest(ex.Message);
            }
        }

        // GET: api/Dashboard/orders
        [HttpGet("orders")]
        public async Task<IActionResult> GetOrderStatistics()
        {
            try
            {
                var result = await _dashboardService.GetOrderStatisticsAsync();
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // GET: api/Dashboard/best-selling?top=10
        [HttpGet("best-selling")]
        public async Task<IActionResult> GetBestSellingProducts(
            [FromQuery] int top = 10)
        {
            try
            {
                var result =
                    await _dashboardService.GetBestSellingProductsAsync(top);

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // GET: api/Dashboard/inventory
        [HttpGet("inventory")]
        public async Task<IActionResult> GetInventoryStatistics()
        {
            try
            {
                var result =
                    await _dashboardService.GetInventoryStatisticsAsync();

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // GET: api/Dashboard/promotions
        [HttpGet("promotions")]
        public async Task<IActionResult> GetPromotionStatistics()
        {
            try
            {
                var result =
                    await _dashboardService.GetPromotionStatisticsAsync();

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }
    }
}
