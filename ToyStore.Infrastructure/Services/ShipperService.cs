using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ToyStore.Application.Interfaces.Services;
using ToyStore.Domain.Identity;
using ToyStoreManagement.Application.DTOs.Order;
using ToyStoreManagement.Application.DTOs.Shipper;
using ToyStoreManagement.Application.Interfaces.Services;
using ToyStoreManagement.Domain.Entities;
using ToyStoreManagement.Infrastructure.Data;

namespace ToyStoreManagement.Infrastructure.Services
{
    public class ShipperService : IShipperService
    {
        private readonly ApplicationDbContext _context;
        private readonly IOrderService _orderService;
        private readonly UserManager<ApplicationUser> _userManager;

        public ShipperService(
            ApplicationDbContext context,
            IOrderService orderService,
            UserManager<ApplicationUser> userManager)
        {
            _context = context;
            _orderService = orderService;
            _userManager = userManager;
        }

        public async Task<List<ShipperDto>> GetAllShippersAsync()
        {
            var shippers = await _context.Shippers
                .AsNoTracking()
                .Include(s => s.Shippings)
                .OrderByDescending(s => s.IsActive)
                .ThenBy(s => s.FullName)
                .ToListAsync();

            // Tối ưu N+1: Truy vấn tổng tiền COD đang giữ trong 1 query duy nhất
            var pendingCodMap = await (from p in _context.Payments
                                       join s in _context.Shippings on p.OrderId equals s.OrderId
                                       where p.PaymentMethod == 0 && p.CodStatus == 1 && s.ShipperId != null
                                       group p by s.ShipperId.Value into g
                                       select new { ShipperId = g.Key, Total = g.Sum(x => x.Amount) })
                                       .ToDictionaryAsync(x => x.ShipperId, x => x.Total);

            var result = new List<ShipperDto>();
            foreach (var s in shippers)
            {
                // active orders: status 0 (chờ), 1 (đã nhận đơn), 2 (đã lấy hàng), 3 (đang giao), 4 (giao lại)
                var activeOrders = s.Shippings.Count(sh => sh.Status == 0 || sh.Status == 1 || sh.Status == 2 || sh.Status == 3 || sh.Status == 4);
                // completed: status 4 (hoàn tất giao) hoặc 2 theo chuẩn cũ
                var completedOrders = s.Shippings.Count(sh => sh.Status == 2 || sh.Status == 4);
                var pendingCod = pendingCodMap.GetValueOrDefault(s.ShipperId, 0);

                result.Add(new ShipperDto
                {
                    ShipperId = s.ShipperId,
                    UserId = s.UserId,
                    FullName = s.FullName,
                    PhoneNumber = s.PhoneNumber,
                    VehicleNumber = s.VehicleNumber,
                    AssignedArea = s.AssignedArea,
                    IsActive = s.IsActive,
                    CreatedAt = s.CreatedAt,
                    ActiveOrdersCount = activeOrders,
                    CompletedOrdersCount = completedOrders,
                    PendingCodAmount = pendingCod
                });
            }

            return result;
        }

        public async Task<ShipperDto?> GetShipperByIdAsync(int id)
        {
            var s = await _context.Shippers
                .AsNoTracking()
                .Include(x => x.Shippings)
                .FirstOrDefaultAsync(x => x.ShipperId == id);

            if (s == null) return null;

            var activeOrders = s.Shippings.Count(sh => sh.Status == 0 || sh.Status == 1 || sh.Status == 2 || sh.Status == 3 || sh.Status == 4);
            var completedOrders = s.Shippings.Count(sh => sh.Status == 2 || sh.Status == 4);
            
            var orderIds = s.Shippings.Select(sh => sh.OrderId).ToList();
            var pendingCod = await _context.Payments
                .Where(p => orderIds.Contains(p.OrderId) && p.CodStatus == 1)
                .SumAsync(p => p.Amount);

            return new ShipperDto
            {
                ShipperId = s.ShipperId,
                UserId = s.UserId,
                FullName = s.FullName,
                PhoneNumber = s.PhoneNumber,
                VehicleNumber = s.VehicleNumber,
                AssignedArea = s.AssignedArea,
                IsActive = s.IsActive,
                CreatedAt = s.CreatedAt,
                ActiveOrdersCount = activeOrders,
                CompletedOrdersCount = completedOrders,
                PendingCodAmount = pendingCod
            };
        }

        public async Task<ShipperDto?> GetShipperByUserIdAsync(string userId)
        {
            if (string.IsNullOrWhiteSpace(userId)) return null;

            var s = await _context.Shippers
                .FirstOrDefaultAsync(x => x.UserId == userId);

            if (s != null) return await GetShipperByIdAsync(s.ShipperId);

            // Fallback: Tìm user xem có số điện thoại hoặc email trùng không để auto link
            var user = await _userManager.FindByIdAsync(userId);
            if (user != null)
            {
                s = await _context.Shippers.FirstOrDefaultAsync(x => 
                    x.UserId == null && (x.PhoneNumber == user.PhoneNumber || x.FullName == user.FullName));
                if (s != null)
                {
                    s.UserId = userId;
                    await _context.SaveChangesAsync();
                    return await GetShipperByIdAsync(s.ShipperId);
                }
            }

            return null;
        }

        public async Task<ShipperDto> CreateShipperAsync(CreateShipperDto dto)
        {
            string? userId = null;

            if (!string.IsNullOrWhiteSpace(dto.Email) && !string.IsNullOrWhiteSpace(dto.Password))
            {
                var existingUser = await _userManager.FindByEmailAsync(dto.Email);
                if (existingUser != null)
                {
                    userId = existingUser.Id;
                }
                else
                {
                    var user = new ApplicationUser
                    {
                        UserName = dto.Email,
                        Email = dto.Email,
                        FullName = dto.FullName,
                        PhoneNumber = dto.PhoneNumber,
                        IsActive = true,
                        EmailConfirmed = true
                    };
                    var createRes = await _userManager.CreateAsync(user, dto.Password);
                    if (createRes.Succeeded)
                    {
                        await _userManager.AddToRoleAsync(user, "Shipper");
                        userId = user.Id;
                    }
                }
            }

            var shipper = new Shipper
            {
                UserId = userId,
                FullName = dto.FullName,
                PhoneNumber = dto.PhoneNumber,
                VehicleNumber = dto.VehicleNumber,
                AssignedArea = dto.AssignedArea,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            _context.Shippers.Add(shipper);
            await _context.SaveChangesAsync();

            return (await GetShipperByIdAsync(shipper.ShipperId))!;
        }

        public async Task<ShipperDto> UpdateShipperAsync(int id, UpdateShipperDto dto)
        {
            var s = await _context.Shippers.FindAsync(id);
            if (s == null) throw new KeyNotFoundException($"Không tìm thấy Shipper #{id}");

            s.FullName = dto.FullName;
            s.PhoneNumber = dto.PhoneNumber;
            s.VehicleNumber = dto.VehicleNumber;
            s.AssignedArea = dto.AssignedArea;
            s.IsActive = dto.IsActive;

            await _context.SaveChangesAsync();
            return (await GetShipperByIdAsync(id))!;
        }

        public async Task<bool> DeleteShipperAsync(int id)
        {
            var s = await _context.Shippers.FindAsync(id);
            if (s == null) return false;

            s.IsActive = false;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> AssignShipperAsync(AssignOrderShipperDto dto, string? performedByUserId = null, string? performedByName = null)
        {
            var shipper = await _context.Shippers.FindAsync(dto.ShipperId);
            if (shipper == null || !shipper.IsActive)
            {
                throw new InvalidOperationException("Shipper không tồn tại hoặc đã tạm dừng hoạt động.");
            }

            if (dto.OrderId.HasValue && dto.OrderId.Value > 0)
            {
                var shipping = await _context.Shippings.FirstOrDefaultAsync(s => s.OrderId == dto.OrderId.Value);
                if (shipping == null) throw new KeyNotFoundException($"Không tìm thấy thông tin giao hàng của đơn #{dto.OrderId.Value}");

                var prevStatus = shipping.Status == 0 ? "Chờ xuất kho" : $"Trạng thái {shipping.Status}";
                shipping.ShipperId = dto.ShipperId;
                shipping.Status = 1; // 1 = Đã nhận đơn / Đã gán

                await _context.SaveChangesAsync();

                // Lưu Audit Tracking Log
                await AddOrderTrackingLogAsync(
                    dto.OrderId.Value,
                    shipping.ShippingId,
                    "Phân công Shipper",
                    prevStatus,
                    $"Gán cho shipper: {shipper.FullName} ({shipper.PhoneNumber})",
                    performedByUserId,
                    performedByName ?? "Quản trị viên",
                    "Admin/Manager",
                    $"Phân công nhân viên {shipper.FullName} phụ trách giao hàng"
                );

                return true;
            }

            if (!string.IsNullOrWhiteSpace(dto.DeliveryBatchCode))
            {
                var shippings = await _context.Shippings
                    .Where(s => s.DeliveryBatchCode == dto.DeliveryBatchCode)
                    .ToListAsync();

                if (!shippings.Any())
                {
                    throw new KeyNotFoundException($"Không tìm thấy đơn hàng nào thuộc mã lô {dto.DeliveryBatchCode}");
                }

                foreach (var sh in shippings)
                {
                    sh.ShipperId = dto.ShipperId;
                    sh.Status = 1;
                    await AddOrderTrackingLogAsync(
                        sh.OrderId,
                        sh.ShippingId,
                        "Phân công Shipper theo Lô",
                        "Chờ xuất kho",
                        $"Gán theo lô {dto.DeliveryBatchCode} cho shipper {shipper.FullName}",
                        performedByUserId,
                        performedByName ?? "Quản trị viên",
                        "Admin/Manager",
                        $"Gán nguyên lô vận chuyển {dto.DeliveryBatchCode}"
                    );
                }
                await _context.SaveChangesAsync();
                return true;
            }

            throw new ArgumentException("Cần cung cấp OrderId hoặc DeliveryBatchCode để gán shipper.");
        }

        public async Task<List<OrderDto>> GetShipperOrdersAsync(int shipperId, string? status = null)
        {
            var query = _context.Orders
                .AsNoTracking()
                .Include(o => o.Customer)
                .Include(o => o.OrderDetails)
                    .ThenInclude(d => d.ProductVariant)
                        .ThenInclude(v => v.Product)
                .Include(o => o.OrderDetails)
                    .ThenInclude(d => d.ProductVariant)
                        .ThenInclude(v => v.VariantAttributes)
                .Include(o => o.Payment)
                .Include(o => o.Shipping)
                    .ThenInclude(s => s.Shipper)
                .Where(o => o.Shipping != null && o.Shipping.ShipperId == shipperId);

            if (status == "active")
            {
                // Bước 1, 2, 3 và giao lại (0, 1, 2, 3, 4)
                query = query.Where(o => o.Shipping.Status == 0 || o.Shipping.Status == 1 || o.Shipping.Status == 2 || o.Shipping.Status == 3 || o.Shipping.Status == 4);
            }
            else if (status == "completed")
            {
                // Bước 4: Đã giao thành công (status = 4 hoặc theo chuẩn cũ 2)
                query = query.Where(o => o.Shipping.Status == 2 || o.Shipping.Status == 4);
            }
            else if (status == "failed")
            {
                query = query.Where(o => o.Shipping.Status == 3 || o.Shipping.Status == 5);
            }

            var orders = await query.OrderByDescending(o => o.OrderDate).ToListAsync();

            // Tối ưu triệt để: Map DTO trực tiếp, KHÔNG gọi DB query trong vòng lặp
            return orders.Select(MapOrderToDtoFast).ToList();
        }

        // ── BƯỚC 1: SHIPPER NHẬN ĐƠN HÀNG ──────────────────────────────
        public async Task<OrderDto> AcceptOrderAsync(int orderId, int shipperId, string? userId = null, string? performerName = null, string? note = null)
        {
            var shipping = await _context.Shippings
                .Include(s => s.Order)
                .FirstOrDefaultAsync(s => s.OrderId == orderId);

            if (shipping == null) throw new KeyNotFoundException($"Không tìm thấy đơn hàng #{orderId}");

            var prev = GetShippingStatusText(shipping.Status);
            shipping.ShipperId = shipperId;
            shipping.Status = 1; // 1 = Đã nhận đơn
            await _context.SaveChangesAsync();

            var shipper = await _context.Shippers.FindAsync(shipperId);
            var name = performerName ?? shipper?.FullName ?? "Shipper";

            await AddOrderTrackingLogAsync(
                orderId,
                shipping.ShippingId,
                "Nhận đơn",
                prev,
                "Đã nhận đơn hàng",
                userId,
                name,
                "Shipper",
                note ?? "Shipper đã xác nhận tiếp nhận đơn hàng vào lịch trình"
            );

            return (await _orderService.GetByIdAsync(orderId))!;
        }

        // ── BƯỚC 2: ĐẾN CỬA HÀNG NHẬN HÀNG ──────────────────────────────
        public async Task<OrderDto> PickupOrderAsync(int orderId, int shipperId, string? userId = null, string? performerName = null, string? note = null)
        {
            var shipping = await _context.Shippings
                .Include(s => s.Order)
                .FirstOrDefaultAsync(s => s.OrderId == orderId);

            if (shipping == null) throw new KeyNotFoundException($"Không tìm thấy đơn hàng #{orderId}");

            var prev = GetShippingStatusText(shipping.Status);
            shipping.ShipperId = shipperId;
            shipping.Status = 2; // 2 = Đã đến cửa hàng nhận hàng / Đã lấy hàng
            await _context.SaveChangesAsync();

            var shipper = await _context.Shippers.FindAsync(shipperId);
            var name = performerName ?? shipper?.FullName ?? "Shipper";

            await AddOrderTrackingLogAsync(
                orderId,
                shipping.ShippingId,
                "Đến cửa hàng nhận hàng",
                prev,
                "Đã đến kho/cửa hàng lấy hàng",
                userId,
                name,
                "Shipper",
                note ?? "Shipper đã đến cửa hàng kiểm tra kiện hàng và nhận hàng vật lý"
            );

            return (await _orderService.GetByIdAsync(orderId))!;
        }

        // ── BƯỚC 3: GIAO HÀNG CHO KHÁCH HÀNG ────────────────────────────
        public async Task<OrderDto> StartDeliveryAsync(int orderId, int shipperId, string? userId = null, string? performerName = null, string? note = null)
        {
            var shipping = await _context.Shippings
                .Include(s => s.Order)
                .FirstOrDefaultAsync(s => s.OrderId == orderId);

            if (shipping == null) throw new KeyNotFoundException($"Không tìm thấy thông tin giao hàng của đơn #{orderId}");

            var prev = GetShippingStatusText(shipping.Status);
            shipping.ShipperId = shipperId;
            shipping.Status = 3; // 3 = Đang giao hàng cho KH
            shipping.ShippedAt ??= DateTime.UtcNow;

            if (shipping.Order != null && shipping.Order.Status < 3)
            {
                await _orderService.UpdateAsync(orderId, new UpdateOrderDto { Status = 3 });
            }

            await _context.SaveChangesAsync();

            var shipper = await _context.Shippers.FindAsync(shipperId);
            var name = performerName ?? shipper?.FullName ?? "Shipper";

            await AddOrderTrackingLogAsync(
                orderId,
                shipping.ShippingId,
                "Giao hàng cho KH",
                prev,
                "Đang giao hàng cho khách",
                userId,
                name,
                "Shipper",
                note ?? "Shipper đang trên đường di chuyển đến địa chỉ nhận hàng của khách"
            );

            return (await _orderService.GetByIdAsync(orderId))!;
        }

        // ── BƯỚC 4: NHẬN TIỀN / GIAO THÀNH CÔNG ─────────────────────────
        public async Task<OrderDto> CompleteDeliveryAsync(int orderId, int shipperId, string? userId = null, string? performerName = null, string? note = null)
        {
            var shipping = await _context.Shippings
                .Include(s => s.Order)
                .FirstOrDefaultAsync(s => s.OrderId == orderId);

            if (shipping == null) throw new KeyNotFoundException($"Không tìm thấy thông tin giao hàng của đơn #{orderId}");

            var prev = GetShippingStatusText(shipping.Status);
            shipping.ShipperId = shipperId;
            shipping.Status = 4; // 4 = Giao thành công & Thu tiền COD
            shipping.DeliveredAt = DateTime.UtcNow;
            shipping.FailReason = null;

            var payment = await _context.Payments.FirstOrDefaultAsync(p => p.OrderId == orderId);
            bool isCod = payment != null && payment.PaymentMethod == 0;
            if (payment != null)
            {
                payment.Status = 1; // Đã thanh toán
                payment.PaidAt = DateTime.UtcNow;

                if (isCod)
                {
                    // Shipper đang giữ tiền COD thu từ khách
                    payment.CodStatus = 1;
                    payment.CodCollectedAt = DateTime.UtcNow;
                }
                else
                {
                    payment.CodStatus = 0;
                }
            }

            await _context.SaveChangesAsync();

            // Hoàn tất đơn hàng và tích điểm cho khách
            await _orderService.UpdateAsync(orderId, new UpdateOrderDto { Status = 4 });

            var shipper = await _context.Shippers.FindAsync(shipperId);
            var name = performerName ?? shipper?.FullName ?? "Shipper";
            var actionNote = isCod 
                ? $"Giao hàng thành công. Đã thu {payment?.Amount:N0} đ tiền mặt COD từ khách hàng." 
                : "Giao hàng thành công tới khách hàng (đơn đã thanh toán trực tuyến).";

            await AddOrderTrackingLogAsync(
                orderId,
                shipping.ShippingId,
                "Nhận tiền / Giao thành công",
                prev,
                isCod ? "Giao thành công & Đã thu COD" : "Giao thành công",
                userId,
                name,
                "Shipper",
                note ?? actionNote
            );

            return (await _orderService.GetByIdAsync(orderId))!;
        }

        // ── BƯỚC 5: GỬI LẠI TIỀN CHO CỬA HÀNG ────────────────────────────
        public async Task<OrderDto> SubmitCodAsync(int orderId, int shipperId, string? userId = null, string? performerName = null, string? note = null)
        {
            var payment = await _context.Payments.FirstOrDefaultAsync(p => p.OrderId == orderId && p.PaymentMethod == 0);
            if (payment == null) throw new KeyNotFoundException($"Không tìm thấy khoản thanh toán COD của đơn #{orderId}");

            var shipping = await _context.Shippings.FirstOrDefaultAsync(s => s.OrderId == orderId);

            payment.CodStatus = 2; // 2 = Đã nộp tiền về shop
            payment.CodSubmittedAt = DateTime.UtcNow;
            if (!string.IsNullOrWhiteSpace(note)) payment.CodNote = note;

            await _context.SaveChangesAsync();

            var shipper = await _context.Shippers.FindAsync(shipperId);
            var name = performerName ?? shipper?.FullName ?? "Shipper";

            await AddOrderTrackingLogAsync(
                orderId,
                shipping?.ShippingId,
                "Gửi lại tiền cho cửa hàng",
                "Shipper giữ tiền COD",
                "Đã nộp tiền COD về cửa hàng",
                userId,
                name,
                "Shipper",
                note ?? $"Shipper đã đối soát và nộp {payment.Amount:N0} đ tiền COD về quỹ cửa hàng."
            );

            return (await _orderService.GetByIdAsync(orderId))!;
        }

        public async Task<OrderDto> FailDeliveryAsync(int orderId, int shipperId, FailDeliveryDto dto, string? userId = null, string? performerName = null)
        {
            var shipping = await _context.Shippings
                .Include(s => s.Order)
                .FirstOrDefaultAsync(s => s.OrderId == orderId);

            if (shipping == null) throw new KeyNotFoundException($"Không tìm thấy thông tin giao hàng của đơn #{orderId}");

            var prev = GetShippingStatusText(shipping.Status);
            shipping.ShipperId = shipperId;
            shipping.AttemptCount += 1;
            shipping.FailReason = dto.FailReason + (!string.IsNullOrWhiteSpace(dto.Note) ? $" ({dto.Note})" : "");
            shipping.FailedAt = DateTime.UtcNow;

            var shipper = await _context.Shippers.FindAsync(shipperId);
            var name = performerName ?? shipper?.FullName ?? "Shipper";

            if (shipping.AttemptCount >= 3)
            {
                shipping.Status = 6; // 6 = Hoàn hàng về kho
                await _context.SaveChangesAsync();
                await _orderService.UpdateAsync(orderId, new UpdateOrderDto { Status = 5 });

                await AddOrderTrackingLogAsync(
                    orderId,
                    shipping.ShippingId,
                    "Giao thất bại lần 3 - Hoàn kho",
                    prev,
                    "Hoàn hàng về kho",
                    userId,
                    name,
                    "Shipper",
                    $"Đã thử giao 3 lần không thành công ({shipping.FailReason}). Kiện hàng được chuyển hoàn về kho."
                );
            }
            else
            {
                shipping.Status = 5; // 5 = Giao thất bại chờ giao lại
                await _context.SaveChangesAsync();

                await AddOrderTrackingLogAsync(
                    orderId,
                    shipping.ShippingId,
                    $"Giao thất bại lần {shipping.AttemptCount}",
                    prev,
                    "Chờ hẹn giao lại",
                    userId,
                    name,
                    "Shipper",
                    $"Lý do: {shipping.FailReason}"
                );
            }

            return (await _orderService.GetByIdAsync(orderId))!;
        }

        public async Task<OrderDto> RetryDeliveryAsync(int orderId, int shipperId, string? userId = null, string? performerName = null, string? note = null)
        {
            var shipping = await _context.Shippings
                .Include(s => s.Order)
                .FirstOrDefaultAsync(s => s.OrderId == orderId);

            if (shipping == null) throw new KeyNotFoundException($"Không tìm thấy thông tin giao hàng của đơn #{orderId}");

            var prev = GetShippingStatusText(shipping.Status);
            shipping.ShipperId = shipperId;
            shipping.Status = 3; // Tiếp tục đi giao lại cho khách
            shipping.ShippedAt = DateTime.UtcNow;

            if (shipping.Order != null && shipping.Order.Status != 3)
            {
                await _orderService.UpdateAsync(orderId, new UpdateOrderDto { Status = 3 });
            }

            await _context.SaveChangesAsync();

            var shipper = await _context.Shippers.FindAsync(shipperId);
            var name = performerName ?? shipper?.FullName ?? "Shipper/Admin";

            await AddOrderTrackingLogAsync(
                orderId,
                shipping.ShippingId,
                "Giao lại đơn hàng",
                prev,
                "Đang giao hàng lại",
                userId,
                name,
                "Shipper",
                note ?? "Cửa hàng xuất kho giao lại đơn hàng"
            );

            return (await _orderService.GetByIdAsync(orderId))!;
        }

        public async Task<List<OrderTrackingLogDto>> GetOrderTrackingLogsAsync(int orderId)
        {
            var logs = await _context.OrderTrackingLogs
                .AsNoTracking()
                .Where(x => x.OrderId == orderId)
                .OrderBy(x => x.CreatedAt)
                .ToListAsync();

            return logs.Select(x => new OrderTrackingLogDto
            {
                TrackingLogId = x.TrackingLogId,
                OrderId = x.OrderId,
                ShippingId = x.ShippingId,
                Action = x.Action,
                PreviousStatus = x.PreviousStatus,
                NewStatus = x.NewStatus,
                PerformedByUserId = x.PerformedByUserId,
                PerformedByName = x.PerformedByName,
                PerformedByRole = x.PerformedByRole,
                Note = x.Note,
                CreatedAt = x.CreatedAt
            }).ToList();
        }

        public async Task AddOrderTrackingLogAsync(int orderId, int? shippingId, string action, string? previousStatus, string newStatus, string? userId, string performerName, string performerRole, string? note = null)
        {
            try
            {
                var log = new OrderTrackingLog
                {
                    OrderId = orderId,
                    ShippingId = shippingId,
                    Action = action,
                    PreviousStatus = previousStatus,
                    NewStatus = newStatus,
                    PerformedByUserId = userId,
                    PerformedByName = string.IsNullOrWhiteSpace(performerName) ? "Hệ thống" : performerName,
                    PerformedByRole = string.IsNullOrWhiteSpace(performerRole) ? "System" : performerRole,
                    Note = note,
                    CreatedAt = DateTime.UtcNow
                };

                _context.OrderTrackingLogs.Add(log);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[OrderTrackingLog Warning] Could not save log: {ex.Message}");
            }
        }

        public async Task<List<CodReconciliationDto>> GetCodReconciliationListAsync(int? shipperId = null, int? codStatus = null)
        {
            var query = from p in _context.Payments.AsNoTracking()
                        join o in _context.Orders.AsNoTracking() on p.OrderId equals o.OrderId
                        join s in _context.Shippings.AsNoTracking() on o.OrderId equals s.OrderId into sGroup
                        from s in sGroup.DefaultIfEmpty()
                        join sh in _context.Shippers.AsNoTracking() on s.ShipperId equals sh.ShipperId into shGroup
                        from sh in shGroup.DefaultIfEmpty()
                        where p.PaymentMethod == 0 // Chỉ đơn COD
                        select new { p, o, s, sh };

            if (shipperId.HasValue && shipperId.Value > 0)
            {
                query = query.Where(x => x.s != null && x.s.ShipperId == shipperId.Value);
            }

            if (codStatus.HasValue)
            {
                query = query.Where(x => x.p.CodStatus == codStatus.Value);
            }
            else
            {
                query = query.Where(x => x.p.CodStatus == 1 || x.p.CodStatus == 2);
            }

            var list = await query.OrderByDescending(x => x.p.CodCollectedAt ?? x.o.OrderDate).ToListAsync();

            return list.Select(x => new CodReconciliationDto
            {
                PaymentId = x.p.PaymentId,
                OrderId = x.o.OrderId,
                OrderCode = x.o.OrderCode,
                ReceiverName = x.s?.ReceiverName ?? "Khách hàng",
                ReceiverPhone = x.s?.ReceiverPhone ?? "—",
                Address = x.s?.Address ?? "—",
                Amount = x.p.Amount,
                ShipperId = x.s?.ShipperId,
                ShipperName = x.sh?.FullName,
                ShipperPhone = x.sh?.PhoneNumber,
                DeliveryBatchCode = x.s?.DeliveryBatchCode,
                CodStatus = x.p.CodStatus,
                CodCollectedAt = x.p.CodCollectedAt,
                CodSubmittedAt = x.p.CodSubmittedAt,
                CodNote = x.p.CodNote
            }).ToList();
        }

        public async Task<bool> ConfirmCodSubmissionAsync(ConfirmCodSubmissionDto dto, string? confirmedByUserId = null, string? confirmedByName = null)
        {
            if (dto.PaymentIds == null || !dto.PaymentIds.Any())
            {
                throw new ArgumentException("Danh sách PaymentIds không được để trống.");
            }

            var payments = await _context.Payments
                .Where(p => dto.PaymentIds.Contains(p.PaymentId))
                .ToListAsync();

            foreach (var p in payments)
            {
                p.CodStatus = 2; // 2 = Đã nộp tiền về shop
                p.CodSubmittedAt = DateTime.UtcNow;
                if (!string.IsNullOrWhiteSpace(dto.Note))
                {
                    p.CodNote = dto.Note;
                }

                // Ghi nhận Audit log cho từng đơn hàng
                await AddOrderTrackingLogAsync(
                    p.OrderId,
                    null,
                    "Gửi lại tiền cho cửa hàng",
                    "Shipper giữ tiền COD",
                    "Thủ quỹ/Quản lý đã xác nhận nộp tiền COD vào quỹ",
                    confirmedByUserId,
                    confirmedByName ?? "Thủ quỹ cửa hàng",
                    "Staff/Admin",
                    dto.Note ?? $"Xác nhận nộp đủ {p.Amount:N0} đ tiền COD vào quỹ cửa hàng"
                );
            }

            await _context.SaveChangesAsync();
            return true;
        }

        private static string GetShippingStatusText(int status) => status switch
        {
            0 => "Chờ xuất kho",
            1 => "Đã nhận đơn",
            2 => "Đã lấy hàng tại cửa hàng",
            3 => "Đang giao hàng cho KH",
            4 => "Giao thành công",
            5 => "Giao thất bại",
            6 => "Hoàn hàng về kho",
            _ => $"Trạng thái {status}"
        };

        private static OrderDto MapOrderToDtoFast(Order order)
        {
            return new OrderDto
            {
                OrderId = order.OrderId,
                CustomerId = order.CustomerId,
                OrderCode = order.OrderCode,
                OrderDate = order.OrderDate,
                Status = order.Status,
                Subtotal = order.Subtotal,
                DiscountAmount = order.DiscountAmount,
                ShippingFee = order.ShippingFee,
                TotalAmount = order.TotalAmount,
                PaymentStatus = order.Payment?.Status,
                Note = order.Note,
                CustomerName = order.Customer?.FullName,
                CustomerEmail = order.Customer?.Email,
                PhoneNumber = order.Customer?.Phone ?? order.Shipping?.ReceiverPhone,
                CreatedAt = order.CreatedAt,
                UpdatedAt = order.UpdatedAt,

                OrderDetails = order.OrderDetails?.Select(x => new OrderDetailDto
                {
                    OrderDetailId = x.OrderDetailId,
                    OrderId = x.OrderId,
                    VariantId = x.VariantId,
                    Quantity = x.Quantity,
                    UnitPrice = x.UnitPrice,
                    DiscountAmount = x.DiscountAmount,
                    TotalAmount = x.TotalAmount,
                    ProductName = x.ProductVariant?.Product?.Name,
                    Sku = x.ProductVariant?.SKU,
                    ImageUrl = x.ProductVariant?.ImageUrl ?? x.ProductVariant?.Product?.ImageUrl,
                    VariantAttributes = x.ProductVariant?.VariantAttributes != null && x.ProductVariant.VariantAttributes.Any()
                        ? string.Join(" · ", x.ProductVariant.VariantAttributes.Select(a => $"{a.AttributeName}: {a.AttributeValue}"))
                        : null
                }).ToList() ?? new List<OrderDetailDto>(),

                Payment = order.Payment == null ? null : new PaymentDto
                {
                    PaymentId = order.Payment.PaymentId,
                    OrderId = order.Payment.OrderId,
                    PaymentMethod = order.Payment.PaymentMethod,
                    TransactionCode = order.Payment.TransactionCode,
                    Amount = order.Payment.Amount,
                    Status = order.Payment.Status,
                    PaidAt = order.Payment.PaidAt,
                    CodStatus = order.Payment.CodStatus,
                    CodCollectedAt = order.Payment.CodCollectedAt,
                    CodSubmittedAt = order.Payment.CodSubmittedAt,
                    CodNote = order.Payment.CodNote
                },

                Shipping = order.Shipping == null ? null : new ShippingDto
                {
                    ShippingId = order.Shipping.ShippingId,
                    OrderId = order.Shipping.OrderId,
                    ReceiverName = order.Shipping.ReceiverName,
                    ReceiverPhone = order.Shipping.ReceiverPhone,
                    Address = order.Shipping.Address,
                    ShippingMethod = order.Shipping.ShippingMethod,
                    TrackingCode = order.Shipping.TrackingCode,
                    ShippingFee = order.Shipping.ShippingFee,
                    DeliveryBatchCode = order.Shipping.DeliveryBatchCode,
                    EstimatedDeliveryFromDate = order.Shipping.EstimatedDeliveryFromDate,
                    EstimatedDeliveryToDate = order.Shipping.EstimatedDeliveryToDate,
                    Status = order.Shipping.Status,
                    ShippedAt = order.Shipping.ShippedAt,
                    DeliveredAt = order.Shipping.DeliveredAt,
                    ShipperId = order.Shipping.ShipperId,
                    ShipperName = order.Shipping.Shipper?.FullName,
                    ShipperPhone = order.Shipping.Shipper?.PhoneNumber,
                    FailReason = order.Shipping.FailReason,
                    AttemptCount = order.Shipping.AttemptCount,
                    FailedAt = order.Shipping.FailedAt
                }
            };
        }
    }
}
