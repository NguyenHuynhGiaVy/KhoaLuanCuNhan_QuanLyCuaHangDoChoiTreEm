using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStore.Application.Interfaces.Repositories;
using ToyStoreManagement.Domain.Entities;

namespace ToyStoreManagement.Application.Interfaces.Repositories
{
    public interface IReturnRequestRepository : IGenericRepository<ReturnRequest>
    {
        Task<IEnumerable<ReturnRequest>> GetAllWithDetailsAsync();
        Task<ReturnRequest?> GetByIdWithDetailsAsync(int returnRequestId);
        Task<IEnumerable<ReturnRequest>> GetByCustomerIdAsync(int customerId);
        Task<IEnumerable<ReturnRequest>> GetByOrderIdAsync(int orderId);
        Task<ReturnRequest?> GetByReturnCodeAsync(string returnCode);
    }
}