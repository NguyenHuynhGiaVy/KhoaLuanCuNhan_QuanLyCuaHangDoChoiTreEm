using Microsoft.AspNetCore.Mvc;

using Microsoft.AspNetCore.Authorization;

using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
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

        // GET: api/Customer/profile
        [HttpGet("profile")]
        [Authorize]
        public async Task<IActionResult> GetMyProfile()
        {
            var userId = GetCurrentUserId();
            if (userId == null)
                return Unauthorized(new { message = "Không xác định được tài khoản đang đăng nhập." });

            var result = await _customerService.GetByUserIdAsync(userId);
            if (result == null)
            {
                var email = User.FindFirstValue(ClaimTypes.Email)
                    ?? User.FindFirstValue(JwtRegisteredClaimNames.Email)
                    ?? string.Empty;
                var fullName = User.FindFirstValue("FullName")
                    ?? User.FindFirstValue(ClaimTypes.Name)
                    ?? "Khách hàng";

                // Check if customer exists by email to link
                if (!string.IsNullOrWhiteSpace(email))
                {
                    var all = await _customerService.GetAllAsync();
                    var match = all.FirstOrDefault(c => string.Equals(c.Email, email, StringComparison.OrdinalIgnoreCase));
                    if (match != null)
                    {
                        await _customerService.UpdateAsync(match.CustomerId, new UpdateCustomerDto
                        {
                            FullName = match.FullName,
                            Phone = match.Phone,
                            Email = match.Email,
                            DateOfBirth = match.DateOfBirth,
                            Gender = match.Gender,
                            Address = match.Address,
                            Status = match.Status
                        });
                        return Ok(match);
                    }
                }

                // Return a valid default customer DTO without violating DB unique constraints
                return Ok(new CustomerDto
                {
                    CustomerId = 0,
                    FullName = fullName,
                    Email = email,
                    Phone = string.Empty,
                    UserId = userId,
                    Address = string.Empty,
                    LoyaltyPoint = 0,
                    Status = 1,
                    CreatedAt = DateTime.UtcNow
                });
            }

            return Ok(result);
        }

        // PUT: api/Customer/profile
        [HttpPut("profile")]
        [Authorize]
        public async Task<IActionResult> SaveMyProfile(
            [FromBody] SaveCustomerProfileDto dto)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
                return Unauthorized(new { message = "Không xác định được tài khoản đang đăng nhập." });

            if (string.IsNullOrWhiteSpace(dto.FullName)
                || string.IsNullOrWhiteSpace(dto.Phone)
                || string.IsNullOrWhiteSpace(dto.Address))
            {
                return BadRequest(new { message = "Vui lòng nhập đầy đủ họ tên, số điện thoại và địa chỉ." });
            }

            var email = User.FindFirstValue(ClaimTypes.Email)
                ?? User.FindFirstValue(JwtRegisteredClaimNames.Email)
                ?? string.Empty;

            try
            {
                var existing = await _customerService.GetByUserIdAsync(userId);
                if (existing != null)
                {
                    var updated = await _customerService.UpdateAsync(existing.CustomerId, new UpdateCustomerDto
                    {
                        FullName = dto.FullName.Trim(),
                        Phone = dto.Phone.Trim(),
                        Email = !string.IsNullOrWhiteSpace(email) ? email : existing.Email,
                        DateOfBirth = dto.DateOfBirth,
                        Gender = dto.Gender,
                        Address = dto.Address.Trim(),
                        Status = existing.Status
                    });

                    return Ok(updated);
                }

                // Check if customer exists by phone or email
                var all = await _customerService.GetAllAsync();
                var match = all.FirstOrDefault(c =>
                    c.Phone == dto.Phone.Trim()
                    || (!string.IsNullOrWhiteSpace(email) && string.Equals(c.Email, email, StringComparison.OrdinalIgnoreCase)));

                if (match != null)
                {
                    var updated = await _customerService.UpdateAsync(match.CustomerId, new UpdateCustomerDto
                    {
                        FullName = dto.FullName.Trim(),
                        Phone = dto.Phone.Trim(),
                        Email = !string.IsNullOrWhiteSpace(email) ? email : match.Email,
                        DateOfBirth = dto.DateOfBirth,
                        Gender = dto.Gender,
                        Address = dto.Address.Trim(),
                        Status = match.Status
                    });

                    return Ok(updated);
                }

                var created = await _customerService.CreateAsync(new CreateCustomerDto
                {
                    FullName = dto.FullName.Trim(),
                    Phone = dto.Phone.Trim(),
                    Email = email,
                    UserId = userId,
                    DateOfBirth = dto.DateOfBirth,
                    Gender = dto.Gender,
                    Address = dto.Address.Trim(),
                    LoyaltyPoint = 0,
                    Status = 1
                });

                return Ok(created);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.InnerException?.Message ?? ex.Message });
            }
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

        private string? GetCurrentUserId()
        {
            return User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? User.FindFirstValue("sub");
        }
    }
}
