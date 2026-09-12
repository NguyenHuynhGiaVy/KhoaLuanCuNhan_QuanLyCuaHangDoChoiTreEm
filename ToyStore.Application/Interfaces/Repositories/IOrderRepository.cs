using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStoreManagement.Domain.Entities;
using ToyStore.Application.Interfaces.Repositories;

namespace ToyStoreManagement.Application.Interfaces.Repositories
{
    public interface IOrderRepository : IGenericRepository<Order>
    {
        Task<IEnumerable<Order>> GetAllWithDetailsAsync();

        Task<Order?> GetByIdWithDetailsAsync(int orderId);

        Task<Order?> GetByOrderCodeAsync(string orderCode);

        Task<IEnumerable<Order>> GetByCustomerIdAsync(int customerId);
    }
}