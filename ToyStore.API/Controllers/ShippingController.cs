using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ToyStoreManagement.Application.DTOs.Order;
using ToyStoreManagement.Application.Interfaces.Services;

namespace ToyStoreManagement.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ShippingController : ControllerBase
    {
        private readonly IOrderService _orderService;

        public ShippingController(IOrderService orderService)
        {
            _orderService = orderService;
        }

        /// <summary>
        /// Tính toán khoảng cách từ kho hàng và thời gian giao hàng dự kiến
        /// </summary>
        [HttpPost("calculate-delivery-estimate")]
        [AllowAnonymous]
        public async Task<IActionResult> CalculateDeliveryEstimate([FromBody] CalculateDeliveryEstimateRequestDto request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var estimate = await _orderService.CalculateDeliveryEstimateAsync(request);
                return Ok(estimate);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Lấy danh sách đề xuất gộp đơn hàng thông minh (cùng người nhận hoặc bán kính lân cận)
        /// </summary>
        [HttpGet("batch-suggestions")]
        [Authorize(Policy = "StaffAccess")]
        public async Task<IActionResult> GetBatchSuggestions([FromQuery] double maxDistanceKm = 3.0)
        {
            try
            {
                var suggestions = await _orderService.GetBatchSuggestionsAsync(maxDistanceKm);
                return Ok(suggestions);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Gộp các đơn hàng được chỉ định vào chung một mã lô vận chuyển
        /// </summary>
        [HttpPost("merge-batch")]
        [Authorize(Policy = "StaffAccess")]
        public async Task<IActionResult> MergeBatch([FromBody] MergeBatchRequestDto request)
        {
            if (request.OrderIds == null || request.OrderIds.Count < 2)
            {
                return BadRequest(new { message = "Vui lòng chọn ít nhất 2 đơn hàng để gộp lô." });
            }

            try
            {
                var success = await _orderService.MergeBatchAsync(request);
                if (success)
                {
                    return Ok(new { message = "Gộp đơn hàng vào lô thành công." });
                }
                return BadRequest(new { message = "Không tìm thấy các đơn hàng hợp lệ để gộp." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Xuất kho và chuyển tất cả các đơn hàng thuộc mã lô sang trạng thái Đang giao (Dispatched)
        /// </summary>
        [HttpPost("dispatch-batch/{batchCode}")]
        [Authorize(Policy = "StaffAccess")]
        public async Task<IActionResult> DispatchBatch(string batchCode)
        {
            if (string.IsNullOrWhiteSpace(batchCode))
            {
                return BadRequest(new { message = "Mã lô không hợp lệ." });
            }

            try
            {
                var success = await _orderService.DispatchBatchAsync(batchCode);
                if (success)
                {
                    return Ok(new { message = $"Đã xuất kho và chuyển lô {batchCode} sang trạng thái Đang giao." });
                }
                return NotFound(new { message = "Không tìm thấy đơn hàng nào thuộc mã lô này." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }
    }
}
