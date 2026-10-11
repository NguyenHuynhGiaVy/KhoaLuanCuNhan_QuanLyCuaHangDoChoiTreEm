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
using ToyStoreManagement.Infrastructure.Data;
using ToyStoreManagement.Domain.Common;

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

        public OrderService(
            IOrderRepository orderRepository,
            IPaymentRepository paymentRepository,
            IGenericRepository<ProductVariant> variantRepository,
            IGenericRepository<Shipping> shippingRepository,
            IUnitOfWork unitOfWork,
            ApplicationDbContext context)
        {
            _orderRepository = orderRepository;
            _paymentRepository = paymentRepository;
            _variantRepository = variantRepository;
            _shippingRepository = shippingRepository;
            _unitOfWork = unitOfWork;
            _context = context;
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

            if (dto.PaymentMethod is < 0 or > 2)
                throw new Exception("Phương thức thanh toán không hợp lệ.");

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
            decimal originalSubtotal = 0;
            var totalItemQuantity = 0;

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

                originalSubtotal += variant.Price * detail.Quantity;
                totalItemQuantity += detail.Quantity;
            }

            var activePromotions = await GetActivePromotionsAsync();
            var variantIds = dto.OrderDetails
                .Select(detail => detail.VariantId)
                .Distinct()
                .ToList();
            var variantProductInfo = await _context.ProductVariants
                .AsNoTracking()
                .Where(variant => variantIds.Contains(variant.VariantId))
                .Select(variant => new
                {
                    variant.VariantId,
                    variant.Product.CategoryId,
                    variant.Product.BrandId
                })
                .ToDictionaryAsync(variant => variant.VariantId);

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
            decimal productPromotionDiscount = 0;

            foreach (var detailDto in dto.OrderDetails)
            {
                var variant = await _variantRepository
                    .GetByIdAsync(detailDto.VariantId)
                    ?? throw new Exception(
                        $"Không tìm thấy biến thể sản phẩm ID {detailDto.VariantId}.");
                variantProductInfo.TryGetValue(
                    detailDto.VariantId,
                    out var productInfo);

                var lineAmount = variant.Price * detailDto.Quantity;
                var promotion = FindBestPromotion(
                    activePromotions,
                    detailDto.VariantId,
                    variant.Price,
                    originalSubtotal,
                    totalItemQuantity,
                    productInfo?.CategoryId,
                    productInfo?.BrandId);
                var unitPromotionDiscount = promotion == null
                    ? 0
                    : CalculatePromotionDiscount(variant.Price, promotion);
                var lineDiscount = unitPromotionDiscount * detailDto.Quantity;
                var totalAmount = lineAmount - lineDiscount;

                var detail = new OrderDetail
                {
                    VariantId = detailDto.VariantId,
                    Quantity = detailDto.Quantity,
                    UnitPrice = variant.Price,
                    DiscountAmount = lineDiscount,
                    TotalAmount = totalAmount
                };

                order.OrderDetails.Add(detail);
                subtotal += lineAmount;
                productPromotionDiscount += lineDiscount;

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

            var merchandiseTotal = subtotal - productPromotionDiscount;
            var voucher = await GetVoucherForCheckoutAsync(
                dto.VoucherCode,
                merchandiseTotal,
                dto.CustomerId);
            var voucherDiscount = voucher == null
                ? 0
                : CalculateVoucherDiscount(merchandiseTotal, voucher);

            order.Subtotal = subtotal;
            order.DiscountAmount = productPromotionDiscount + voucherDiscount;
            order.ShippingFee = merchandiseTotal >= 500000 ? 0 : 30000;

            order.TotalAmount =
                order.Subtotal
                - order.DiscountAmount
                + order.ShippingFee;

            await _orderRepository.AddAsync(order);
            await _unitOfWork.SaveChangesAsync();

            if (voucher != null)
            {
                _context.VoucherUsages.Add(new VoucherUsage
                {
                    VoucherId = voucher.VoucherId,
                    OrderId = order.OrderId,
                    CustomerId = dto.CustomerId,
                    DiscountAmount = voucherDiscount,
                    UsedAt = DateTime.UtcNow
                });
                // Lượt của voucher đổi điểm đã được giữ chỗ từ lúc khách đổi điểm.
                if (voucher.RequiredPoints <= 0)
                    voucher.UsedCount++;
                voucher.UpdatedAt = DateTime.UtcNow;
            }

            var deliveryPlan = await ResolveDeliveryPlanAsync(
                dto.Shipping.ReceiverName,
                dto.Shipping.ReceiverPhone,
                dto.Shipping.Address);

            _context.Shippings.Add(new Shipping
            {
                OrderId = order.OrderId,
                ReceiverName = dto.Shipping.ReceiverName.Trim(),
                ReceiverPhone = dto.Shipping.ReceiverPhone.Trim(),
                Address = dto.Shipping.Address.Trim(),
                ShippingMethod = dto.Shipping.ShippingMethod,
                TrackingCode = !string.IsNullOrWhiteSpace(dto.Shipping.TrackingCode) ? dto.Shipping.TrackingCode.Trim() : $"TRK-{order.OrderCode}",
                ShippingFee = order.ShippingFee,
                DeliveryBatchCode = deliveryPlan.BatchCode,
                // Trường cũ được giữ để tương thích dữ liệu, giao diện sử dụng khoảng ngày.
                EstimatedDeliveryAt = deliveryPlan.EstimatedDeliveryFromDate,
                EstimatedDeliveryFromDate = deliveryPlan.EstimatedDeliveryFromDate,
                EstimatedDeliveryToDate = deliveryPlan.EstimatedDeliveryToDate,
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

                ProductStockStatus.Synchronize(product, totalQuantity);

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
            ValidateStatusTransition(oldStatus, dto.Status);
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

                // Điểm chỉ thuộc về khách hàng đã gắn sẵn với đơn hàng. Không tự
                // ghép theo số điện thoại người nhận vì số này có thể dùng chung.
                int? targetCustomerId = order.CustomerId;

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

                ProductStockStatus.Synchronize(product, totalQuantity);

                product.UpdatedAt = DateTime.UtcNow;
            }

            await _unitOfWork.SaveChangesAsync();
            await transaction.CommitAsync();

            return MapToDto(order);
        }

        private static void ValidateStatusTransition(int currentStatus, int nextStatus)
        {
            const int pendingConfirmation = 0;
            const int completed = 4;
            const int cancelled = 5;

            if (nextStatus < pendingConfirmation || nextStatus > cancelled)
                throw new Exception("Trạng thái đơn hàng không hợp lệ.");

            // Giữ nguyên trạng thái khi nhân viên chỉ thay đổi thông tin khác của đơn hàng.
            if (nextStatus == currentStatus)
                return;

            if (currentStatus < pendingConfirmation || currentStatus > cancelled)
                throw new Exception("Trạng thái hiện tại của đơn hàng không hợp lệ.");

            if (currentStatus == completed || currentStatus == cancelled)
                throw new Exception("Đơn hàng đã hoàn tất hoặc đã hủy nên không thể đổi trạng thái.");

            // Đơn còn hiệu lực có thể hủy, nhưng không thể bỏ qua giai đoạn giao hàng.
            if (nextStatus == cancelled)
                return;

            if (nextStatus != currentStatus + 1)
            {
                throw new Exception(
                    "Đơn hàng phải đi lần lượt qua các bước: Chờ xác nhận → Đã xác nhận → Đang xử lý → Đang giao → Hoàn tất.");
            }
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

            var deliveryPlan = await ResolveDeliveryPlanAsync(
                dto.ReceiverName,
                dto.ReceiverPhone,
                dto.Address,
                dto.EstimatedDeliveryAt);

            var shipping = new Shipping
            {
                OrderId = orderId,
                ReceiverName = dto.ReceiverName,
                ReceiverPhone = dto.ReceiverPhone,
                Address = dto.Address,
                ShippingMethod = dto.ShippingMethod,
                TrackingCode = !string.IsNullOrWhiteSpace(dto.TrackingCode) ? dto.TrackingCode.Trim() : $"TRK-{order.OrderCode}",
                ShippingFee = dto.ShippingFee,
                DeliveryBatchCode = deliveryPlan.BatchCode,
                // Trường cũ được giữ để tương thích dữ liệu, giao diện sử dụng khoảng ngày.
                EstimatedDeliveryAt = deliveryPlan.EstimatedDeliveryFromDate,
                EstimatedDeliveryFromDate = deliveryPlan.EstimatedDeliveryFromDate,
                EstimatedDeliveryToDate = deliveryPlan.EstimatedDeliveryToDate,
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
            var defaultWindow = requestedEstimatedDeliveryAt.HasValue
                ? CreateDeliveryWindow(requestedEstimatedDeliveryAt.Value, 1)
                : GetDefaultDeliveryWindow(now, address);

            // Chỉ gộp các đơn chưa xuất kho, phát sinh trong 24 giờ gần đây;
            // nhờ vậy lô giao luôn có thể điều phối lại trước khi bàn giao.
            var candidates = await _context.Shippings
                .Include(shipping => shipping.Order)
                .Where(shipping => shipping.Status == 0
                    && shipping.ShippedAt == null
                    && shipping.Order.OrderDate >= now.AddHours(-24)
                    && shipping.Order.Status != 5)
                .ToListAsync();

            var matchingShipping = candidates.FirstOrDefault(shipping =>
            {
                var sameRecipient =
                    (!string.IsNullOrEmpty(normalizedPhone)
                        && normalizedPhone == NormalizePhone(shipping.ReceiverPhone))
                    || (!string.IsNullOrEmpty(normalizedReceiver)
                        && normalizedReceiver == NormalizeDeliveryText(shipping.ReceiverName));

                return sameRecipient
                    || IsNearbyDeliveryAddress(address, shipping.Address);
            });

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

        private static DeliveryWindow GetDefaultDeliveryWindow(DateTime now, string address)
        {
            var vietnamOffset = TimeSpan.FromHours(7);
            var localNow = new DateTimeOffset(now, TimeSpan.Zero)
                .ToOffset(vietnamOffset);
            var normalizedAddress = NormalizeDeliveryText(address);
            var isInnerCity = normalizedAddress.Contains("hanoi")
                || normalizedAddress.Contains("hochiminh")
                || normalizedAddress.Contains("saigon")
                || normalizedAddress.Contains("danang");
            var deliveryDays = (localNow.Hour >= 14 ? 3 : 2) + (isInnerCity ? 0 : 1);
            return CreateDeliveryWindow(localNow.Date.AddDays(deliveryDays), isInnerCity ? 1 : 2);
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
            if (string.IsNullOrWhiteSpace(address))
                return false;

            var requestedAreas = GetAddressAreaParts(address);
            var candidateAreas = GetAddressAreaParts(candidateAddress);

            return requestedAreas.Count >= 2
                && candidateAreas.Count >= 2
                && requestedAreas.Intersect(candidateAreas).Count() >= 2;
        }

        private static HashSet<string> GetAddressAreaParts(string address)
        {
            // So sánh hai thành phần địa lý cuối (thường là quận/huyện và
            // tỉnh/thành), không so sánh số nhà để tránh gom nhầm theo tên phố.
            return address
                .Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(NormalizeDeliveryText)
                .Where(part => part.Length >= 3)
                .TakeLast(2)
                .ToHashSet();
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
                GatewayTransactionCode = payment.GatewayTransactionCode,
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

        private sealed record DeliveryPlan(
            string BatchCode,
            DateTime EstimatedDeliveryFromDate,
            DateTime EstimatedDeliveryToDate);

        private sealed record DeliveryWindow(
            DateTime FromDate,
            DateTime ToDate);
    }
}
