using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Threading.Tasks;
using ToyStoreManagement.Application.DTOs.Inventory;
using ToyStoreManagement.Application.Interfaces.Services;

namespace ToyStoreManagement.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class InventoryController : ControllerBase
    {
        private readonly IInventoryService _inventoryService;

        public InventoryController(IInventoryService inventoryService)
        {
            _inventoryService = inventoryService;
        }

        // GET: api/Inventory
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var inventories = await _inventoryService.GetAllAsync();

            return Ok(inventories);
        }

        // GET: api/Inventory/5
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var inventory = await _inventoryService.GetByIdAsync(id);

            if (inventory == null)
                return NotFound(new
                {
                    message = "Không tìm thấy thông tin tồn kho."
                });

            return Ok(inventory);
        }

        // GET: api/Inventory/variant/5
        [HttpGet("variant/{variantId}")]
        public async Task<IActionResult> GetByVariantId(int variantId)
        {
            var inventory =
                await _inventoryService.GetByVariantIdAsync(variantId);

            if (inventory == null)
                return NotFound(new
                {
                    message = "Variant chưa có thông tin tồn kho."
                });

            return Ok(inventory);
        }

        // POST: api/Inventory
        [HttpPost]
        [Authorize(Policy = "AdminOrManager")]
        public async Task<IActionResult> Create(
            [FromBody] CreateInventoryDto dto)
        {
            try
            {
                var inventory =
                    await _inventoryService.CreateAsync(dto);

                return Ok(inventory);
            }
            catch (Exception ex)
            {
                return BadRequest(new
                {
                    message = ex.Message
                });
            }
        }

        // PUT: api/Inventory/5
        [HttpPut("{id}")]
        [Authorize(Policy = "AdminOrManager")]
        public async Task<IActionResult> Update(
            int id,
            [FromBody] UpdateInventoryDto dto)
        {
            try
            {
                var inventory =
                    await _inventoryService.UpdateAsync(id, dto);

                if (inventory == null)
                    return NotFound(new
                    {
                        message = "Không tìm thấy thông tin tồn kho."
                    });

                return Ok(inventory);
            }
            catch (Exception ex)
            {
                return BadRequest(new
                {
                    message = ex.Message
                });
            }
        }

        // DELETE: api/Inventory/5
        [HttpDelete("{id}")]
        [Authorize(Policy = "AdminOrManager")]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _inventoryService.DeleteAsync(id);

            if (!result)
            {
                return NotFound(new
                {
                    message = "Không tìm thấy thông tin tồn kho."
                });
            }

            return Ok(new
            {
                message = "Xóa tồn kho thành công."
            });
        }

        // POST: api/Inventory/audit
        [HttpPost("audit")]
        [Authorize(Policy = "AdminOrManager")]
        public async Task<IActionResult> AuditStock([FromBody] InventoryAuditDto dto)
        {
            try
            {
                var result = await _inventoryService.AuditStockAsync(dto);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        // GET: api/Inventory/stock-movement
        [HttpGet("stock-movement")]
        [Authorize(Policy = "AdminOrManager")]
        public async Task<IActionResult> GetStockMovementReport([FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate, [FromQuery] int? variantId, [FromQuery] int? productId, [FromQuery] string? transactionType)
        {
            var filter = new StockMovementFilterDto
            {
                FromDate = fromDate,
                ToDate = toDate,
                VariantId = variantId,
                ProductId = productId,
                TransactionType = transactionType
            };
            var report = await _inventoryService.GetStockMovementReportAsync(filter);
            return Ok(report);
        }
    }
}
