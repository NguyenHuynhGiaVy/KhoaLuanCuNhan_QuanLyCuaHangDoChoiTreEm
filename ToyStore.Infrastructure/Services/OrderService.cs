using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStoreManagement.Application.DTOs.Order;
using ToyStoreManagement.Application.Interfaces;
using ToyStoreManagement.Application.Interfaces.Repositories;
using ToyStoreManagement.Application.Interfaces.Services;
using ToyStoreManagement.Domain.Entities;
using ToyStore.Application.Interfaces.Repositories;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using ToyStoreManagement.Infrastructure.Data;

namespace ToyStoreManagement.Infrastructure.Services
{
    public class OrderService : IOrderService
    {
        private readonly IOrderRepository _orderRepository;
        private readonly IPaymentRepository _paymentRepository;
        private readonly IGenericRepository<ProductVariant> _variantRepository;
        private readonly IGenericRepository<Shipping> _shippingRepository;
        private readonly IUnitOfWork _unitOfWork;
        private readonly ApplicationDbContext _context;
        private readonly IDistanceMatrixService _distanceMatrixService;
        private readonly IConfiguration _configuration;

        public OrderService(
            IOrderRepository orderRepository,
            IPaymentRepository paymentRepository,
            IGenericRepository<ProductVariant> variantRepository,
            IGenericRepository<Shipping> shippingRepository,
            IUnitOfWork unitOfWork,
            ApplicationDbContext context,
            IDistanceMatrixService distanceMatrixService,
            IConfiguration configuration)
        {
            _orderRepository = orderRepository;
            _paymentRepository = paymentRepository;
            _variantRepository = variantRepository;
            _shippingRepository = shippingRepository;
            _unitOfWork = unitOfWork;
            _context = context;
            _distanceMatrixService = distanceMatrixService;
            _configuration = configuration;
        }

        public async Task<IEnumerable<OrderDto>> GetAllAsync()
        {
            var orders = await _orderRepository.GetAllWithDetailsAsync();
            return orders.Select(MapToDto);
        }

        public async Task<OrderDto?> GetByIdAsync(int orderId)
        {
            var order = await _orderRepository
                .GetByIdWithDetailsAsync(orderId);

            return order == null ? null : MapToDto(order);
        }

        public async Task<OrderDto?> GetByOrderCodeAsync(string orderCode)
        {
            var order = await _orderRepository
                .GetByOrderCodeAsync(orderCode);

            return order == null ? null : MapToDto(order);
        }

        public async Task<IEnumerable<OrderDto>> GetByCustomerIdAsync(
            int customerId)
        {
            var orders = await _orderRepository
                .GetByCustomerIdAsync(customerId);

            return orders.Select(MapToDto);
        }

        public async Task<OrderDto> CreateAsync(CreateOrderDto dto)
        {
            if (dto.OrderDetails == null || !dto.OrderDetails.Any())
                throw new Exception("Đơn hàng phải có ít nhất một sản phẩm.");

            if (dto.Shipping == null
                || string.IsNullOrWhiteSpace(dto.Shipping.ReceiverName)
                || string.IsNullOrWhiteSpace(dto.Shipping.ReceiverPhone)
                || string.IsNullOrWhiteSpace(dto.Shipping.Address))
            {
                throw new Exception("Vui lòng nhập đầy đủ họ tên, số điện thoại và địa chỉ nhận hàng.");
            }

            await using var transaction = await _context.Database
                .BeginTransactionAsync(System.Data.IsolationLevel.Serializable);

            var affectedProductIds = new HashSet<int>();

            foreach (var detail in dto.OrderDetails)
            {
                if (detail.Quantity <= 0)
                    throw new Exception("Số lượng sản phẩm phải lớn hơn 0.");

                var variant = await _variantRepository
                    .GetByIdAsync(detail.VariantId);

                if (variant == null)
                    throw new Exception(
                        $"Không tìm thấy biến thể sản phẩm ID {detail.VariantId}.");

                if (variant.Price <= 0)
                {
                    throw new Exception(
                        $"Sản phẩm (SKU: {variant.SKU}) chưa được cập nhật giá bán.");
                }

                var inventory = await _context.Inventories
                    .FirstOrDefaultAsync(i => i.VariantId == detail.VariantId);

                if (inventory == null)
                {
                    throw new Exception(
                        $"Sản phẩm (SKU: {variant.SKU}) chưa có hàng trong kho.");
                }

                var availableQuantity = Math.Max(0, inventory.Quantity - inventory.ReservedQuantity);
                if (availableQuantity < detail.Quantity)
                {
                    throw new Exception(
                        $"Sản phẩm (SKU: {variant.SKU}) không đủ số lượng tồn kho. Hiện chỉ còn {availableQuantity} sản phẩm.");
                }
            }

            var order = new Order
            {
                CustomerId = dto.CustomerId,
                OrderCode = GenerateOrderCode(),
                OrderDate = DateTime.UtcNow,
                Status = 0,
                Note = dto.Note,
                CreatedAt = DateTime.UtcNow,
                DiscountAmount = 0,
                ShippingFee = 0
            };

            decimal subtotal = 0;

            foreach (var detailDto in dto.OrderDetails)
            {
                var variant = await _variantRepository
                    .GetByIdAsync(detailDto.VariantId);

                decimal totalAmount =
                    variant.Price * detailDto.Quantity;

                var detail = new OrderDetail
                {
                    VariantId = detailDto.VariantId,
                    Quantity = detailDto.Quantity,
                    UnitPrice = variant.Price,
                    DiscountAmount = 0,
                    TotalAmount = totalAmount
                };

                order.OrderDetails.Add(detail);
                subtotal += totalAmount;

                // Trừ số lượng tồn kho
                var inventory = await _context.Inventories
                    .FirstOrDefaultAsync(i => i.VariantId == detailDto.VariantId);
                
                if (inventory == null)
                    throw new Exception("Sản phẩm chưa có thông tin tồn kho.");

                inventory.Quantity -= detailDto.Quantity;
                if (inventory.Quantity < 0)
                    throw new Exception("Số lượng tồn kho không được âm.");

                inventory.UpdatedAt = DateTime.UtcNow;
                affectedProductIds.Add(variant.ProductId);
            }

            order.Subtotal = subtotal;
            order.ShippingFee = subtotal >= 500000 ? 0 : 30000;

            order.TotalAmount =
                order.Subtotal
                - order.DiscountAmount
                + order.ShippingFee;

            await _orderRepository.AddAsync(order);
            await _unitOfWork.SaveChangesAsync();

            _context.Shippings.Add(new Shipping
            {
                OrderId = order.OrderId,
                ReceiverName = dto.Shipping.ReceiverName.Trim(),
                ReceiverPhone = dto.Shipping.ReceiverPhone.Trim(),
                Address = dto.Shipping.Address.Trim(),
                ShippingMethod = dto.Shipping.ShippingMethod,
                TrackingCode = !string.IsNullOrWhiteSpace(dto.Shipping.TrackingCode) ? dto.Shipping.TrackingCode.Trim() : $"TRK-{order.OrderCode}",
                ShippingFee = order.ShippingFee,
                Status = 0
            });

            foreach (var productId in affectedProductIds)
            {
                var product = await _context.Products.FindAsync(productId);
                if (product == null)
                    continue;

                var totalQuantity = await _context.Inventories
                    .Where(x => x.ProductVariant.ProductId == productId)
                    .SumAsync(x => (int?)x.Quantity) ?? 0;

                product.Status = totalQuantity > 0 ? 1 : 0;

                product.UpdatedAt = DateTime.UtcNow;
            }

            await _unitOfWork.SaveChangesAsync();

            // Ghi nhận nhật ký xuất kho
            foreach (var detailDto in dto.OrderDetails)
            {
                _context.InventoryTransactions.Add(new InventoryTransaction
                {
                    VariantId = detailDto.VariantId,
                    TransactionType = 2, // 2: Bán hàng / Xuất kho
                    Quantity = -detailDto.Quantity,
                    ReferenceType = "Order",
                    ReferenceId = order.OrderId,
                    Note = $"Xuất kho bán hàng cho đơn {order.OrderCode}",
                    CreatedAt = DateTime.UtcNow
                });
            }

            // Tạo bản ghi thanh toán ở trạng thái chờ. Chỉ khi đơn Hoàn tất
            // thì bản ghi này mới chuyển sang Đã thanh toán và khách mới nhận điểm.
            _context.Payments.Add(new Payment
            {
                OrderId = order.OrderId,
                PaymentMethod = dto.PaymentMethod,
                TransactionCode = $"PENDING-{order.OrderCode}",
                Amount = order.TotalAmount,
                Status = 0,
                CreatedAt = DateTime.UtcNow
            });

            await _unitOfWork.SaveChangesAsync();

            await transaction.CommitAsync();

            var result = await _orderRepository
                .GetByIdWithDetailsAsync(order.OrderId);

            return MapToDto(result);
        }

        public async Task<OrderDto?> UpdateAsync(
            int orderId,
            UpdateOrderDto dto)
        {
            var order = await _orderRepository
                .GetByIdWithDetailsAsync(orderId);

            if (order == null)
                return null;

            await using var transaction = await _context.Database
                .BeginTransactionAsync(System.Data.IsolationLevel.Serializable);

            var affectedProductIds = new HashSet<int>();

            if (dto.DiscountAmount.HasValue && dto.DiscountAmount < 0)
                throw new Exception("Số tiền giảm giá không hợp lệ.");

            if (dto.ShippingFee.HasValue && dto.ShippingFee < 0)
                throw new Exception("Phí vận chuyển không hợp lệ.");

            if (dto.DiscountAmount.HasValue && dto.DiscountAmount > order.Subtotal)
                throw new Exception("Số tiền giảm giá không được lớn hơn tổng tiền sản phẩm.");

            int oldStatus = order.Status;
            order.Status = dto.Status;
            if (dto.DiscountAmount.HasValue) order.DiscountAmount = dto.DiscountAmount.Value;
            if (dto.ShippingFee.HasValue) order.ShippingFee = dto.ShippingFee.Value;
            if (dto.Note != null) order.Note = dto.Note;

            order.TotalAmount =
                order.Subtotal
                - order.DiscountAmount
                + order.ShippingFee;

            order.UpdatedAt = DateTime.UtcNow;

            // Hoàn tất đơn: xác nhận thanh toán, hoàn thành giao hàng và cộng điểm đúng một lần.
            if (dto.Status == 4 && oldStatus != 4)
            {
                var payment = order.Payment
                    ?? await _paymentRepository.GetByOrderIdAsync(order.OrderId);

                if (payment == null)
                {
                    _context.Payments.Add(new Payment
                    {
                        OrderId = order.OrderId,
                        PaymentMethod = 0,
                        TransactionCode = $"PAID-{order.OrderCode}",
                        Amount = order.TotalAmount,
                        Status = 1,
                        PaidAt = DateTime.UtcNow,
                        CreatedAt = DateTime.UtcNow
                    });
                }
                else
                {
                    payment.Amount = order.TotalAmount;
                    payment.Status = 1;
                    payment.PaidAt = DateTime.UtcNow;
                }

                // Cập nhật trạng thái giao hàng sang thành công
                var shipping = order.Shipping
                    ?? await _shippingRepository.FirstOrDefaultAsync(x => x.OrderId == order.OrderId);
                if (shipping != null)
                {
                    shipping.Status = 1; // 1: Đã giao
                    shipping.DeliveredAt = DateTime.UtcNow;
                }

                // Xác định khách hàng nhận điểm tích lũy
                int? targetCustomerId = order.CustomerId;
                if (!targetCustomerId.HasValue || targetCustomerId.Value <= 0)
                {
                    if (shipping != null && !string.IsNullOrWhiteSpace(shipping.ReceiverPhone))
                    {
                        var custByPhone = await _context.Customers
                            .FirstOrDefaultAsync(c => c.Phone == shipping.ReceiverPhone);
                        if (custByPhone != null)
                        {
                            targetCustomerId = custByPhone.CustomerId;
                            order.CustomerId = targetCustomerId;
                        }
                    }
                }

                if (targetCustomerId.HasValue && targetCustomerId.Value > 0)
                {
                    var alreadyEarnedPoints = await _context.LoyaltyTransactions
                        .AnyAsync(item => item.OrderId == order.OrderId
                            && item.TransactionType == 1);

                    if (!alreadyEarnedPoints)
                    {
                        var customer = await _context.Customers
                            .FindAsync(targetCustomerId.Value);
                        var earnedPoints = (int)(order.TotalAmount / 10000m);

                        if (customer != null && earnedPoints > 0)
                        {
                            customer.LoyaltyPoint += earnedPoints;
                            customer.UpdatedAt = DateTime.UtcNow;
                            _context.Entry(customer).State = Microsoft.EntityFrameworkCore.EntityState.Modified;

                            _context.LoyaltyTransactions.Add(new LoyaltyTransaction
                            {
                                CustomerId = customer.CustomerId,
                                OrderId = order.OrderId,
                                Points = earnedPoints,
                                TransactionType = 1,
                                Description = $"Tích {earnedPoints} điểm thưởng từ đơn hàng hoàn tất #{order.OrderCode}",
                                CreatedAt = DateTime.UtcNow
                            });
                        }
                    }
                }
            }

            // Hoàn tồn kho nếu đơn bị Hủy (5) và trước đó chưa hủy
            if (dto.Status == 5 && oldStatus != 5)
            {
                foreach (var detail in order.OrderDetails)
                {
                    var inventory = await _context.Inventories
                        .FirstOrDefaultAsync(i => i.VariantId == detail.VariantId);
                    if (inventory != null)
                    {
                        inventory.Quantity += detail.Quantity;
                        inventory.UpdatedAt = DateTime.UtcNow;
                        var productId = await _context.ProductVariants
                            .Where(x => x.VariantId == detail.VariantId)
                            .Select(x => x.ProductId)
                            .FirstAsync();
                        affectedProductIds.Add(productId);

                        _context.InventoryTransactions.Add(new InventoryTransaction
                        {
                            VariantId = detail.VariantId,
                            TransactionType = 1, // 1: Nhập kho / Hoàn trả
                            Quantity = detail.Quantity,
                            ReferenceType = "OrderCancel",
                            ReferenceId = order.OrderId,
                            Note = $"Hoàn tồn kho do hủy đơn hàng #{order.OrderCode}",
                            CreatedAt = DateTime.UtcNow
                        });
                    }
                }
            }

            _orderRepository.Update(order);
            await _unitOfWork.SaveChangesAsync();

            foreach (var productId in affectedProductIds)
            {
                var product = await _context.Products.FindAsync(productId);
                if (product == null)
                    continue;

                var totalQuantity = await _context.Inventories
                    .Where(x => x.ProductVariant.ProductId == productId)
                    .SumAsync(x => (int?)x.Quantity) ?? 0;

                product.Status = totalQuantity > 0 ? 1 : 0;

                product.UpdatedAt = DateTime.UtcNow;
            }

            await _unitOfWork.SaveChangesAsync();
            await transaction.CommitAsync();

            return MapToDto(order);
        }

        public async Task<bool> DeleteAsync(int orderId)
        {
            var order = await _orderRepository
                .GetByIdWithDetailsAsync(orderId);

            if (order == null)
                return false;

            if (order.Status != 0)
                throw new Exception(
                    "Chỉ có thể xóa đơn hàng đang ở trạng thái chờ xử lý.");

            _orderRepository.Delete(order);
            await _unitOfWork.SaveChangesAsync();

            return true;
        }

        public async Task<PaymentDto?> GetPaymentAsync(int orderId)
        {
            var payment = await _paymentRepository
                .GetByOrderIdAsync(orderId);

            return payment == null ? null : MapPaymentToDto(payment);
        }

        public async Task<ShippingDto?> GetShippingAsync(int orderId)
        {
            var shipping = await _shippingRepository
                .FirstOrDefaultAsync(x => x.OrderId == orderId);

            return shipping == null ? null : MapShippingToDto(shipping);
        }

        public async Task<PaymentDto> AddPaymentAsync(
            int orderId,
            CreatePaymentDto dto)
        {
            var order = await _orderRepository
                .GetByIdWithDetailsAsync(orderId);

            if (order == null)
                throw new Exception("Không tìm thấy đơn hàng.");

            if (dto.Amount <= 0)
                throw new Exception(
                    "Số tiền thanh toán phải lớn hơn 0.");

            var existingPayment = await _paymentRepository
                .GetByOrderIdAsync(orderId);

            if (existingPayment != null)
                throw new Exception(
                    "Đơn hàng đã có thông tin thanh toán.");

            var payment = new Payment
            {
                OrderId = orderId,
                PaymentMethod = dto.PaymentMethod,
                TransactionCode = dto.TransactionCode,
                Amount = dto.Amount,
                Status = 0,
                CreatedAt = DateTime.UtcNow
            };

            await _paymentRepository.AddAsync(payment);
            await _unitOfWork.SaveChangesAsync();

            return MapPaymentToDto(payment);
        }

        public async Task<ShippingDto> AddShippingAsync(
            int orderId,
            CreateShippingDto dto)
        {
            var order = await _orderRepository
                .GetByIdWithDetailsAsync(orderId);

            if (order == null)
                throw new Exception("Không tìm thấy đơn hàng.");

            if (string.IsNullOrWhiteSpace(dto.ReceiverName))
                throw new Exception(
                    "Tên người nhận không được để trống.");

            if (string.IsNullOrWhiteSpace(dto.ReceiverPhone))
                throw new Exception(
                    "Số điện thoại người nhận không được để trống.");

            if (string.IsNullOrWhiteSpace(dto.Address))
                throw new Exception(
                    "Địa chỉ giao hàng không được để trống.");

            if (dto.ShippingFee < 0)
                throw new Exception(
                    "Phí vận chuyển không hợp lệ.");

            var existingShipping = await _shippingRepository
                .FirstOrDefaultAsync(x => x.OrderId == orderId);

            if (existingShipping != null)
                throw new Exception(
                    "Đơn hàng đã có thông tin giao hàng.");

            var shipping = new Shipping
            {
                OrderId = orderId,
                ReceiverName = dto.ReceiverName,
                ReceiverPhone = dto.ReceiverPhone,
                Address = dto.Address,
                ShippingMethod = dto.ShippingMethod,
                TrackingCode = !string.IsNullOrWhiteSpace(dto.TrackingCode) ? dto.TrackingCode.Trim() : $"TRK-{order.OrderCode}",
                ShippingFee = dto.ShippingFee,
                Status = 0
            };

            await _shippingRepository.AddAsync(shipping);

            order.ShippingFee = dto.ShippingFee;
            order.TotalAmount =
                order.Subtotal
                - order.DiscountAmount
                + order.ShippingFee;
            order.UpdatedAt = DateTime.UtcNow;

            _orderRepository.Update(order);

            await _unitOfWork.SaveChangesAsync();

            return MapShippingToDto(shipping);
        }

        private static string GenerateOrderCode()
        {
            return "ORD-" +
                   DateTime.UtcNow.ToString("yyyyMMddHHmmssfff");
        }

        private async Task<DeliveryPlan> ResolveDeliveryPlanAsync(
            string receiverName,
            string receiverPhone,
            string address,
            DateTime? requestedEstimatedDeliveryAt = null)
        {
            var normalizedReceiver = NormalizeDeliveryText(receiverName);
            var normalizedPhone = NormalizePhone(receiverPhone);
            var now = DateTime.UtcNow;

            // 1. Tính toán cự ly thực tế từ vị trí Kho Hàng
            var distanceInfo = await _distanceMatrixService.CalculateDistanceToWarehouseAsync(address);
            var defaultWindow = requestedEstimatedDeliveryAt.HasValue
                ? CreateDeliveryWindow(requestedEstimatedDeliveryAt.Value, 1)
                : CalculateWindowFromDistance(now, distanceInfo.DistanceInKm);

            // 2. Chỉ gộp các đơn chưa xuất kho phát sinh trong 24 giờ gần đây
            var candidates = await _context.Shippings
                .Include(shipping => shipping.Order)
                .Where(shipping => shipping.Status == 0
                    && shipping.ShippedAt == null
                    && shipping.Order.OrderDate >= now.AddHours(-24)
                    && shipping.Order.Status != 5)
                .ToListAsync();

            var maxBatchDist = _configuration.GetValue<double?>("DistanceMatrix:MaxBatchDistanceKm") ?? 3.0;

            Shipping? matchingShipping = null;

            // Ưu tiên 1: Cùng người nhận (SĐT hoặc tên)
            matchingShipping = candidates.FirstOrDefault(shipping =>
            {
                return (!string.IsNullOrEmpty(normalizedPhone)
                        && normalizedPhone == NormalizePhone(shipping.ReceiverPhone))
                    || (!string.IsNullOrEmpty(normalizedReceiver)
                        && normalizedReceiver == NormalizeDeliveryText(shipping.ReceiverName));
            });

            // Ưu tiên 2: Khoảng cách đường đi thực tế giữa 2 địa chỉ <= maxBatchDist (3km)
            if (matchingShipping == null)
            {
                foreach (var candidate in candidates)
                {
                    var distance = await _distanceMatrixService.CalculateDistanceBetweenPointsAsync(address, candidate.Address);
                    if (distance <= maxBatchDist || IsNearbyDeliveryAddress(address, candidate.Address))
                    {
                        matchingShipping = candidate;
                        break;
                    }
                }
            }

            if (matchingShipping != null)
            {
                var batchCode = matchingShipping.DeliveryBatchCode;
                if (string.IsNullOrWhiteSpace(batchCode))
                {
                    batchCode = GenerateDeliveryBatchCode(now);
                    matchingShipping.DeliveryBatchCode = batchCode;
                }

                var estimatedDeliveryFromDate = requestedEstimatedDeliveryAt.HasValue
                    ? defaultWindow.FromDate
                    : matchingShipping.EstimatedDeliveryFromDate
                        ?? matchingShipping.EstimatedDeliveryAt?.Date
                        ?? defaultWindow.FromDate;
                var estimatedDeliveryToDate = requestedEstimatedDeliveryAt.HasValue
                    ? defaultWindow.ToDate
                    : matchingShipping.EstimatedDeliveryToDate
                        ?? matchingShipping.EstimatedDeliveryAt?.Date.AddDays(1)
                        ?? defaultWindow.ToDate;

                matchingShipping.EstimatedDeliveryFromDate ??= estimatedDeliveryFromDate;
                matchingShipping.EstimatedDeliveryToDate ??= estimatedDeliveryToDate;
                matchingShipping.EstimatedDeliveryAt ??= estimatedDeliveryFromDate;

                return new DeliveryPlan(
                    batchCode,
                    estimatedDeliveryFromDate,
                    estimatedDeliveryToDate);
            }

            return new DeliveryPlan(
                GenerateDeliveryBatchCode(now),
                defaultWindow.FromDate,
                defaultWindow.ToDate);
        }

        private static DeliveryWindow CalculateWindowFromDistance(DateTime now, double distanceKm)
        {
            var vietnamOffset = TimeSpan.FromHours(7);
            var localNow = new DateTimeOffset(now, TimeSpan.Zero).ToOffset(vietnamOffset);
            
            int deliveryDays = distanceKm <= 8.0 ? 1 : (distanceKm <= 25.0 ? 2 : 3);
            if (localNow.Hour >= 15)
            {
                deliveryDays += 1;
            }

            var fromDate = DateTime.SpecifyKind(localNow.Date.AddDays(deliveryDays), DateTimeKind.Utc);
            return new DeliveryWindow(fromDate, fromDate.AddDays(1));
        }

        private static DeliveryWindow CreateDeliveryWindow(DateTime fromDate, int rangeDays)
        {
            var normalizedFromDate = DateTime.SpecifyKind(fromDate.Date, DateTimeKind.Utc);
            return new DeliveryWindow(
                normalizedFromDate,
                normalizedFromDate.AddDays(Math.Max(1, rangeDays)));
        }

        private static string GenerateDeliveryBatchCode(DateTime now)
        {
            return $"DLV-{now:yyyyMMdd}-{Guid.NewGuid():N}"[..22].ToUpperInvariant();
        }

        private static string NormalizePhone(string? value)
        {
            return string.Concat((value ?? string.Empty)
                .Where(char.IsDigit));
        }

        private static string NormalizeDeliveryText(string? value)
        {
            var normalized = (value ?? string.Empty)
                .Trim()
                .ToLowerInvariant()
                .Replace('đ', 'd')
                .Normalize(NormalizationForm.FormD);

            return string.Concat(normalized.Where(character =>
                char.IsLetterOrDigit(character)
                && CharUnicodeInfo.GetUnicodeCategory(character)
                    != UnicodeCategory.NonSpacingMark));
        }

        private static bool IsNearbyDeliveryAddress(
            string address,
            string candidateAddress)
        {
            if (string.IsNullOrWhiteSpace(address) || string.IsNullOrWhiteSpace(candidateAddress))
                return false;

            var normA = NormalizeDeliveryText(address);
            var normB = NormalizeDeliveryText(candidateAddress);

            if (normA == normB) return true;

            var partsA = GetCleanAddressParts(address);
            var partsB = GetCleanAddressParts(candidateAddress);

            // 1. Kiểm tra nếu cùng tên đường hoặc cùng hẻm/ngõ (ví dụ cùng hẻm 100, cùng đường Tân Chánh Hiệp 07)
            bool sameAlleyOrStreet = partsA.Any(p => 
                (p.Contains("hem") || p.Contains("duong") || p.Contains("ngo") || p.Length >= 6) 
                && normB.Contains(p));

            if (sameAlleyOrStreet)
            {
                return true;
            }

            // 2. Trùng từ 2 thành phần địa danh trở lên (ví dụ cùng Phường, cùng Quận)
            var commonParts = partsA.Intersect(partsB).ToList();
            if (commonParts.Count >= 2)
            {
                return true;
            }

            return false;
        }

        private static List<string> GetCleanAddressParts(string address)
        {
            var rawParts = address.Split(new[] { ',', '-' }, StringSplitOptions.RemoveEmptyEntries);
            var list = new List<string>();

            for (int i = 0; i < rawParts.Length; i++)
            {
                var norm = NormalizeDeliveryText(rawParts[i]);
                if (string.IsNullOrWhiteSpace(norm) || norm.Length < 3) continue;

                // Bỏ qua số nhà ở phần đầu nếu chỉ gồm chữ số/ký hiệu (473m, 50, 12a)
                if (i == 0 && norm.All(c => char.IsDigit(c) || c == '/' || c == 'm' || c == 'a' || c == 'b' || c == 'c'))
                {
                    continue;
                }

                list.Add(norm);
            }

            return list;
        }

        private async Task<List<Promotion>> GetActivePromotionsAsync()
        {
            var now = DateTime.UtcNow;

            return await _context.Promotions
                .Include(promotion => promotion.PromotionProducts)
                .Include(promotion => promotion.PromotionConditions)
                .Where(promotion => promotion.Status == 1
                    && promotion.StartDate <= now
                    && promotion.EndDate >= now)
                .ToListAsync();
        }

        private static Promotion? FindBestPromotion(
            IEnumerable<Promotion> promotions,
            int variantId,
            decimal unitPrice,
            decimal orderSubtotal,
            int totalItemQuantity,
            int? categoryId,
            int? brandId)
        {
            return promotions
                .Where(promotion =>
                    (promotion.PromotionProducts.Any(product =>
                            product.VariantId == variantId))
                    && promotion.PromotionConditions.All(condition =>
                        (!condition.MinimumOrderValue.HasValue
                            || orderSubtotal >= condition.MinimumOrderValue.Value)
                        && (!condition.MinimumQuantity.HasValue
                            || totalItemQuantity >= condition.MinimumQuantity.Value)
                        && (!condition.CategoryId.HasValue
                            || condition.CategoryId.Value == categoryId)
                        && (!condition.BrandId.HasValue
                            || condition.BrandId.Value == brandId)
                        && !condition.CustomerLevel.HasValue))
                .OrderByDescending(promotion =>
                    CalculatePromotionDiscount(unitPrice, promotion))
                .ThenByDescending(promotion => promotion.Priority)
                .ThenBy(promotion => promotion.PromotionId)
                .FirstOrDefault();
        }

        private static decimal CalculatePromotionDiscount(
            decimal price,
            Promotion promotion)
        {
            var discount = promotion.PromotionType == 0
                ? price * promotion.DiscountValue / 100m
                : promotion.DiscountValue;

            if (promotion.MaximumDiscount.HasValue)
                discount = Math.Min(discount,
                    promotion.MaximumDiscount.Value);

            return Math.Min(price, Math.Max(0, discount));
        }

        private async Task<Voucher?> GetVoucherForCheckoutAsync(
            string? voucherCode,
            decimal merchandiseTotal,
            int? customerId)
        {
            if (string.IsNullOrWhiteSpace(voucherCode))
                return null;

            var normalizedCode = voucherCode.Trim().ToUpperInvariant();
            var voucher = await _context.Vouchers
                .FirstOrDefaultAsync(item =>
                    item.Code.ToUpper() == normalizedCode);

            if (voucher == null)
                throw new Exception("Không tìm thấy mã voucher.");

            var now = DateTime.UtcNow;
            if (voucher.Status != 1
                || voucher.StartDate > now
                || voucher.EndDate < now)
            {
                throw new Exception("Voucher không còn hiệu lực.");
            }

            var isRewardVoucher = voucher.RequiredPoints > 0;
            if (!isRewardVoucher && voucher.UsageLimit > 0
                && voucher.UsedCount >= voucher.UsageLimit)
            {
                throw new Exception("Voucher đã hết lượt sử dụng.");
            }

            if (voucher.MinimumOrderValue.HasValue
                && merchandiseTotal < voucher.MinimumOrderValue.Value)
            {
                throw new Exception(
                    "Đơn hàng chưa đạt giá trị tối thiểu để sử dụng voucher.");
            }

            if (isRewardVoucher)
            {
                if (!customerId.HasValue)
                    throw new Exception("Voucher đổi điểm chỉ áp dụng cho tài khoản đã đổi voucher.");

                var hasRedeemed = await _context.LoyaltyTransactions.AnyAsync(transaction =>
                    transaction.CustomerId == customerId.Value
                    && transaction.VoucherId == voucher.VoucherId
                    && transaction.TransactionType == 2);
                if (!hasRedeemed)
                    throw new Exception("Bạn cần đổi voucher này bằng điểm trước khi sử dụng.");

                var hasUsedReward = await _context.VoucherUsages.AnyAsync(usage =>
                    usage.VoucherId == voucher.VoucherId
                    && usage.CustomerId == customerId.Value);
                if (hasUsedReward)
                    throw new Exception("Voucher đổi điểm này đã được sử dụng.");
            }

            if (!isRewardVoucher && customerId.HasValue
                && voucher.UsageLimitPerCustomer.HasValue)
            {
                var usageCount = await _context.VoucherUsages.CountAsync(usage =>
                    usage.VoucherId == voucher.VoucherId
                    && usage.CustomerId == customerId.Value);

                if (usageCount >= voucher.UsageLimitPerCustomer.Value)
                {
                    throw new Exception(
                        "Khách hàng đã đạt giới hạn sử dụng voucher.");
                }
            }

            return voucher;
        }

        private static decimal CalculateVoucherDiscount(
            decimal merchandiseTotal,
            Voucher voucher)
        {
            var discount = voucher.DiscountType == 0
                ? merchandiseTotal * voucher.DiscountValue / 100m
                : voucher.DiscountValue;

            if (voucher.MaximumDiscount.HasValue)
                discount = Math.Min(discount,
                    voucher.MaximumDiscount.Value);

            return Math.Min(merchandiseTotal, Math.Max(0, discount));
        }

        private static OrderDto MapToDto(Order order)
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

                OrderDetails = order.OrderDetails?
                    .Select(x => new OrderDetailDto
                    {
                        OrderDetailId = x.OrderDetailId,
                        OrderId = x.OrderId,
                        VariantId = x.VariantId,
                        Quantity = x.Quantity,
                        UnitPrice = x.UnitPrice,
                        DiscountAmount = x.DiscountAmount,
                        TotalAmount = x.TotalAmount
                    })
                    .ToList()
                    ?? new List<OrderDetailDto>(),

                Payment = order.Payment == null
                    ? null
                    : MapPaymentToDto(order.Payment),

                Shipping = order.Shipping == null
                    ? null
                    : MapShippingToDto(order.Shipping)
            };
        }

        private static PaymentDto MapPaymentToDto(Payment payment)
        {
            return new PaymentDto
            {
                PaymentId = payment.PaymentId,
                OrderId = payment.OrderId,
                PaymentMethod = payment.PaymentMethod,
                TransactionCode = payment.TransactionCode,
                Amount = payment.Amount,
                Status = payment.Status,
                PaidAt = payment.PaidAt,
                CreatedAt = payment.CreatedAt
            };
        }

        private static ShippingDto MapShippingToDto(Shipping shipping)
        {
            return new ShippingDto
            {
                ShippingId = shipping.ShippingId,
                OrderId = shipping.OrderId,
                ReceiverName = shipping.ReceiverName,
                ReceiverPhone = shipping.ReceiverPhone,
                Address = shipping.Address,
                ShippingMethod = shipping.ShippingMethod,
                TrackingCode = shipping.TrackingCode,
                ShippingFee = shipping.ShippingFee,
                DeliveryBatchCode = shipping.DeliveryBatchCode,
                EstimatedDeliveryAt = shipping.EstimatedDeliveryAt,
                EstimatedDeliveryFromDate = shipping.EstimatedDeliveryFromDate
                    ?? shipping.EstimatedDeliveryAt?.Date,
                EstimatedDeliveryToDate = shipping.EstimatedDeliveryToDate
                    ?? shipping.EstimatedDeliveryAt?.Date.AddDays(1),
                Status = shipping.Status,
                ShippedAt = shipping.ShippedAt,
                DeliveredAt = shipping.DeliveredAt
            };
        }

        public async Task<DeliveryEstimateResponseDto> CalculateDeliveryEstimateAsync(
            CalculateDeliveryEstimateRequestDto request)
        {
            var distanceInfo = await _distanceMatrixService.CalculateDistanceToWarehouseAsync(
                request.CustomerAddress,
                request.DestinationLat,
                request.DestinationLng);

            var now = DateTime.UtcNow;
            var window = CalculateWindowFromDistance(now, distanceInfo.DistanceInKm);

            var warehouseName = _configuration["Warehouse:Name"] ?? "Kho Tổng ToyStore";
            var warehouseAddress = _configuration["Warehouse:Address"] ?? "123 Nguyễn Thị Minh Khai, Q.1, TP.HCM";

            return new DeliveryEstimateResponseDto
            {
                WarehouseName = warehouseName,
                WarehouseAddress = warehouseAddress,
                DistanceInKm = distanceInfo.DistanceInKm,
                DistanceText = $"{distanceInfo.DistanceInKm:0.#} km",
                DurationInMinutes = distanceInfo.DurationInMinutes,
                DurationText = $"{distanceInfo.DurationInMinutes} phút",
                EstimatedDeliveryFromDate = window.FromDate,
                EstimatedDeliveryToDate = window.ToDate,
                IsSameDayEligible = distanceInfo.DistanceInKm <= 5.0 && DateTime.UtcNow.AddHours(7).Hour < 12
            };
        }

        public async Task<IEnumerable<BatchSuggestionDto>> GetBatchSuggestionsAsync(
            double maxDistanceKm = 3.0)
        {
            var now = DateTime.UtcNow;
            var pendingShippings = await _context.Shippings
                .Include(s => s.Order)
                .Where(s => s.Status == 0
                    && s.ShippedAt == null
                    && s.Order.OrderDate >= now.AddHours(-48)
                    && s.Order.Status != 5)
                .ToListAsync();

            if (pendingShippings.Count < 2)
            {
                return Enumerable.Empty<BatchSuggestionDto>();
            }

            int n = pendingShippings.Count;
            var adj = new List<int>[n];
            for (int i = 0; i < n; i++) adj[i] = new List<int>();

            // Xây dựng đồ thị liên kết: nếu 2 đơn cùng SĐT hoặc cùng tuyến đường/cự ly gần thì tạo cạnh kết nối
            for (int i = 0; i < n; i++)
            {
                var shipA = pendingShippings[i];
                var phoneA = NormalizePhone(shipA.ReceiverPhone);

                for (int j = i + 1; j < n; j++)
                {
                    var shipB = pendingShippings[j];
                    var phoneB = NormalizePhone(shipB.ReceiverPhone);

                    bool isConnected = false;

                    // 1. Cùng mã lô đã gán từ trước
                    if (!string.IsNullOrWhiteSpace(shipA.DeliveryBatchCode) &&
                        string.Equals(shipA.DeliveryBatchCode, shipB.DeliveryBatchCode, StringComparison.OrdinalIgnoreCase))
                    {
                        isConnected = true;
                    }
                    // 2. Cùng người nhận (số điện thoại)
                    else if (!string.IsNullOrWhiteSpace(phoneA) && string.Equals(phoneA, phoneB, StringComparison.OrdinalIgnoreCase))
                    {
                        isConnected = true;
                    }
                    // 3. Cùng tuyến đường / hẻm / địa danh lân cận
                    else if (IsNearbyDeliveryAddress(shipA.Address, shipB.Address))
                    {
                        isConnected = true;
                    }
                    else
                    {
                        var dist = await _distanceMatrixService.CalculateDistanceBetweenPointsAsync(shipA.Address, shipB.Address);
                        if (dist <= maxDistanceKm)
                        {
                            isConnected = true;
                        }
                    }

                    if (isConnected)
                    {
                        adj[i].Add(j);
                        adj[j].Add(i);
                    }
                }
            }

            var visited = new bool[n];
            var suggestions = new List<BatchSuggestionDto>();

            for (int i = 0; i < n; i++)
            {
                if (visited[i]) continue;

                var componentIndices = new List<int>();
                var queue = new Queue<int>();

                visited[i] = true;
                queue.Enqueue(i);

                while (queue.Count > 0)
                {
                    var u = queue.Dequeue();
                    componentIndices.Add(u);

                    foreach (var v in adj[u])
                    {
                        if (!visited[v])
                        {
                            visited[v] = true;
                            queue.Enqueue(v);
                        }
                    }
                }

                // Cụm có ít nhất 2 đơn
                if (componentIndices.Count >= 2)
                {
                    var cluster = componentIndices.Select(idx => pendingShippings[idx]).ToList();
                    var clusterIds = cluster.Select(s => s.OrderId).ToList();

                    var batchCode = cluster.FirstOrDefault(s => !string.IsNullOrEmpty(s.DeliveryBatchCode))?.DeliveryBatchCode
                        ?? GenerateDeliveryBatchCode(now);

                    var uniquePhones = cluster
                        .Where(s => !string.IsNullOrWhiteSpace(s.ReceiverPhone))
                        .Select(s => s.ReceiverPhone.Trim())
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToList();

                    string reason;
                    string? receiverPhone;
                    string commonAddress;

                    if (uniquePhones.Count <= 1)
                    {
                        reason = "Cùng người nhận & số điện thoại";
                        receiverPhone = uniquePhones.FirstOrDefault() ?? cluster.First().ReceiverPhone;
                        commonAddress = cluster.First().Address;
                    }
                    else
                    {
                        reason = $"Tuyến đường lân cận ({cluster.Count} đơn cùng khu vực / Bán kính <= {maxDistanceKm:0.#} km)";
                        receiverPhone = $"{uniquePhones.Count} người nhận ({string.Join(", ", uniquePhones.Take(2))}{(uniquePhones.Count > 2 ? "..." : "")})";
                        commonAddress = ExtractCommonAreaDescription(cluster.Select(s => s.Address).ToList());
                    }

                    suggestions.Add(new BatchSuggestionDto
                    {
                        Reason = reason,
                        TargetBatchCode = batchCode,
                        ReceiverPhone = receiverPhone,
                        CommonAddressArea = commonAddress,
                        OrderIds = clusterIds,
                        OrderCodes = cluster.Select(s => s.Order.OrderCode).ToList()
                    });
                }
            }

            return suggestions;
        }

        private static string ExtractCommonAreaDescription(List<string> addresses)
        {
            if (addresses == null || addresses.Count == 0) return "Khu vực lân cận";
            if (addresses.Count == 1) return addresses[0];

            var firstParts = addresses[0].Split(new[] { ',', '-' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(p => p.Trim())
                .ToList();

            var common = new List<string>();
            foreach (var part in firstParts)
            {
                var normPart = NormalizeDeliveryText(part);
                if (normPart.Length >= 4 && addresses.All(a => NormalizeDeliveryText(a).Contains(normPart)))
                {
                    common.Add(part);
                }
            }

            if (common.Count > 0)
            {
                return string.Join(", ", common);
            }

            return addresses[0];
        }

        public async Task<bool> MergeBatchAsync(MergeBatchRequestDto request)
        {
            if (request.OrderIds == null || request.OrderIds.Count < 2)
                throw new InvalidOperationException("Cần chọn ít nhất 2 đơn hàng để gộp lô.");

            var shippings = await _context.Shippings
                .Where(s => request.OrderIds.Contains(s.OrderId))
                .ToListAsync();

            if (shippings.Count == 0) return false;

            var batchCode = !string.IsNullOrWhiteSpace(request.BatchCode)
                ? request.BatchCode.Trim()
                : GenerateDeliveryBatchCode(DateTime.UtcNow);

            var earliestDate = shippings.Min(s => s.EstimatedDeliveryFromDate);

            foreach (var shipping in shippings)
            {
                shipping.DeliveryBatchCode = batchCode;
                if (earliestDate.HasValue)
                {
                    shipping.EstimatedDeliveryFromDate = earliestDate;
                    shipping.EstimatedDeliveryToDate = earliestDate.Value.AddDays(1);
                    shipping.EstimatedDeliveryAt = earliestDate;
                }
            }

            await _unitOfWork.SaveChangesAsync();
            return true;
        }

        public async Task<bool> DispatchBatchAsync(string batchCode)
        {
            if (string.IsNullOrWhiteSpace(batchCode))
                throw new ArgumentException("Mã lô không hợp lệ.");

            var shippings = await _context.Shippings
                .Include(s => s.Order)
                .Where(s => s.DeliveryBatchCode == batchCode.Trim())
                .ToListAsync();

            if (shippings.Count == 0) return false;

            var now = DateTime.UtcNow;
            foreach (var shipping in shippings)
            {
                shipping.ShippedAt = now;
                shipping.Status = 1; // 1: Đang giao hàng

                if (shipping.Order != null && shipping.Order.Status != 4 && shipping.Order.Status != 5)
                {
                    shipping.Order.Status = 3; // 3: Đang giao
                    shipping.Order.UpdatedAt = now;
                }
            }

            await _unitOfWork.SaveChangesAsync();
            return true;
        }

        private sealed record DeliveryPlan(
            string BatchCode,
            DateTime EstimatedDeliveryFromDate,
            DateTime EstimatedDeliveryToDate);

        private sealed record DeliveryWindow(
            DateTime FromDate,
            DateTime ToDate);
    }
}
