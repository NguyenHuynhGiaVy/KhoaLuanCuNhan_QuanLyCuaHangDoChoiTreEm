using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Threading.Tasks;
using ToyStoreManagement.Application.DTOs.Promotion;
using ToyStoreManagement.Application.Interfaces.Services;

namespace ToyStoreManagement.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class PromotionController : ControllerBase
    {
        private readonly IPromotionService _promotionService;

        public PromotionController(
            IPromotionService promotionService)
        {
            _promotionService = promotionService;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            try
            {
                var result =
                    await _promotionService.GetAllAsync();

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpGet("{promotionId}")]
        public async Task<IActionResult> GetById(
            int promotionId)
        {
            try
            {
                var result =
                    await _promotionService
                        .GetByIdAsync(promotionId);

                if (result == null)
                    return NotFound(
                        "Không tìm thấy chương trình khuyến mãi.");

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPost]
        [Authorize(Policy = "AdminOrManager")]
        public async Task<IActionResult> Create(
            CreatePromotionDto dto)
        {
            try
            {
                var result =
                    await _promotionService.CreateAsync(dto);

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPut("{promotionId}")]
        [Authorize(Policy = "AdminOrManager")]
        public async Task<IActionResult> Update(
            int promotionId,
            UpdatePromotionDto dto)
        {
            try
            {
                var result =
                    await _promotionService
                        .UpdateAsync(promotionId, dto);

                if (result == null)
                    return NotFound(
                        "Không tìm thấy chương trình khuyến mãi.");

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpDelete("{promotionId}")]
        [Authorize(Policy = "AdminOrManager")]
        public async Task<IActionResult> Delete(
            int promotionId)
        {
            try
            {
                var result =
                    await _promotionService
                        .DeleteAsync(promotionId);

                if (!result)
                    return NotFound(
                        "Không tìm thấy chương trình khuyến mãi.");

                return Ok(
                    "Xóa chương trình khuyến mãi thành công.");
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPost("{promotionId}/conditions")]
        [Authorize(Policy = "AdminOrManager")]
        public async Task<IActionResult> AddCondition(
            int promotionId,
            CreatePromotionConditionDto dto)
        {
            try
            {
                var result =
                    await _promotionService
                        .AddConditionAsync(
                            promotionId, dto);

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpDelete("conditions/{conditionId}")]
        [Authorize(Policy = "AdminOrManager")]
        public async Task<IActionResult> DeleteCondition(
            int conditionId)
        {
            try
            {
                var result =
                    await _promotionService
                        .DeleteConditionAsync(conditionId);

                if (!result)
                    return NotFound(
                        "Không tìm thấy điều kiện khuyến mãi.");

                return Ok(
                    "Xóa điều kiện khuyến mãi thành công.");
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPost("{promotionId}/products")]
        [Authorize(Policy = "AdminOrManager")]
        public async Task<IActionResult> AddProduct(
            int promotionId,
            CreatePromotionProductDto dto)
        {
            try
            {
                var result =
                    await _promotionService
                        .AddProductAsync(
                            promotionId, dto);

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpDelete("products/{promotionProductId}")]
        [Authorize(Policy = "AdminOrManager")]
        public async Task<IActionResult> DeleteProduct(
            int promotionProductId)
        {
            try
            {
                var result =
                    await _promotionService
                        .DeleteProductAsync(
                            promotionProductId);

                if (!result)
                    return NotFound(
                        "Không tìm thấy sản phẩm trong chương trình.");

                return Ok(
                    "Xóa sản phẩm khỏi chương trình thành công.");
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }
    }
}