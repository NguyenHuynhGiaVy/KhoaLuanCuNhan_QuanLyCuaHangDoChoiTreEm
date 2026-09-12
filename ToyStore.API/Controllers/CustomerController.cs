using Microsoft.AspNetCore.Mvc;

using Microsoft.AspNetCore.Authorization;

using System;
using System.Threading.Tasks;
using ToyStoreManagement.Application.DTOs.Customer;
using ToyStoreManagement.Application.Interfaces.Services;

namespace ToyStoreManagement.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class CustomerController : ControllerBase
    {
        private readonly ICustomerService _customerService;

        public CustomerController(ICustomerService customerService)
        {
            _customerService = customerService;
        }

        // GET: api/Customer
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var result = await _customerService.GetAllAsync();
            return Ok(result);
        }

        // GET: api/Customer/5
        [HttpGet("{customerId}")]
        public async Task<IActionResult> GetById(int customerId)
        {
            var result =
                await _customerService.GetByIdAsync(customerId);

            if (result == null)
                return NotFound("Không tìm thấy khách hàng.");

            return Ok(result);
        }

        // GET: api/Customer/user/{userId}
        [HttpGet("user/{userId}")]
        public async Task<IActionResult> GetByUserId(string userId)
        {
            var result =
                await _customerService.GetByUserIdAsync(userId);

            if (result == null)
                return NotFound(
                    "Không tìm thấy khách hàng theo UserId.");

            return Ok(result);
        }

        // POST: api/Customer
        [HttpPost]
        [Authorize(Policy = "AdminOrManager")]
        public async Task<IActionResult> Create(
            [FromBody] CreateCustomerDto dto)
        {
            try
            {
                var result =
                    await _customerService.CreateAsync(dto);

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // PUT: api/Customer/5
        [HttpPut("{customerId}")]
        [Authorize(Policy = "AdminOrManager")]
        public async Task<IActionResult> Update(
            int customerId,
            [FromBody] UpdateCustomerDto dto)
        {
            try
            {
                var result =
                    await _customerService.UpdateAsync(
                        customerId,
                        dto);

                if (result == null)
                    return NotFound("Không tìm thấy khách hàng.");

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // DELETE: api/Customer/5
        [HttpDelete("{customerId}")]
        [Authorize(Policy = "AdminOrManager")]
        public async Task<IActionResult> Delete(int customerId)
        {
            try
            {
                var result =
                    await _customerService.DeleteAsync(customerId);

                if (!result)
                    return NotFound("Không tìm thấy khách hàng.");

                return Ok(new
                {
                    message = "Xóa khách hàng thành công."
                });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }
    }
}