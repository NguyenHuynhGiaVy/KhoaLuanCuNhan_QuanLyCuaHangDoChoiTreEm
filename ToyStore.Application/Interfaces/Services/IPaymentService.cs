using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStoreManagement.Application.DTOs.Order;

namespace ToyStoreManagement.Application.Interfaces.Services
{
    public interface IPaymentService
    {
        Task<IEnumerable<PaymentDto>> GetAllAsync();

        Task<PaymentDto?> GetByIdAsync(int paymentId);

        Task<PaymentDto?> GetByOrderIdAsync(int orderId);
    }
}