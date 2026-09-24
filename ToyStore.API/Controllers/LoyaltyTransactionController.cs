using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Threading.Tasks;
using ToyStoreManagement.Application.Interfaces.Services;

namespace ToyStoreManagement.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class LoyaltyTransactionController : ControllerBase
    {
        private readonly ILoyaltyTransactionService
            _loyaltyTransactionService;

        public LoyaltyTransactionController(
            ILoyaltyTransactionService loyaltyTransactionService)
        {
            _loyaltyTransactionService =
                loyaltyTransactionService;
        }

        // GET: api/LoyaltyTransaction
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var result =
                await _loyaltyTransactionService.GetAllAsync();

            return Ok(result);
        }

        // GET: api/LoyaltyTransaction/customer/5
        [HttpGet("customer/{customerId}")]
        public async Task<IActionResult> GetByCustomerId(
            int customerId)
        {
            var result =
                await _loyaltyTransactionService
                    .GetByCustomerIdAsync(customerId);

            return Ok(result);
        }

        [HttpGet("summary")]
        [Authorize(Policy = "CustomerAccess")]
        public async Task<IActionResult> GetSummary()
        {
            var userId = GetCurrentUserId();
            if (userId == null)
                return Unauthorized(new { message = "Không xác định được tài khoản đang đăng nhập." });

            var result = await _loyaltyTransactionService
                .GetSummaryByUserIdAsync(userId);

            if (result == null)
                return NotFound(new { message = "Tài khoản chưa có hồ sơ khách hàng." });

            return Ok(result);
        }

        [HttpPost("redeem/{voucherId:int}")]
        [Authorize(Policy = "CustomerAccess")]
        public async Task<IActionResult> RedeemVoucher(int voucherId)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
                return Unauthorized(new { message = "Không xác định được tài khoản đang đăng nhập." });

            try
            {
                var result = await _loyaltyTransactionService
                    .RedeemVoucherAsync(userId, voucherId);

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        private string? GetCurrentUserId()
        {
            return User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? User.FindFirstValue("sub");
        }
    }
}
