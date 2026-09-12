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
    }
}