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

        [HttpGet]
        [Authorize(Policy = "StaffAccess")]
        public async Task<IActionResult> GetAll()
        {
            var shippers = await _shipperService.GetAllShippersAsync();
            return Ok(shippers);
        }

        [HttpGet("{id}")]
        [Authorize(Policy = "StaffAccess")]
        public async Task<IActionResult> GetById(int id)
        {
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
        /// Gán shipper phụ trách cho một đơn hàng hoặc cả lô vận chuyển
        /// </summary>
        [HttpPost("assign-order")]
        [Authorize(Policy = "StaffAccess")]
        public async Task<IActionResult> AssignOrder([FromBody] AssignOrderShipperDto dto)
        {
            try
            {
                var success = await _shipperService.AssignShipperAsync(dto);
                if (!success) return BadRequest(new { message = "Không thể gán đơn cho shipper." });

                var shipper = await _shipperService.GetShipperByIdAsync(dto.ShipperId);

                // Gửi thông báo realtime đến Shipper và Admin
                await _orderTrackingHub.Clients.Group(OrderTrackingHub.ShipperGroup(dto.ShipperId))
                    .SendAsync("ReceiveNewOrderAssignment", new
                    {
                        orderId = dto.OrderId,
                        deliveryBatchCode = dto.DeliveryBatchCode,
                        message = $"Bạn vừa được phân công giao đơn #{dto.OrderId ?? 0} (Lô {dto.DeliveryBatchCode ?? "—"})"
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
                            statusText = "Đã gán nhân viên giao hàng",
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
        /// Lấy danh sách đơn hàng được gán cho shipper đang đăng nhập (hoặc truyền shipperId nếu là quản trị)
        /// </summary>
        [HttpGet("my-orders")]
        [Authorize(Policy = "ShipperAccess")]
        public async Task<IActionResult> GetMyOrders([FromQuery] int? shipperId, [FromQuery] string? status)
        {
            var targetShipperId = shipperId;

            // Nếu không truyền shipperId -> Tìm shipper theo UserId đang đăng nhập
            if (!targetShipperId.HasValue || targetShipperId.Value <= 0)
            {
                var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
                var allShippers = await _shipperService.GetAllShippersAsync();
                var currentShipper = allShippers.Find(s => s.UserId == userId);
                if (currentShipper != null)
                {
                    targetShipperId = currentShipper.ShipperId;
                }
                else if (allShippers.Count > 0)
                {
                    // Fallback cho chế độ demo / testing: lấy shipper đầu tiên
                    targetShipperId = allShippers[0].ShipperId;
                }
            }

            if (!targetShipperId.HasValue)
            {
                return BadRequest(new { message = "Không xác định được danh tính shipper." });
            }

            var orders = await _shipperService.GetShipperOrdersAsync(targetShipperId.Value, status);
            return Ok(orders);
        }

        /// <summary>
        /// Shipper bắt đầu hành trình giao đơn hàng (chuyển sang Đang giao)
        /// </summary>
        [HttpPost("orders/{orderId}/start-delivery")]
        [Authorize(Policy = "ShipperAccess")]
        public async Task<IActionResult> StartDelivery(int orderId, [FromQuery] int? shipperId)
        {
            try
            {
                var sid = shipperId ?? 1;
                var updated = await _shipperService.StartDeliveryAsync(orderId, sid);

                // Broadcast realtime tới khách hàng và admin
                await _orderTrackingHub.Clients.Group(OrderTrackingHub.OrderGroup(orderId))
                    .SendAsync("ReceiveOrderTrackingUpdate", new
                    {
                        orderId,
                        orderStatus = 3,
                        shippingStatus = 1,
                        statusText = "Shipper đang trên đường giao kiện hàng tới bạn",
                        shipperName = updated.Shipping?.ShipperName,
                        shipperPhone = updated.Shipping?.ShipperPhone,
                        updatedAt = DateTime.UtcNow
                    });

                await _orderTrackingHub.Clients.Group(OrderTrackingHub.AdminGroup)
                    .SendAsync("ReceiveOrderStateChanged", new
                    {
                        orderId,
                        orderStatus = 3,
                        shippingStatus = 1,
                        message = $"Đơn hàng #{updated.OrderCode} đang được giao bởi {updated.Shipping?.ShipperName}"
                    });

                return Ok(updated);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Shipper xác nhận đã giao hàng thành công (thu COD nếu là đơn COD)
        /// </summary>
        [HttpPost("orders/{orderId}/complete-delivery")]
        [Authorize(Policy = "ShipperAccess")]
        public async Task<IActionResult> CompleteDelivery(int orderId, [FromQuery] int? shipperId)
        {
            try
            {
                var sid = shipperId ?? 1;
                var updated = await _shipperService.CompleteDeliveryAsync(orderId, sid);

                await _orderTrackingHub.Clients.Group(OrderTrackingHub.OrderGroup(orderId))
                    .SendAsync("ReceiveOrderTrackingUpdate", new
                    {
                        orderId,
                        orderStatus = 4,
                        shippingStatus = 2,
                        statusText = "Đơn hàng đã được giao thành công!",
                        updatedAt = DateTime.UtcNow
                    });

                await _orderTrackingHub.Clients.Group(OrderTrackingHub.AdminGroup)
                    .SendAsync("ReceiveOrderStateChanged", new
                    {
                        orderId,
                        orderStatus = 4,
                        shippingStatus = 2,
                        message = $"Đơn hàng #{updated.OrderCode} đã giao thành công!"
                    });

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
                var sid = shipperId ?? 1;
                var updated = await _shipperService.FailDeliveryAsync(orderId, sid, dto);

                var isReturned = updated.Shipping?.AttemptCount >= 3;
                var statusText = isReturned 
                    ? $"Giao thất bại lần 3: {dto.FailReason}. Đơn đã hoàn về kho."
                    : $"Giao chưa thành công: {dto.FailReason}. Shop sẽ liên hệ và giao lại.";

                await _orderTrackingHub.Clients.Group(OrderTrackingHub.OrderGroup(orderId))
                    .SendAsync("ReceiveOrderTrackingUpdate", new
                    {
                        orderId,
                        orderStatus = updated.Status,
                        shippingStatus = updated.Shipping?.Status,
                        statusText,
                        failReason = dto.FailReason,
                        attemptCount = updated.Shipping?.AttemptCount ?? 1,
                        updatedAt = DateTime.UtcNow
                    });

                await _orderTrackingHub.Clients.Group(OrderTrackingHub.AdminGroup)
                    .SendAsync("ReceiveOrderStateChanged", new
                    {
                        orderId,
                        orderStatus = updated.Status,
                        shippingStatus = updated.Shipping?.Status,
                        message = $"Đơn hàng #{updated.OrderCode} giao thất bại (Lần {updated.Shipping?.AttemptCount}): {dto.FailReason}"
                    });

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
                var updated = await _shipperService.RetryDeliveryAsync(orderId, sid);
                return Ok(updated);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Lấy danh sách đối soát công nợ COD (tiền shipper đang giữ / đã nộp)
        /// </summary>
        [HttpGet("cod-reconciliation")]
        [Authorize(Policy = "StaffAccess")]
        public async Task<IActionResult> GetCodReconciliation([FromQuery] int? shipperId, [FromQuery] int? codStatus)
        {
            try
            {
                var list = await _shipperService.GetCodReconciliationListAsync(shipperId, codStatus);
                return Ok(list);
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
                var success = await _shipperService.ConfirmCodSubmissionAsync(dto);
                return Ok(new { message = $"Đã đối soát và xác nhận nộp tiền COD cho {dto.PaymentIds.Count} khoản thanh toán thành công!" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }
    }
}
