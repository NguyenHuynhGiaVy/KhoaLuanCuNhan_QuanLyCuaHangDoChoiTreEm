using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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
    }
}
