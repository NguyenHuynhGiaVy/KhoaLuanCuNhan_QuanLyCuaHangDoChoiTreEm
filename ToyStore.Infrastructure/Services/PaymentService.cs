using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStoreManagement.Application.DTOs.Order;
using ToyStoreManagement.Application.Interfaces.Repositories;
using ToyStoreManagement.Application.Interfaces.Services;

namespace ToyStoreManagement.Infrastructure.Services
{
    public class PaymentService : IPaymentService
    {
        private readonly IPaymentRepository _paymentRepository;

        public PaymentService(
            IPaymentRepository paymentRepository)
        {
            _paymentRepository = paymentRepository;
        }

        public async Task<IEnumerable<PaymentDto>> GetAllAsync()
        {
            var payments = await _paymentRepository
                .GetAllWithDetailsAsync();

            return payments.Select(MapToDto);
        }

        public async Task<PaymentDto?> GetByIdAsync(int paymentId)
        {
            var payment = await _paymentRepository
                .GetByIdWithDetailsAsync(paymentId);

            return payment == null ? null : MapToDto(payment);
        }

        public async Task<PaymentDto?> GetByOrderIdAsync(int orderId)
        {
            var payment = await _paymentRepository
                .GetByOrderIdAsync(orderId);

            return payment == null ? null : MapToDto(payment);
        }

        private static PaymentDto MapToDto(
            Domain.Entities.Payment payment)
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
    }
}
