using Microsoft.AspNetCore.Mvc;

using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using ToyStoreManagement.Application.DTOs.CustomerCare;
using ToyStoreManagement.Application.Interfaces.Services;

namespace ToyStoreManagement.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ProductReviewController : ControllerBase
    {
        private readonly IProductReviewService _productReviewService;
        private readonly ICustomerService _customerService;

        public ProductReviewController(
            IProductReviewService productReviewService,
            ICustomerService customerService)
        {
            _productReviewService = productReviewService;
            _customerService = customerService;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            return Ok(await _productReviewService.GetAllAsync());
        }

        [HttpGet("{productReviewId}")]
        public async Task<IActionResult> GetById(long productReviewId)
        {
            var result =
                await _productReviewService.GetByIdAsync(productReviewId);

            if (result == null)
                return NotFound();

            return Ok(result);
        }

        [HttpGet("by-product/{productId}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetByProductId(int productId)
        {
            return Ok(
                await _productReviewService.GetByProductIdAsync(productId));
        }

        [HttpGet("by-customer/{customerId}")]
        public async Task<IActionResult> GetByCustomerId(int customerId)
        {
            return Ok(
                await _productReviewService.GetByCustomerIdAsync(customerId));
        }

        [HttpGet("by-order/{orderId}")]
        public async Task<IActionResult> GetByOrderId(int orderId)
        {
            return Ok(
                await _productReviewService.GetByOrderIdAsync(orderId));
        }

        [HttpPost]
        [Authorize(Policy = "CustomerAccess")]
        public async Task<IActionResult> Create(
            [FromBody] CreateProductReviewDto dto)
        {
            try
            {
                var userId = GetCurrentUserId();
                if (userId == null)
                    return Unauthorized(new { message = "Vui lòng đăng nhập để gửi đánh giá." });

                var customer = await _customerService.GetByUserIdAsync(userId);
                if (customer == null)
                    return BadRequest(new { message = "Vui lòng hoàn thiện hồ sơ khách hàng trước khi gửi đánh giá." });

                // Không tin CustomerId từ trình duyệt: luôn dùng hồ sơ của tài khoản hiện tại.
                dto.CustomerId = customer.CustomerId;
                var result =
                    await _productReviewService.CreateAsync(dto);

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPut("{productReviewId}")]
        [Authorize(Policy = "CustomerAccess")]
        public async Task<IActionResult> Update(
            long productReviewId,
            [FromBody] UpdateProductReviewDto dto)
        {
            try
            {
                var result =
                    await _productReviewService
                        .UpdateAsync(productReviewId, dto);

                if (result == null)
                    return NotFound();

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpDelete("{productReviewId}")]
        [Authorize(Policy = "CustomerAccess")]
        public async Task<IActionResult> Delete(long productReviewId)
        {
            try
            {
                var result =
                    await _productReviewService
                        .DeleteAsync(productReviewId);

                if (!result)
                    return NotFound();

                return Ok(new
                {
                    message = "Xóa đánh giá thành công."
                });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        private string? GetCurrentUserId()
        {
            return User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? User.FindFirstValue("sub");
        }
    }
}
