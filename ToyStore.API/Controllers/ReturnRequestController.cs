using Microsoft.AspNetCore.Mvc;

using Microsoft.AspNetCore.Authorization;
using ToyStoreManagement.Application.DTOs.CustomerCare;
using ToyStoreManagement.Application.Interfaces.Services;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ToyStoreManagement.Infrastructure.Data;

namespace ToyStoreManagement.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ReturnRequestController : ControllerBase
    {
        private readonly IReturnRequestService _returnRequestService;
        private readonly ApplicationDbContext _context;

        public ReturnRequestController(
            IReturnRequestService returnRequestService,
            ApplicationDbContext context)
        {
            _returnRequestService = returnRequestService;
            _context = context;
        }

        [HttpGet]
        [Authorize(Policy = "StaffAccess")]
        public async Task<IActionResult> GetAll()
        {
            return Ok(await _returnRequestService.GetAllAsync());
        }

        [HttpGet("mine")]
        [Authorize(Policy = "CustomerAccess")]
        public async Task<IActionResult> GetMine()
        {
            var customerId = await GetCurrentCustomerId();
            if (!customerId.HasValue)
                return NotFound(new { message = "Bạn chưa tạo hồ sơ khách hàng." });
            return Ok(await _returnRequestService.GetByCustomerIdAsync(customerId.Value));
        }

        [HttpGet("{returnRequestId:int}")]
        public async Task<IActionResult> GetById(int returnRequestId)
        {
            var result =
                await _returnRequestService
                    .GetByIdAsync(returnRequestId);

            if (result == null)
                return NotFound();
            if (!IsStaff && await GetCurrentCustomerId() != result.CustomerId)
                return Forbid();

            return Ok(result);
        }

        [HttpGet("by-customer/{customerId}")]
        public async Task<IActionResult> GetByCustomerId(
            int customerId)
        {
            var currentCustomerId = await GetCurrentCustomerId();
            if (!IsStaff && currentCustomerId != customerId)
                return Forbid();
            return Ok(
                await _returnRequestService
                    .GetByCustomerIdAsync(customerId));
        }

        [HttpGet("by-order/{orderId}")]
        public async Task<IActionResult> GetByOrderId(
            int orderId)
        {
            if (!IsStaff)
            {
                var currentCustomerId = await GetCurrentCustomerId();
                var orderCustomerId = await _context.Orders
                    .Where(x => x.OrderId == orderId)
                    .Select(x => x.CustomerId)
                    .FirstOrDefaultAsync();
                if (!currentCustomerId.HasValue || orderCustomerId != currentCustomerId)
                    return Forbid();
            }
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
            if (!IsStaff && await GetCurrentCustomerId() != result.CustomerId)
                return Forbid();

            return Ok(result);
        }

        [HttpPost]
        [Authorize(Policy = "CustomerAccess")]
        public async Task<IActionResult> Create(
            [FromBody] CreateReturnRequestDto dto)
        {
            try
            {
                var customerId = await GetCurrentCustomerId();
                if (!customerId.HasValue)
                    return NotFound(new { message = "Bạn chưa tạo hồ sơ khách hàng." });
                dto.CustomerId = customerId.Value;
                var result =
                    await _returnRequestService.CreateAsync(dto);

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
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
                var existing = await _returnRequestService.GetByIdAsync(returnRequestId);
                if (existing == null)
                    return NotFound();
                if (!IsStaff && await GetCurrentCustomerId() != existing.CustomerId)
                    return Forbid();
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
                var existing = await _returnRequestService.GetByIdAsync(returnRequestId);
                if (existing == null)
                    return NotFound();
                if (!IsStaff && await GetCurrentCustomerId() != existing.CustomerId)
                    return Forbid();
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
                var existing = await _returnRequestService.GetByIdAsync(returnRequestId);
                if (existing == null)
                    return NotFound();
                if (!IsStaff && await GetCurrentCustomerId() != existing.CustomerId)
                    return Forbid();
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
                var detail = await _returnRequestService.GetDetailByIdAsync(returnRequestDetailId);
                if (detail == null)
                    return NotFound();
                var request = await _returnRequestService.GetByIdAsync(detail.ReturnRequestId);
                if (request == null)
                    return NotFound();
                if (!IsStaff && await GetCurrentCustomerId() != request.CustomerId)
                    return Forbid();
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

        [HttpPost("{returnRequestId}/receive")]
        [Authorize(Policy = "StaffAccess")]
        public async Task<IActionResult> Receive(int returnRequestId)
        {
            try
            {
                var result = await _returnRequestService.ReceiveAsync(returnRequestId);
                return result == null ? NotFound() : Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        private bool IsStaff =>
            User.IsInRole("Admin") || User.IsInRole("Manager") || User.IsInRole("Staff");

        private async Task<int?> GetCurrentCustomerId()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? User.FindFirstValue("sub");
            if (string.IsNullOrWhiteSpace(userId))
                return null;
            return await _context.Customers
                .Where(x => x.UserId == userId)
                .Select(x => (int?)x.CustomerId)
                .FirstOrDefaultAsync();
        }
    }
}
