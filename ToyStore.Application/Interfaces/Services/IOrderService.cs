using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

using System.Collections.Generic;
using System.Threading.Tasks;
using ToyStoreManagement.Application.DTOs.Order;

namespace ToyStoreManagement.Application.Interfaces.Services
{
    public interface IOrderService
    {
        Task<IEnumerable<OrderDto>> GetAllAsync();

        Task<OrderDto?> GetByIdAsync(int orderId);

        Task<OrderDto?> GetByOrderCodeAsync(string orderCode);

        Task<IEnumerable<OrderDto>>
            GetByCustomerIdAsync(int customerId);

        Task<OrderDto> CreateAsync(CreateOrderDto dto);

        Task<OrderDto?> UpdateAsync(
            int orderId,
            UpdateOrderDto dto);

        Task<bool> DeleteAsync(int orderId);

        Task<PaymentDto?> GetPaymentAsync(int orderId);

        Task<ShippingDto?> GetShippingAsync(int orderId);

        Task<PaymentDto> AddPaymentAsync(
            int orderId,
            CreatePaymentDto dto);

        Task<ShippingDto> AddShippingAsync(
            int orderId,
            CreateShippingDto dto);
    }
}
