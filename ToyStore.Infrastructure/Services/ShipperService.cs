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
                .Include(s => s.Shippings)
                .OrderByDescending(s => s.IsActive)
                .ThenBy(s => s.FullName)
                .ToListAsync();

            var result = new List<ShipperDto>();
            foreach (var s in shippers)
            {
                var activeOrders = s.Shippings.Count(sh => sh.Status == 1 || sh.Status == 0 || sh.Status == 4);
                var completedOrders = s.Shippings.Count(sh => sh.Status == 2);
                
                // Tiền COD shipper đang giữ (Payment.CodStatus == 1)
                var orderIds = s.Shippings.Select(sh => sh.OrderId).ToList();
                var pendingCod = await _context.Payments
                    .Where(p => orderIds.Contains(p.OrderId) && p.CodStatus == 1)
                    .SumAsync(p => p.Amount);

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
                .Include(x => x.Shippings)
                .FirstOrDefaultAsync(x => x.ShipperId == id);

            if (s == null) return null;

            var activeOrders = s.Shippings.Count(sh => sh.Status == 1 || sh.Status == 0 || sh.Status == 4);
            var completedOrders = s.Shippings.Count(sh => sh.Status == 2);
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

        public async Task<ShipperDto> CreateShipperAsync(CreateShipperDto dto)
        {
            string? userId = null;

            // Nếu có email và password -> Tạo tài khoản user tương ứng
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

            // Soft-delete / deactivate để không làm mất lịch sử đơn hàng
            s.IsActive = false;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> AssignShipperAsync(AssignOrderShipperDto dto)
        {
            var shipper = await _context.Shippers.FindAsync(dto.ShipperId);
            if (shipper == null || !shipper.IsActive)
            {
                throw new InvalidOperationException("Shipper không tồn tại hoặc đã tạm dừng hoạt động.");
            }

            // Gán theo đơn hàng cụ thể
            if (dto.OrderId.HasValue && dto.OrderId.Value > 0)
            {
                var shipping = await _context.Shippings.FirstOrDefaultAsync(s => s.OrderId == dto.OrderId.Value);
                if (shipping == null) throw new KeyNotFoundException($"Không tìm thấy thông tin giao hàng của đơn #{dto.OrderId.Value}");

                shipping.ShipperId = dto.ShipperId;
                await _context.SaveChangesAsync();
                return true;
            }

            // Hoặc gán theo cả Lô giao hàng
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
                }
                await _context.SaveChangesAsync();
                return true;
            }

            throw new ArgumentException("Cần cung cấp OrderId hoặc DeliveryBatchCode để gán shipper.");
        }

        public async Task<List<OrderDto>> GetShipperOrdersAsync(int shipperId, string? status = null)
        {
            var query = _context.Orders
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
                // Đang chờ giao hoặc đang giao
                query = query.Where(o => o.Shipping.Status == 0 || o.Shipping.Status == 1 || o.Shipping.Status == 4);
            }
            else if (status == "completed")
            {
                query = query.Where(o => o.Shipping.Status == 2);
            }
            else if (status == "failed")
            {
                query = query.Where(o => o.Shipping.Status == 3 || o.Shipping.Status == 5);
            }

            var orders = await query.OrderByDescending(o => o.OrderDate).ToListAsync();
            var dtos = new List<OrderDto>();
            foreach (var order in orders)
            {
                var dto = await _orderService.GetByIdAsync(order.OrderId);
                if (dto != null) dtos.Add(dto);
            }
            return dtos;
        }

        public async Task<OrderDto> StartDeliveryAsync(int orderId, int shipperId)
        {
            var shipping = await _context.Shippings
                .Include(s => s.Order)
                .FirstOrDefaultAsync(s => s.OrderId == orderId);

            if (shipping == null) throw new KeyNotFoundException($"Không tìm thấy thông tin giao hàng của đơn #{orderId}");

            // Tự động gán nếu shipper nhận đơn
            shipping.ShipperId = shipperId;
            shipping.Status = 1; // 1 = Đang giao
            shipping.ShippedAt ??= DateTime.UtcNow;

            // Cập nhật trạng thái Order sang 3 (Đang giao)
            if (shipping.Order != null && shipping.Order.Status < 3)
            {
                await _orderService.UpdateAsync(orderId, new UpdateOrderDto { Status = 3 });
            }

            await _context.SaveChangesAsync();
            return (await _orderService.GetByIdAsync(orderId))!;
        }

        public async Task<OrderDto> CompleteDeliveryAsync(int orderId, int shipperId)
        {
            var shipping = await _context.Shippings
                .Include(s => s.Order)
                .FirstOrDefaultAsync(s => s.OrderId == orderId);

            if (shipping == null) throw new KeyNotFoundException($"Không tìm thấy thông tin giao hàng của đơn #{orderId}");

            shipping.ShipperId = shipperId;
            shipping.Status = 2; // 2 = Đã giao thành công
            shipping.DeliveredAt = DateTime.UtcNow;
            shipping.FailReason = null;

            var payment = await _context.Payments.FirstOrDefaultAsync(p => p.OrderId == orderId);
            if (payment != null)
            {
                payment.Status = 1; // Đã thanh toán
                payment.PaidAt = DateTime.UtcNow;

                if (payment.PaymentMethod == 0) // COD
                {
                    // Shipper đang giữ tiền COD
                    payment.CodStatus = 1;
                    payment.CodCollectedAt = DateTime.UtcNow;
                }
                else
                {
                    payment.CodStatus = 0; // Thanh toán trực tuyến
                }
            }

            await _context.SaveChangesAsync();

            // Hoàn tất đơn hàng (tích điểm khách hàng)
            await _orderService.UpdateAsync(orderId, new UpdateOrderDto { Status = 4 });

            return (await _orderService.GetByIdAsync(orderId))!;
        }

        public async Task<OrderDto> FailDeliveryAsync(int orderId, int shipperId, FailDeliveryDto dto)
        {
            var shipping = await _context.Shippings
                .Include(s => s.Order)
                .FirstOrDefaultAsync(s => s.OrderId == orderId);

            if (shipping == null) throw new KeyNotFoundException($"Không tìm thấy thông tin giao hàng của đơn #{orderId}");

            shipping.ShipperId = shipperId;
            shipping.AttemptCount += 1;
            shipping.FailReason = dto.FailReason + (!string.IsNullOrWhiteSpace(dto.Note) ? $" ({dto.Note})" : "");
            shipping.FailedAt = DateTime.UtcNow;

            if (shipping.AttemptCount >= 3)
            {
                // Quá 3 lần giao thất bại -> Chuyển sang Hoàn hàng về kho (5)
                shipping.Status = 5; // Hoàn hàng về kho
                await _context.SaveChangesAsync();

                // Hủy đơn hàng và tự động hoàn trả tồn kho sản phẩm
                await _orderService.UpdateAsync(orderId, new UpdateOrderDto { Status = 5 });
            }
            else
            {
                shipping.Status = 3; // 3 = Giao thất bại lần N (chờ giao lại)
                await _context.SaveChangesAsync();
            }

            return (await _orderService.GetByIdAsync(orderId))!;
        }

        public async Task<OrderDto> RetryDeliveryAsync(int orderId, int shipperId)
        {
            var shipping = await _context.Shippings
                .Include(s => s.Order)
                .FirstOrDefaultAsync(s => s.OrderId == orderId);

            if (shipping == null) throw new KeyNotFoundException($"Không tìm thấy thông tin giao hàng của đơn #{orderId}");

            shipping.ShipperId = shipperId;
            shipping.Status = 4; // 4 = Đang giao lại
            shipping.ShippedAt = DateTime.UtcNow;

            if (shipping.Order != null && shipping.Order.Status != 3)
            {
                await _orderService.UpdateAsync(orderId, new UpdateOrderDto { Status = 3 });
            }

            await _context.SaveChangesAsync();
            return (await _orderService.GetByIdAsync(orderId))!;
        }

        public async Task<List<CodReconciliationDto>> GetCodReconciliationListAsync(int? shipperId = null, int? codStatus = null)
        {
            var query = from p in _context.Payments
                        join o in _context.Orders on p.OrderId equals o.OrderId
                        join s in _context.Shippings on o.OrderId equals s.OrderId into sGroup
                        from s in sGroup.DefaultIfEmpty()
                        join sh in _context.Shippers on s.ShipperId equals sh.ShipperId into shGroup
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
                // Mặc định trả về các đơn đã thu đang giữ tiền (1) hoặc đã nộp gần đây (2)
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

        public async Task<bool> ConfirmCodSubmissionAsync(ConfirmCodSubmissionDto dto)
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
            }

            await _context.SaveChangesAsync();
            return true;
        }
    }
}
