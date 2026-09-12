using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStoreManagement.Domain.Entities;
using ToyStore.Application.Interfaces.Repositories;

namespace ToyStoreManagement.Application.Interfaces.Repositories
{
    public interface IPaymentRepository : IGenericRepository<Payment>
    {
        Task<IEnumerable<Payment>> GetAllWithDetailsAsync();

        Task<Payment?> GetByIdWithDetailsAsync(int paymentId);

        Task<Payment?> GetByOrderIdAsync(int orderId);
    }
}