using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStoreManagement.Application.DTOs.Order;
using ToyStoreManagement.Application.Interfaces;
using ToyStoreManagement.Application.Interfaces.Repositories;
using ToyStoreManagement.Application.Interfaces.Services;
using ToyStoreManagement.Domain.Entities;
using ToyStore.Application.Interfaces.Repositories;

namespace ToyStoreManagement.Infrastructure.Services
{
    public class OrderService : IOrderService
    {
        private readonly IOrderRepository _orderRepository;
        private readonly IPaymentRepository _paymentRepository;
        private readonly IGenericRepository<ProductVariant> _variantRepository;
        private readonly IGenericRepository<Shipping> _shippingRepository;
        private readonly IUnitOfWork _unitOfWork;

        public OrderService(
            IOrderRepository orderRepository,
            IPaymentRepository paymentRepository,
            IGenericRepository<ProductVariant> variantRepository,
            IGenericRepository<Shipping> shippingRepository,
            IUnitOfWork unitOfWork)
        {
            _orderRepository = orderRepository;
            _paymentRepository = paymentRepository;
            _variantRepository = variantRepository;
            _shippingRepository = shippingRepository;
            _unitOfWork = unitOfWork;
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

            foreach (var detail in dto.OrderDetails)
            {
                if (detail.Quantity <= 0)
                    throw new Exception("Số lượng sản phẩm phải lớn hơn 0.");

                var variant = await _variantRepository
                    .GetByIdAsync(detail.VariantId);

                if (variant == null)
                    throw new Exception(
                        $"Không tìm thấy biến thể sản phẩm ID {detail.VariantId}.");
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
            }

            order.Subtotal = subtotal;

            order.TotalAmount =
                order.Subtotal
                - order.DiscountAmount
                + order.ShippingFee;

            await _orderRepository.AddAsync(order);
            await _unitOfWork.SaveChangesAsync();

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

            if (dto.DiscountAmount < 0)
                throw new Exception(
                    "Số tiền giảm giá không hợp lệ.");

            if (dto.ShippingFee < 0)
                throw new Exception(
                    "Phí vận chuyển không hợp lệ.");

            if (dto.DiscountAmount > order.Subtotal)
                throw new Exception(
                    "Số tiền giảm giá không được lớn hơn tổng tiền sản phẩm.");

            order.Status = dto.Status;
            order.DiscountAmount = dto.DiscountAmount;
            order.ShippingFee = dto.ShippingFee;
            order.Note = dto.Note;

            order.TotalAmount =
                order.Subtotal
                - order.DiscountAmount
                + order.ShippingFee;

            order.UpdatedAt = DateTime.UtcNow;

            _orderRepository.Update(order);
            await _unitOfWork.SaveChangesAsync();

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
                Note = order.Note,
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
                Status = shipping.Status,
                ShippedAt = shipping.ShippedAt,
                DeliveredAt = shipping.DeliveredAt
            };
        }
    }
}
