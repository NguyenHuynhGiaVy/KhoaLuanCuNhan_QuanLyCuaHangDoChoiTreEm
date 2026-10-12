using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System;
using System.Security.Claims;
using System.Threading.Tasks;
using ToyStoreManagement.Application.DTOs.Order;
using ToyStoreManagement.Application.Interfaces.Services;
using Microsoft.EntityFrameworkCore;
using ToyStoreManagement.Infrastructure.Data;

namespace ToyStoreManagement.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class OrderController : ControllerBase
    {
        private readonly IOrderService _orderService;
        private readonly ApplicationDbContext _context;

        public OrderController(IOrderService orderService, ApplicationDbContext context)
        {
            _orderService = orderService;
            _context = context;
        }

        // GET: api/Order
        [HttpGet]
        [Authorize(Policy = "StaffAccess")]
        public async Task<IActionResult> GetAll()
        {
            var result = await _orderService.GetAllAsync();
            return Ok(result);
        }

        // GET: api/Order/5
        [HttpGet("{orderId}")]
        public async Task<IActionResult> GetById(int orderId)
        {
            var result = await _orderService.GetByIdAsync(orderId);

            if (result == null)
                return NotFound("Không tìm thấy đơn hàng.");
            if (!IsStaff && result.CustomerId != await GetCurrentCustomerId())
                return Forbid();

            return Ok(result);
        }

        // GET: api/Order/code/ORD-20260911203000123
        [HttpGet("code/{orderCode}")]
        public async Task<IActionResult> GetByOrderCode(
            string orderCode)
        {
            var result =
                await _orderService.GetByOrderCodeAsync(orderCode);

            if (result == null)
                return NotFound("Không tìm thấy đơn hàng.");
            if (!IsStaff && result.CustomerId != await GetCurrentCustomerId())
                return Forbid();

            return Ok(result);
        }

        // GET: api/Order/customer/5
        [HttpGet("customer/{customerId}")]
        public async Task<IActionResult> GetByCustomerId(
            int customerId)
        {
            if (!IsStaff && await GetCurrentCustomerId() != customerId)
                return Forbid();
            var result =
                await _orderService.GetByCustomerIdAsync(customerId);

            return Ok(result);
        }

        [HttpGet("mine")]
        [Authorize(Policy = "CustomerAccess")]
        public async Task<IActionResult> GetMine()
        {
            var customerId = await GetCurrentCustomerId();
            if (!customerId.HasValue)
                return NotFound(new { message = "Bạn chưa tạo hồ sơ khách hàng." });
            return Ok(await _orderService.GetByCustomerIdAsync(customerId.Value));
        }

        // POST: api/Order
        [HttpPost]
        [Authorize(Policy = "CustomerAccess")]
        public async Task<IActionResult> Create(
            [FromBody] CreateOrderDto dto)
        {
            try
            {
                var customerId = await GetCurrentCustomerId();
                if (!customerId.HasValue)
                    return BadRequest(new { message = "Vui lòng hoàn thiện hồ sơ khách hàng trước khi đặt hàng." });

                // Không tin CustomerId từ trình duyệt: máy chủ luôn lấy hồ sơ của
                // chính tài khoản đang đăng nhập để tránh tạo đơn nhầm khách hàng.
                dto.CustomerId = customerId.Value;
                var result =
                    await _orderService.CreateAsync(dto);

                return Ok(result);
            }
            catch (Exception ex)
            {
                var msg = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
                return BadRequest(new { message = msg });
            }
        }

        // PUT: api/Order/5
        [HttpPut("{orderId}")]
        [Authorize(Policy = "StaffAccess")]
        public async Task<IActionResult> Update(
            int orderId,
            [FromBody] UpdateOrderDto dto)
        {
            try
            {
                var result =
                    await _orderService.UpdateAsync(
                        orderId,
                        dto);

                if (result == null)
                    return NotFound("Không tìm thấy đơn hàng.");

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // DELETE: api/Order/5
        [HttpDelete("{orderId}")]
        [Authorize(Policy = "AdminOrManager")]
        public async Task<IActionResult> Delete(int orderId)
        {
            try
            {
                var result =
                    await _orderService.DeleteAsync(orderId);

                if (!result)
                    return NotFound("Không tìm thấy đơn hàng.");

                return Ok(new
                {
                    message = "Xóa đơn hàng thành công."
                });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // GET: api/Order/5/payment
        [HttpGet("{orderId}/payment")]
        public async Task<IActionResult> GetPayment(int orderId)
        {
            if (!await CanAccessOrderAsync(orderId))
                return Forbid();

            var result =
                await _orderService.GetPaymentAsync(orderId);

            if (result == null)
                return NotFound(
                    "Đơn hàng chưa có thông tin thanh toán.");

            return Ok(result);
        }

        // POST: api/Order/5/payment
        [HttpPost("{orderId}/payment")]
        [Authorize(Policy = "StaffAccess")]
        public async Task<IActionResult> AddPayment(
            int orderId,
            [FromBody] CreatePaymentDto dto)
        {
            try
            {
                var result =
                    await _orderService.AddPaymentAsync(
                        orderId,
                        dto);

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // GET: api/Order/5/shipping
        [HttpGet("{orderId}/shipping")]
        public async Task<IActionResult> GetShipping(int orderId)
        {
            if (!await CanAccessOrderAsync(orderId))
                return Forbid();

            var result =
                await _orderService.GetShippingAsync(orderId);

            if (result == null)
                return NotFound(
                    "Đơn hàng chưa có thông tin giao hàng.");

            return Ok(result);
        }

        // POST: api/Order/5/shipping
        [HttpPost("{orderId}/shipping")]
        [Authorize(Policy = "StaffAccess")]
        public async Task<IActionResult> AddShipping(
            int orderId,
            [FromBody] CreateShippingDto dto)
        {
            try
            {
                var result =
                    await _orderService.AddShippingAsync(
                        orderId,
                        dto);

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // POST: api/Order/5/complete-delivery
        [HttpPost("{orderId}/complete-delivery")]
        public async Task<IActionResult> CompleteDelivery(int orderId)
        {
            if (!await CanAccessOrderAsync(orderId))
                return Forbid();

            var order = await _orderService.GetByIdAsync(orderId);
            if (order == null)
                return NotFound("Không tìm thấy đơn hàng.");

            if (order.Status == 4)
                return Ok(new { message = "Đơn hàng đã ở trạng thái hoàn tất." });

            if (order.Status == 5)
                return BadRequest(new { message = "Không thể hoàn tất đơn hàng đã hủy." });

            try
            {
                var updateDto = new UpdateOrderDto
                {
                    Status = 4 // Hoàn tất
                };
                var updated = await _orderService.UpdateAsync(orderId, updateDto);
                return Ok(new { message = "Xác nhận nhận hàng và hoàn tất đơn hàng thành công!", order = updated });
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

        private async Task<bool> CanAccessOrderAsync(int orderId)
        {
            if (IsStaff)
                return true;

            var customerId = await GetCurrentCustomerId();
            if (!customerId.HasValue)
                return false;

            var order = await _orderService.GetByIdAsync(orderId);
            return order?.CustomerId == customerId.Value;
        }
    }
}
