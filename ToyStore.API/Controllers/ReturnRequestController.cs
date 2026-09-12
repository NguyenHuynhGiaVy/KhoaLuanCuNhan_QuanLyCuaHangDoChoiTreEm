using Microsoft.AspNetCore.Mvc;

using Microsoft.AspNetCore.Authorization;
using ToyStoreManagement.Application.DTOs.CustomerCare;
using ToyStoreManagement.Application.Interfaces.Services;

namespace ToyStoreManagement.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ReturnRequestController : ControllerBase
    {
        private readonly IReturnRequestService _returnRequestService;

        public ReturnRequestController(
            IReturnRequestService returnRequestService)
        {
            _returnRequestService = returnRequestService;
        }

        [HttpGet]
        [Authorize(Policy = "StaffAccess")]
        public async Task<IActionResult> GetAll()
        {
            return Ok(await _returnRequestService.GetAllAsync());
        }

        [HttpGet("{returnRequestId}")]
        public async Task<IActionResult> GetById(int returnRequestId)
        {
            var result =
                await _returnRequestService
                    .GetByIdAsync(returnRequestId);

            if (result == null)
                return NotFound();

            return Ok(result);
        }

        [HttpGet("by-customer/{customerId}")]
        public async Task<IActionResult> GetByCustomerId(
            int customerId)
        {
            return Ok(
                await _returnRequestService
                    .GetByCustomerIdAsync(customerId));
        }

        [HttpGet("by-order/{orderId}")]
        public async Task<IActionResult> GetByOrderId(
            int orderId)
        {
            return Ok(
                await _returnRequestService
                    .GetByOrderIdAsync(orderId));
        }

        [HttpGet("by-code/{returnCode}")]
        public async Task<IActionResult> GetByReturnCode(
            string returnCode)
        {
            var result =
                await _returnRequestService
                    .GetByReturnCodeAsync(returnCode);

            if (result == null)
                return NotFound();

            return Ok(result);
        }

        [HttpPost]
        [Authorize(Policy = "CustomerAccess")]
        public async Task<IActionResult> Create(
            [FromBody] CreateReturnRequestDto dto)
        {
            try
            {
                var result =
                    await _returnRequestService.CreateAsync(dto);

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPut("{returnRequestId}")]
        [Authorize(Policy = "StaffAccess")]
        public async Task<IActionResult> Update(
            int returnRequestId,
            [FromBody] UpdateReturnRequestDto dto)
        {
            try
            {
                var result =
                    await _returnRequestService
                        .UpdateAsync(returnRequestId, dto);

                if (result == null)
                    return NotFound();

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpDelete("{returnRequestId}")]
        [Authorize(Policy = "CustomerAccess")]
        public async Task<IActionResult> Delete(int returnRequestId)
        {
            try
            {
                var result =
                    await _returnRequestService
                        .DeleteAsync(returnRequestId);

                if (!result)
                    return NotFound();

                return Ok(new
                {
                    message = "Xóa yêu cầu đổi/trả thành công."
                });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPost("{returnRequestId}/details")]
        [Authorize(Policy = "CustomerAccess")]
        public async Task<IActionResult> AddDetail(
            int returnRequestId,
            [FromBody] CreateReturnRequestDetailDto dto)
        {
            try
            {
                var result =
                    await _returnRequestService
                        .AddDetailAsync(returnRequestId, dto);

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpDelete("details/{returnRequestDetailId}")]
        [Authorize(Policy = "CustomerAccess")]
        public async Task<IActionResult> DeleteDetail(
            int returnRequestDetailId)
        {
            try
            {
                var result =
                    await _returnRequestService
                        .DeleteDetailAsync(returnRequestDetailId);

                if (!result)
                    return NotFound();

                return Ok(new
                {
                    message = "Xóa chi tiết đổi/trả thành công."
                });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }
    }
}
