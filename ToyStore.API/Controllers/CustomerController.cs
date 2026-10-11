using Microsoft.AspNetCore.Mvc;

using Microsoft.AspNetCore.Authorization;

using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ToyStoreManagement.Application.DTOs.Customer;
using ToyStoreManagement.Application.Interfaces.Services;
using ToyStoreManagement.Domain.Entities;
using ToyStoreManagement.Infrastructure.Data;

namespace ToyStoreManagement.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class CustomerController : ControllerBase
    {
        private readonly ICustomerService _customerService;
        private readonly ApplicationDbContext _context;

        public CustomerController(
            ICustomerService customerService,
            ApplicationDbContext context)
        {
            _customerService = customerService;
            _context = context;
        }

        // GET: api/Customer
        [HttpGet]
        [Authorize(Policy = "StaffAccess")]
        public async Task<IActionResult> GetAll()
        {
            var result = await _customerService.GetAllAsync();
            return Ok(result);
        }

        // GET: api/Customer/5
        [HttpGet("{customerId}")]
        [Authorize(Policy = "StaffAccess")]
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
            if (!IsStaff && !string.Equals(GetCurrentUserId(), userId, StringComparison.Ordinal))
                return Forbid();

            var result =
                await _customerService.GetByUserIdAsync(userId);

            if (result == null)
                return NotFound(
                    "Không tìm thấy khách hàng theo UserId.");

            return Ok(result);
        }

        // GET: api/Customer/profile
        [HttpGet("profile")]
        [Authorize(Policy = "CustomerAccess")]
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

                // Không dùng email/số điện thoại để tự ghép hồ sơ. Tài khoản chỉ được
                // truy cập hồ sơ đã liên kết trực tiếp bằng UserId của chính tài khoản đó.
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
        [Authorize(Policy = "CustomerAccess")]
        public async Task<IActionResult> SaveMyProfile(
            [FromBody] SaveCustomerProfileDto dto)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
                return Unauthorized(new { message = "Không xác định được tài khoản đang đăng nhập." });

            if (string.IsNullOrWhiteSpace(dto.FullName)
                || string.IsNullOrWhiteSpace(dto.Phone))
            {
                return BadRequest(new { message = "Vui lòng nhập đầy đủ họ tên và số điện thoại." });
            }

            var email = User.FindFirstValue(ClaimTypes.Email)
                ?? User.FindFirstValue(JwtRegisteredClaimNames.Email)
                ?? string.Empty;

            try
            {
                var normalizedPhone = dto.Phone.Trim();
                var phoneInUse = await _context.Customers
                    .AsNoTracking()
                    .AnyAsync(customer => customer.Phone == normalizedPhone && customer.UserId != userId);
                if (phoneInUse)
                {
                    return Conflict(new { message = "Số điện thoại này đã thuộc về một hồ sơ khách hàng khác." });
                }

                var existing = await _customerService.GetByUserIdAsync(userId);
                if (existing != null)
                {
                    var updated = await _customerService.UpdateAsync(existing.CustomerId, new UpdateCustomerDto
                    {
                        FullName = dto.FullName.Trim(),
                        Phone = normalizedPhone,
                        Email = !string.IsNullOrWhiteSpace(email) ? email : existing.Email,
                        DateOfBirth = dto.DateOfBirth,
                        Gender = dto.Gender,
                        Address = existing.Address,
                        Status = existing.Status
                    });

                    return Ok(updated);
                }

                var created = await _customerService.CreateAsync(new CreateCustomerDto
                {
                    FullName = dto.FullName.Trim(),
                    Phone = normalizedPhone,
                    Email = email,
                    UserId = userId,
                    DateOfBirth = dto.DateOfBirth,
                    Gender = dto.Gender,
                    Address = string.Empty,
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

        [HttpGet("profile/addresses")]
        [Authorize(Policy = "CustomerAccess")]
        public async Task<IActionResult> GetMyAddresses()
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            var addresses = await _context.CustomerAddresses
                .AsNoTracking()
                .Where(address => address.Customer.UserId == userId)
                .OrderByDescending(address => address.IsDefault)
                .ThenByDescending(address => address.UpdatedAt ?? address.CreatedAt)
                .ToListAsync();

            return Ok(addresses.Select(MapAddress));
        }

        [HttpPost("profile/addresses")]
        [Authorize(Policy = "CustomerAccess")]
        public async Task<IActionResult> CreateMyAddress([FromBody] SaveCustomerAddressDto dto)
        {
            var customer = await GetCurrentCustomerAsync();
            if (customer == null) return BadRequest(new { message = "Vui lòng hoàn thiện hồ sơ trước khi lưu địa chỉ." });
            var validation = ValidateAddress(dto);
            if (validation != null) return BadRequest(new { message = validation });

            var hasAddress = await _context.CustomerAddresses.AnyAsync(address => address.CustomerId == customer.CustomerId);
            if (dto.IsDefault || !hasAddress)
            {
                await _context.CustomerAddresses
                    .Where(address => address.CustomerId == customer.CustomerId)
                    .ExecuteUpdateAsync(setters => setters.SetProperty(address => address.IsDefault, false));
            }

            var address = BuildAddress(customer.CustomerId, dto);
            address.IsDefault = dto.IsDefault || !hasAddress;
            _context.CustomerAddresses.Add(address);
            await _context.SaveChangesAsync();
            return Ok(MapAddress(address));
        }

        [HttpPut("profile/addresses/{addressId:int}")]
        [Authorize(Policy = "CustomerAccess")]
        public async Task<IActionResult> UpdateMyAddress(int addressId, [FromBody] SaveCustomerAddressDto dto)
        {
            var customer = await GetCurrentCustomerAsync();
            if (customer == null) return BadRequest(new { message = "Chưa có hồ sơ khách hàng." });
            var validation = ValidateAddress(dto);
            if (validation != null) return BadRequest(new { message = validation });

            var address = await _context.CustomerAddresses
                .FirstOrDefaultAsync(item => item.CustomerAddressId == addressId && item.CustomerId == customer.CustomerId);
            if (address == null) return NotFound(new { message = "Không tìm thấy địa chỉ." });

            if (dto.IsDefault)
            {
                await _context.CustomerAddresses
                    .Where(item => item.CustomerId == customer.CustomerId)
                    .ExecuteUpdateAsync(setters => setters.SetProperty(item => item.IsDefault, false));
            }

            CopyAddress(dto, address);
            address.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(MapAddress(address));
        }

        [HttpDelete("profile/addresses/{addressId:int}")]
        [Authorize(Policy = "CustomerAccess")]
        public async Task<IActionResult> DeleteMyAddress(int addressId)
        {
            var customer = await GetCurrentCustomerAsync();
            if (customer == null) return BadRequest(new { message = "Chưa có hồ sơ khách hàng." });
            var address = await _context.CustomerAddresses
                .FirstOrDefaultAsync(item => item.CustomerAddressId == addressId && item.CustomerId == customer.CustomerId);
            if (address == null) return NotFound(new { message = "Không tìm thấy địa chỉ." });

            var wasDefault = address.IsDefault;
            _context.CustomerAddresses.Remove(address);
            await _context.SaveChangesAsync();
            if (wasDefault)
            {
                var replacement = await _context.CustomerAddresses
                    .Where(item => item.CustomerId == customer.CustomerId)
                    .OrderByDescending(item => item.UpdatedAt ?? item.CreatedAt)
                    .FirstOrDefaultAsync();
                if (replacement != null)
                {
                    replacement.IsDefault = true;
                    await _context.SaveChangesAsync();
                }
            }
            return NoContent();
        }

        private async Task<Customer?> GetCurrentCustomerAsync()
        {
            var userId = GetCurrentUserId();
            return userId == null
                ? null
                : await _context.Customers.FirstOrDefaultAsync(customer => customer.UserId == userId);
        }

        private static string? ValidateAddress(SaveCustomerAddressDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.ReceiverName) || string.IsNullOrWhiteSpace(dto.ReceiverPhone))
                return "Vui lòng nhập họ tên và số điện thoại người nhận.";
            if (string.IsNullOrWhiteSpace(dto.AddressDetail) || string.IsNullOrWhiteSpace(dto.ProvinceName) || string.IsNullOrWhiteSpace(dto.WardName))
                return "Vui lòng chọn đủ tỉnh/thành, phường/xã và nhập địa chỉ chi tiết.";
            return null;
        }

        private static CustomerAddress BuildAddress(int customerId, SaveCustomerAddressDto dto)
        {
            var address = new CustomerAddress { CustomerId = customerId, CreatedAt = DateTime.UtcNow };
            CopyAddress(dto, address);
            return address;
        }

        private static void CopyAddress(SaveCustomerAddressDto source, CustomerAddress target)
        {
            target.ReceiverName = source.ReceiverName.Trim();
            target.ReceiverPhone = source.ReceiverPhone.Trim();
            target.AddressDetail = source.AddressDetail.Trim();
            target.ProvinceCode = source.ProvinceCode?.Trim() ?? string.Empty;
            target.ProvinceName = source.ProvinceName.Trim();
            target.WardCode = source.WardCode?.Trim() ?? string.Empty;
            target.WardName = source.WardName.Trim();
            target.IsDefault = source.IsDefault;
        }

        private static CustomerAddressDto MapAddress(CustomerAddress address)
        {
            var nowVietnam = new DateTimeOffset(DateTime.UtcNow, TimeSpan.Zero).ToOffset(TimeSpan.FromHours(7));
            var localDelivery = address.ProvinceName.Contains("Hà Nội", StringComparison.OrdinalIgnoreCase)
                || address.ProvinceName.Contains("Hồ Chí Minh", StringComparison.OrdinalIgnoreCase)
                || address.ProvinceName.Contains("Đà Nẵng", StringComparison.OrdinalIgnoreCase);
            var from = nowVietnam.Date.AddDays((nowVietnam.Hour >= 14 ? 3 : 2) + (localDelivery ? 0 : 1));
            var to = from.AddDays(localDelivery ? 1 : 2);
            return new CustomerAddressDto
            {
                CustomerAddressId = address.CustomerAddressId,
                ReceiverName = address.ReceiverName,
                ReceiverPhone = address.ReceiverPhone,
                AddressDetail = address.AddressDetail,
                ProvinceCode = address.ProvinceCode,
                ProvinceName = address.ProvinceName,
                WardCode = address.WardCode,
                WardName = address.WardName,
                FullAddress = string.Join(", ", new[] { address.AddressDetail, address.WardName, address.ProvinceName }.Where(value => !string.IsNullOrWhiteSpace(value))),
                IsDefault = address.IsDefault,
                EstimatedDeliveryFromDate = from,
                EstimatedDeliveryToDate = to
            };
        }

        private string? GetCurrentUserId()
        {
            return User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? User.FindFirstValue("sub");
        }

        private bool IsStaff =>
            User.IsInRole("Admin") || User.IsInRole("Manager") || User.IsInRole("Staff");
    }
}
