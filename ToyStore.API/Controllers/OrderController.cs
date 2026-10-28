using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System;
using System.Security.Claims;
using System.Threading.Tasks;
using ToyStoreManagement.Application.DTOs.Order;
using ToyStoreManagement.Application.Interfaces.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using ToyStoreManagement.API.Hubs;
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
        private readonly IHubContext<OrderTrackingHub> _orderTrackingHub;

        public OrderController(
            IOrderService orderService,
            ApplicationDbContext context,
            IHubContext<OrderTrackingHub> orderTrackingHub)
        {
            _orderService = orderService;
            _context = context;
            _orderTrackingHub = orderTrackingHub;
        }

        // GET: api/Order
        [HttpGet]
        [Authorize(Policy = "StaffAccess")]
        public async Task<IActionResult> GetAll(
            [FromQuery] string? statusCategory,
            [FromQuery] int? status,
            [FromQuery] string? search)
        {
            var orders = (await _orderService.GetAllAsync()).AsEnumerable();

            if (status.HasValue)
            {
                orders = orders.Where(o => o.Status == status.Value);
            }
            else if (!string.IsNullOrWhiteSpace(statusCategory))
            {
                var cat = statusCategory.Trim().ToLowerInvariant();
                if (cat == "processing" || cat == "active")
                {
                    orders = orders.Where(o => o.Status >= 0 && o.Status <= 3);
                }
                else if (cat == "history")
                {
                    orders = orders.Where(o => o.Status == 4 || o.Status == 5);
                }
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim();
                orders = orders.Where(o =>
                    (o.OrderCode != null && o.OrderCode.Contains(s, StringComparison.OrdinalIgnoreCase)) ||
                    (o.CustomerName != null && o.CustomerName.Contains(s, StringComparison.OrdinalIgnoreCase)) ||
                    (o.PhoneNumber != null && o.PhoneNumber.Contains(s, StringComparison.OrdinalIgnoreCase)) ||
                    (o.Shipping?.DeliveryBatchCode != null && o.Shipping.DeliveryBatchCode.Contains(s, StringComparison.OrdinalIgnoreCase)) ||
                    (o.Shipping?.TrackingCode != null && o.Shipping.TrackingCode.Contains(s, StringComparison.OrdinalIgnoreCase))
                );
            }

            return Ok(orders.ToList());
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

        // GET: api/Order/5/tracking-logs
        [HttpGet("{orderId}/tracking-logs")]
        public async Task<IActionResult> GetTrackingLogs(int orderId)
        {
            var order = await _orderService.GetByIdAsync(orderId);
            if (order == null)
                return NotFound("Không tìm thấy đơn hàng.");
            if (!IsStaff && !User.IsInRole("Shipper") && order.CustomerId != await GetCurrentCustomerId())
                return Forbid();

            var logs = await _context.OrderTrackingLogs
                .AsNoTracking()
                .Where(l => l.OrderId == orderId)
                .OrderBy(l => l.CreatedAt)
                .Select(l => new OrderTrackingLogDto
                {
                    TrackingLogId = l.TrackingLogId,
                    OrderId = l.OrderId,
                    ShippingId = l.ShippingId,
                    Action = l.Action,
                    PreviousStatus = l.PreviousStatus,
                    NewStatus = l.NewStatus,
                    PerformedByUserId = l.PerformedByUserId,
                    PerformedByName = l.PerformedByName,
                    PerformedByRole = l.PerformedByRole,
                    Note = l.Note,
                    CreatedAt = l.CreatedAt
                })
                .ToListAsync();

            return Ok(logs);
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

                // Báo ngay cho các shipper đang trực tuyến để đơn mới không bị bỏ sót.
                // Thông báo này không tiết lộ địa chỉ hay số điện thoại của khách.
                await _orderTrackingHub.Clients.Group(OrderTrackingHub.ShipperBroadcastGroup)
                    .SendAsync("ReceiveNewOrderCreated", new
                    {
                        orderId = result.OrderId,
                        orderCode = result.OrderCode,
                        totalAmount = result.TotalAmount,
                        createdAt = result.CreatedAt,
                        message = $"Đơn #{result.OrderCode} vừa phát sinh và đang chờ điều phối."
                    });

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
                if (dto.Status == 4)
                {
                    var shippingStatus = await _context.Shippings
                        .Where(x => x.OrderId == orderId)
                        .Select(x => (int?)x.Status)
                        .FirstOrDefaultAsync();
                    if (shippingStatus != 4)
                    {
                        return BadRequest(new { message = "Chỉ được hoàn tất đơn khi Shipper đã xác nhận giao hàng thành công." });
                    }
                }

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

        [HttpPost("{orderId}/cancel")]
        [Authorize(Policy = "CustomerAccess")]
        public async Task<IActionResult> CancelByCustomer(int orderId)
        {
            var customerId = await GetCurrentCustomerId();
            if (!customerId.HasValue)
                return NotFound(new { message = "Bạn chưa tạo hồ sơ khách hàng." });

            try
            {
                var result = await _orderService.CancelByCustomerAsync(orderId, customerId.Value);
                if (result == null)
                    return NotFound(new { message = "Không tìm thấy đơn hàng." });

                return Ok(new
                {
                    message = result.Payment?.Status == 1
                        ? "Đã hủy đơn hàng trước khi shipper lấy hàng. Vì đơn đã thanh toán trước, vui lòng liên hệ cửa hàng để được đối soát hoàn tiền. Đây không phải yêu cầu trả hàng."
                        : "Đã hủy đơn hàng trước khi shipper lấy hàng. Đây không phải yêu cầu trả hàng.",
                    order = result
                });
            }
            catch (UnauthorizedAccessException)
            {
                return Forbid();
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { message = ex.Message });
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
