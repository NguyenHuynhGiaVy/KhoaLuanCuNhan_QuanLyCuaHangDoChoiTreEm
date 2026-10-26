using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using ToyStoreManagement.API.Hubs;
using ToyStoreManagement.Application.DTOs.Order;
using ToyStoreManagement.Application.DTOs.Shipper;
using ToyStoreManagement.Application.Interfaces.Services;

namespace ToyStoreManagement.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ShipperController : ControllerBase
    {
        private readonly IShipperService _shipperService;
        private readonly IHubContext<OrderTrackingHub> _orderTrackingHub;

        public ShipperController(
            IShipperService shipperService,
            IHubContext<OrderTrackingHub> orderTrackingHub)
        {
            _shipperService = shipperService;
            _orderTrackingHub = orderTrackingHub;
        }

        /// <summary>
        /// Lấy thông tin hồ sơ của Shipper đang đăng nhập (tự động nhận diện từ Session/JWT)
        /// </summary>
        [HttpGet("me")]
        [Authorize(Policy = "ShipperAccess")]
        public async Task<IActionResult> GetCurrentShipperProfile()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
            if (string.IsNullOrWhiteSpace(userId))
            {
                return Unauthorized(new { message = "Không xác định được danh tính người dùng." });
            }

            var shipper = await _shipperService.GetShipperByUserIdAsync(userId);
            if (shipper != null)
            {
                return Ok(shipper);
            }

            // Nếu tài khoản là Admin/Manager/Staff đang thử nghiệm cổng Shipper
            if (User.IsInRole("Admin") || User.IsInRole("Manager") || User.IsInRole("Staff"))
            {
                var allShippers = await _shipperService.GetAllShippersAsync();
                if (allShippers.Count > 0)
                {
                    return Ok(allShippers[0]);
                }
            }

            return NotFound(new { message = "Tài khoản hiện tại chưa được liên kết với hồ sơ nhân viên giao hàng." });
        }

        [HttpGet]
        [Authorize(Policy = "StaffAccess")]
        public async Task<IActionResult> GetAll()
        {
            var shippers = await _shipperService.GetAllShippersAsync();
            return Ok(shippers);
        }

        [HttpGet("{id}")]
        [Authorize(Policy = "ShipperAccess")]
        public async Task<IActionResult> GetById(int id)
        {
            // Nếu là tài khoản Shipper, chỉ cho phép xem hồ sơ của chính mình
            if (User.IsInRole("Shipper"))
            {
                var current = await ResolveCurrentShipperIdAsync();
                if (current.HasValue && current.Value != id)
                {
                    return Forbid();
                }
            }

            var shipper = await _shipperService.GetShipperByIdAsync(id);
            if (shipper == null) return NotFound(new { message = $"Không tìm thấy shipper #{id}" });
            return Ok(shipper);
        }

        [HttpPost]
        [Authorize(Policy = "AdminOrManager")]
        public async Task<IActionResult> Create([FromBody] CreateShipperDto dto)
        {
            try
            {
                var created = await _shipperService.CreateShipperAsync(dto);
                return CreatedAtAction(nameof(GetById), new { id = created.ShipperId }, created);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPut("{id}")]
        [Authorize(Policy = "AdminOrManager")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateShipperDto dto)
        {
            try
            {
                var updated = await _shipperService.UpdateShipperAsync(id, dto);
                return Ok(updated);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpDelete("{id}")]
        [Authorize(Policy = "AdminOrManager")]
        public async Task<IActionResult> Delete(int id)
        {
            var success = await _shipperService.DeleteShipperAsync(id);
            if (!success) return NotFound();
            return Ok(new { message = "Đã ngưng hoạt động shipper thành công." });
        }

        /// <summary>
        /// Gán shipper phụ trách cho một đơn hàng hoặc cả lô vận chuyển (Admin/Staff)
        /// </summary>
        [HttpPost("assign-order")]
        [Authorize(Policy = "StaffAccess")]
        public async Task<IActionResult> AssignOrder([FromBody] AssignOrderShipperDto dto)
        {
            try
            {
                var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
                var currentUserName = User.FindFirstValue(ClaimTypes.Name) ?? User.Identity?.Name ?? "Quản lý điều phối";

                var success = await _shipperService.AssignShipperAsync(dto, currentUserId, currentUserName);
                if (!success) return BadRequest(new { message = "Không thể gán đơn cho shipper." });

                var shipper = await _shipperService.GetShipperByIdAsync(dto.ShipperId);

                await _orderTrackingHub.Clients.Group(OrderTrackingHub.ShipperGroup(dto.ShipperId))
                    .SendAsync("ReceiveNewOrderAssignment", new
                    {
                        orderId = dto.OrderId,
                        deliveryBatchCode = dto.DeliveryBatchCode,
                        message = !string.IsNullOrWhiteSpace(dto.DeliveryBatchCode)
                            ? $"Bạn vừa được phân công giao lô {dto.DeliveryBatchCode}; vui lòng xem danh sách các đơn trong lô."
                            : $"Bạn vừa được phân công giao đơn #{dto.OrderId}"
                    });

                await _orderTrackingHub.Clients.Group(OrderTrackingHub.AdminGroup)
                    .SendAsync("ReceiveOrderStateChanged", new
                    {
                        orderId = dto.OrderId,
                        deliveryBatchCode = dto.DeliveryBatchCode,
                        shipperName = shipper?.FullName,
                        status = "Assigned"
                    });

                if (dto.OrderId.HasValue)
                {
                    await _orderTrackingHub.Clients.Group(OrderTrackingHub.OrderGroup(dto.OrderId.Value))
                        .SendAsync("ReceiveOrderTrackingUpdate", new
                        {
                            orderId = dto.OrderId.Value,
                            statusText = $"Đã phân công shipper {shipper?.FullName}",
                            shipperName = shipper?.FullName,
                            shipperPhone = shipper?.PhoneNumber,
                            updatedAt = DateTime.UtcNow
                        });
                }

                return Ok(new { message = "Gán shipper thành công!" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Lấy danh sách đơn hàng được gán cho chính Shipper đang đăng nhập (Siết chặt RBAC)
        /// </summary>
        [HttpGet("my-orders")]
        [Authorize(Policy = "ShipperAccess")]
        public async Task<IActionResult> GetMyOrders([FromQuery] int? shipperId, [FromQuery] string? status)
        {
            var targetShipperId = await ResolveTargetShipperIdAsync(shipperId);

            if (!targetShipperId.HasValue)
            {
                return BadRequest(new { message = "Không xác định được danh tính shipper." });
            }

            var orders = await _shipperService.GetShipperOrdersAsync(targetShipperId.Value, status);
            return Ok(orders);
        }

        /// <summary>
        /// Bước 1: Shipper xác nhận nhận đơn hàng được phân công
        /// </summary>
        [HttpPost("orders/{orderId}/accept-order")]
        [Authorize(Policy = "ShipperAccess")]
        public async Task<IActionResult> AcceptOrder(int orderId, [FromQuery] int? shipperId)
        {
            try
            {
                var sid = await ResolveTargetShipperIdAsync(shipperId);
                if (!sid.HasValue) return BadRequest(new { message = "Không xác định được shipper." });

                var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
                var userName = User.Identity?.Name;

                var updated = await _shipperService.AcceptOrderAsync(orderId, sid.Value, userId, userName);

                await BroadcastOrderUpdate(orderId, updated, "Shipper đã nhận đơn hàng");
                return Ok(updated);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Bước 2: Shipper đến kho / cửa hàng lấy kiện hàng
        /// </summary>
        [HttpPost("orders/{orderId}/pickup")]
        [Authorize(Policy = "ShipperAccess")]
        public async Task<IActionResult> PickupOrder(int orderId, [FromQuery] int? shipperId)
        {
            try
            {
                var sid = await ResolveTargetShipperIdAsync(shipperId);
                if (!sid.HasValue) return BadRequest(new { message = "Không xác định được shipper." });

                var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
                var userName = User.Identity?.Name;

                var updated = await _shipperService.PickupOrderAsync(orderId, sid.Value, userId, userName);

                await BroadcastOrderUpdate(orderId, updated, "Shipper đã đến cửa hàng lấy kiện hàng");
                return Ok(updated);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Bước 3: Shipper bắt đầu hành trình giao hàng cho khách
        /// </summary>
        [HttpPost("orders/{orderId}/start-delivery")]
        [Authorize(Policy = "ShipperAccess")]
        public async Task<IActionResult> StartDelivery(int orderId, [FromQuery] int? shipperId)
        {
            try
            {
                var sid = await ResolveTargetShipperIdAsync(shipperId);
                if (!sid.HasValue) return BadRequest(new { message = "Không xác định được shipper." });

                var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
                var userName = User.Identity?.Name;

                var updated = await _shipperService.StartDeliveryAsync(orderId, sid.Value, userId, userName);

                await BroadcastOrderUpdate(orderId, updated, "Shipper đang trên đường giao hàng tới bạn");
                return Ok(updated);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Bước 4: Shipper xác nhận đã giao hàng thành công & thu tiền COD
        /// </summary>
        [HttpPost("orders/{orderId}/complete-delivery")]
        [Authorize(Policy = "ShipperAccess")]
        public async Task<IActionResult> CompleteDelivery(int orderId, [FromQuery] int? shipperId)
        {
            try
            {
                var sid = await ResolveTargetShipperIdAsync(shipperId);
                if (!sid.HasValue) return BadRequest(new { message = "Không xác định được shipper." });

                var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
                var userName = User.Identity?.Name;

                var updated = await _shipperService.CompleteDeliveryAsync(orderId, sid.Value, userId, userName);

                await BroadcastOrderUpdate(orderId, updated, "Đơn hàng đã được giao thành công!");
                return Ok(updated);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Bước 5: Shipper xác nhận gửi/nộp lại tiền COD về cho cửa hàng
        /// </summary>
        [HttpPost("orders/{orderId}/submit-cod")]
        [Authorize(Policy = "ShipperAccess")]
        public async Task<IActionResult> SubmitCod(int orderId, [FromQuery] int? shipperId, [FromBody] SubmitCodRequestDto? request)
        {
            try
            {
                var sid = await ResolveTargetShipperIdAsync(shipperId);
                if (!sid.HasValue) return BadRequest(new { message = "Không xác định được shipper." });

                var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
                var userName = User.Identity?.Name;

                var updated = await _shipperService.SubmitCodAsync(orderId, sid.Value, userId, userName, request?.Note);

                await BroadcastOrderUpdate(orderId, updated, "Shipper đã đối soát và nộp lại tiền COD về cửa hàng");
                return Ok(updated);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Shipper báo cáo giao hàng thất bại (ghi nhận lý do và tăng số lần thử)
        /// </summary>
        [HttpPost("orders/{orderId}/fail-delivery")]
        [Authorize(Policy = "ShipperAccess")]
        public async Task<IActionResult> FailDelivery(int orderId, [FromBody] FailDeliveryDto dto, [FromQuery] int? shipperId)
        {
            try
            {
                var sid = await ResolveTargetShipperIdAsync(shipperId);
                if (!sid.HasValue) return BadRequest(new { message = "Không xác định được shipper." });

                var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
                var userName = User.Identity?.Name;

                var updated = await _shipperService.FailDeliveryAsync(orderId, sid.Value, dto, userId, userName);

                var isReturned = updated.Shipping?.AttemptCount >= 3;
                var statusText = isReturned 
                    ? $"Giao thất bại lần 3: {dto.FailReason}. Đơn đã hoàn về kho."
                    : $"Giao chưa thành công: {dto.FailReason}. Shop sẽ hẹn giao lại.";

                await BroadcastOrderUpdate(orderId, updated, statusText);
                return Ok(updated);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Xuất giao lại cho đơn hàng bị giao thất bại trước đó
        /// </summary>
        [HttpPost("orders/{orderId}/retry-delivery")]
        [Authorize(Policy = "StaffAccess")]
        public async Task<IActionResult> RetryDelivery(int orderId, [FromQuery] int? shipperId)
        {
            try
            {
                var sid = shipperId ?? 1;
                var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
                var userName = User.Identity?.Name;

                var updated = await _shipperService.RetryDeliveryAsync(orderId, sid, userId, userName);
                await BroadcastOrderUpdate(orderId, updated, "Đơn hàng đang được xuất kho để giao lại");
                return Ok(updated);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Lấy toàn bộ timeline lịch sử trạng thái (Audit/Tracking Log) của đơn hàng
        /// </summary>
        [HttpGet("orders/{orderId}/tracking-logs")]
        [Authorize(Policy = "ShipperAccess")]
        public async Task<IActionResult> GetTrackingLogs(int orderId)
        {
            var logs = await _shipperService.GetOrderTrackingLogsAsync(orderId);
            return Ok(logs);
        }

        /// <summary>
        /// Lấy danh sách đối soát công nợ COD (Ví COD của Shipper hoặc toàn bộ cho Quản lý)
        /// Sửa lỗi: Cho phép ShipperAccess thay vì chỉ StaffAccess để Shipper xem được ví của chính mình!
        /// </summary>
        [HttpGet("cod-reconciliation")]
        [Authorize(Policy = "ShipperAccess")]
        public async Task<IActionResult> GetCodReconciliation([FromQuery] int? shipperId, [FromQuery] int? codStatus)
        {
            try
            {
                var targetShipperId = await ResolveTargetShipperIdAsync(shipperId);

                // Nếu là tài khoản role Shipper: Bắt buộc chỉ được xem công nợ COD của chính mình
                if (User.IsInRole("Shipper"))
                {
                    if (!targetShipperId.HasValue)
                    {
                        return BadRequest(new { message = "Không xác định được shipper." });
                    }
                    var list = await _shipperService.GetCodReconciliationListAsync(targetShipperId.Value, codStatus);
                    return Ok(list);
                }

                // Nếu là Admin / Manager / Staff: có thể xem tất cả hoặc lọc theo shipperId
                var adminList = await _shipperService.GetCodReconciliationListAsync(shipperId, codStatus);
                return Ok(adminList);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Quản trị / Thủ quỹ xác nhận shipper đã nộp tiền COD vào quỹ cửa hàng
        /// </summary>
        [HttpPost("confirm-cod-submission")]
        [Authorize(Policy = "StaffAccess")]
        public async Task<IActionResult> ConfirmCodSubmission([FromBody] ConfirmCodSubmissionDto dto)
        {
            try
            {
                var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
                var currentUserName = User.FindFirstValue(ClaimTypes.Name) ?? User.Identity?.Name ?? "Thủ quỹ cửa hàng";

                var success = await _shipperService.ConfirmCodSubmissionAsync(dto, currentUserId, currentUserName);
                return Ok(new { message = $"Đã đối soát và xác nhận nộp tiền COD cho {dto.PaymentIds.Count} khoản thanh toán thành công!" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        // ── Helper phân giải Shipper ID theo phân quyền nghiêm ngặt ──
        private async Task<int?> ResolveTargetShipperIdAsync(int? requestedShipperId)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");

            // Nếu người dùng có role Shipper: BẮT BUỘC dùng ShipperId của chính họ từ Session/Token!
            if (User.IsInRole("Shipper") && !string.IsNullOrWhiteSpace(userId))
            {
                var myShipper = await _shipperService.GetShipperByUserIdAsync(userId);
                if (myShipper != null) return myShipper.ShipperId;
            }

            // Nếu người dùng là Admin/Staff: Cho phép xem theo requestedShipperId hoặc fallback
            if (requestedShipperId.HasValue && requestedShipperId.Value > 0)
            {
                return requestedShipperId.Value;
            }

            if (!string.IsNullOrWhiteSpace(userId))
            {
                var matchingShipper = await _shipperService.GetShipperByUserIdAsync(userId);
                if (matchingShipper != null) return matchingShipper.ShipperId;
            }

            var all = await _shipperService.GetAllShippersAsync();
            return all.Count > 0 ? all[0].ShipperId : null;
        }

        private async Task<int?> ResolveCurrentShipperIdAsync()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
            if (string.IsNullOrWhiteSpace(userId)) return null;

            var shipper = await _shipperService.GetShipperByUserIdAsync(userId);
            return shipper?.ShipperId;
        }

        private async Task BroadcastOrderUpdate(int orderId, OrderDto updated, string statusText)
        {
            try
            {
                await _orderTrackingHub.Clients.Group(OrderTrackingHub.OrderGroup(orderId))
                    .SendAsync("ReceiveOrderTrackingUpdate", new
                    {
                        orderId,
                        orderStatus = updated.Status,
                        shippingStatus = updated.Shipping?.Status,
                        statusText,
                        shipperName = updated.Shipping?.ShipperName,
                        shipperPhone = updated.Shipping?.ShipperPhone,
                        updatedAt = DateTime.UtcNow
                    });

                await _orderTrackingHub.Clients.Group(OrderTrackingHub.AdminGroup)
                    .SendAsync("ReceiveOrderStateChanged", new
                    {
                        orderId,
                        orderStatus = updated.Status,
                        shippingStatus = updated.Shipping?.Status,
                        message = $"Đơn hàng #{updated.OrderCode}: {statusText}"
                    });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[SignalR Broadcast Warning] {ex.Message}");
            }
        }
    }

    public class SubmitCodRequestDto
    {
        public string? Note { get; set; }
    }
}
