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
    public class CustomerFeedbackController : ControllerBase
    {
        private readonly ICustomerFeedbackService _feedbackService;
        private readonly ApplicationDbContext _context;

        public CustomerFeedbackController(
            ICustomerFeedbackService feedbackService,
            ApplicationDbContext context)
        {
            _feedbackService = feedbackService;
            _context = context;
        }

        [HttpGet]
        [Authorize(Policy = "StaffAccess")]
        public async Task<IActionResult> GetAll()
        {
            return Ok(await _feedbackService.GetAllAsync());
        }

        [HttpGet("{customerFeedbackId}")]
        public async Task<IActionResult> GetById(
            long customerFeedbackId)
        {
            var result =
                await _feedbackService
                    .GetByIdAsync(customerFeedbackId);

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
            if (!IsStaff && await GetCurrentCustomerId() != customerId)
                return Forbid();
            return Ok(
                await _feedbackService
                    .GetByCustomerIdAsync(customerId));
        }

        [HttpGet("by-order/{orderId}")]
        public async Task<IActionResult> GetByOrderId(
            int orderId)
        {
            if (!IsStaff)
            {
                var customerId = await GetCurrentCustomerId();
                var orderCustomerId = await _context.Orders
                    .Where(x => x.OrderId == orderId)
                    .Select(x => x.CustomerId)
                    .FirstOrDefaultAsync();
                if (!customerId.HasValue || orderCustomerId != customerId)
                    return Forbid();
            }
            return Ok(
                await _feedbackService
                    .GetByOrderIdAsync(orderId));
        }

        [HttpPost]
        [Authorize(Policy = "CustomerAccess")]
        public async Task<IActionResult> Create(
            [FromBody] CreateCustomerFeedbackDto dto)
        {
            try
            {
                var customerId = await GetCurrentCustomerId();
                if (!customerId.HasValue)
                    return NotFound(new { message = "Bạn chưa tạo hồ sơ khách hàng." });
                dto.CustomerId = customerId.Value;
                var result =
                    await _feedbackService.CreateAsync(dto);

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPut("{customerFeedbackId}")]
        [Authorize(Policy = "StaffAccess")]
        public async Task<IActionResult> Update(
            long customerFeedbackId,
            [FromBody] UpdateCustomerFeedbackDto dto)
        {
            try
            {
                var existing = await _feedbackService.GetByIdAsync(customerFeedbackId);
                if (existing == null)
                    return NotFound();
                if (!IsStaff && await GetCurrentCustomerId() != existing.CustomerId)
                    return Forbid();
                var result =
                    await _feedbackService
                        .UpdateAsync(customerFeedbackId, dto);

                if (result == null)
                    return NotFound();

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
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

        [HttpDelete("{customerFeedbackId}")]
        [Authorize(Policy = "CustomerAccess")]
        public async Task<IActionResult> Delete(
            long customerFeedbackId)
        {
            try
            {
                var existing = await _feedbackService.GetByIdAsync(customerFeedbackId);
                if (existing == null)
                    return NotFound();
                if (await GetCurrentCustomerId() != existing.CustomerId)
                    return Forbid();
                var result =
                    await _feedbackService
                        .DeleteAsync(customerFeedbackId);

                if (!result)
                    return NotFound();

                return Ok(new
                {
                    message = "Xóa phản hồi thành công."
                });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }
    }
}
