using Microsoft.AspNetCore.Mvc;

using Microsoft.AspNetCore.Authorization;
using ToyStoreManagement.Application.DTOs.CustomerCare;
using ToyStoreManagement.Application.Interfaces.Services;

namespace ToyStoreManagement.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class CustomerFeedbackController : ControllerBase
    {
        private readonly ICustomerFeedbackService _feedbackService;

        public CustomerFeedbackController(
            ICustomerFeedbackService feedbackService)
        {
            _feedbackService = feedbackService;
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

            return Ok(result);
        }

        [HttpGet("by-customer/{customerId}")]
        public async Task<IActionResult> GetByCustomerId(
            int customerId)
        {
            return Ok(
                await _feedbackService
                    .GetByCustomerIdAsync(customerId));
        }

        [HttpGet("by-order/{orderId}")]
        public async Task<IActionResult> GetByOrderId(
            int orderId)
        {
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

        [HttpDelete("{customerFeedbackId}")]
        [Authorize(Policy = "CustomerAccess")]
        public async Task<IActionResult> Delete(
            long customerFeedbackId)
        {
            try
            {
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
