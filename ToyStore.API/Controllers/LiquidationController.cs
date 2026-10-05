using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ToyStoreManagement.Application.DTOs.Liquidation;
using ToyStoreManagement.Application.Interfaces.Services;

namespace ToyStoreManagement.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Policy = "AdminOrManager")]
    public class LiquidationController : ControllerBase
    {
        private readonly ILiquidationService _service;

        public LiquidationController(ILiquidationService service)
        {
            _service = service;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            return Ok(await _service.GetAllAsync());
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetById(int id)
        {
            var receipt = await _service.GetByIdAsync(id);
            return receipt == null ? NotFound() : Ok(receipt);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateLiquidationReceiptDto dto)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? User.FindFirstValue("sub");
            if (string.IsNullOrWhiteSpace(userId))
                return Unauthorized();
            try
            {
                return Ok(await _service.CreateAsync(dto, userId));
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("{id:int}/complete")]
        public async Task<IActionResult> Complete(int id)
        {
            try
            {
                var receipt = await _service.CompleteAsync(id);
                return receipt == null ? NotFound() : Ok(receipt);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("{id:int}/cancel")]
        public async Task<IActionResult> Cancel(int id)
        {
            try
            {
                var receipt = await _service.CancelAsync(id);
                return receipt == null ? NotFound() : Ok(receipt);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }
    }
}
