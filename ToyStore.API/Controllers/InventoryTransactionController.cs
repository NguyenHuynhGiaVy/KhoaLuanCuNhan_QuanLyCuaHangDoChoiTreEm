using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using ToyStoreManagement.Application.Interfaces.Services;

namespace ToyStoreManagement.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class InventoryTransactionController : ControllerBase
    {
        private readonly IInventoryTransactionService
            _transactionService;

        public InventoryTransactionController(
            IInventoryTransactionService transactionService)
        {
            _transactionService = transactionService;
        }

        // GET: api/InventoryTransaction
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var transactions =
                await _transactionService.GetAllAsync();

            return Ok(transactions);
        }

        // GET: api/InventoryTransaction/variant/5
        [HttpGet("variant/{variantId}")]
        public async Task<IActionResult> GetByVariantId(int variantId)
        {
            var transactions =
                await _transactionService
                    .GetByVariantIdAsync(variantId);

            return Ok(transactions);
        }
    }
}