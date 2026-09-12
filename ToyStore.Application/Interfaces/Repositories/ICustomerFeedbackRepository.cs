using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStore.Application.Interfaces.Repositories;
using ToyStoreManagement.Domain.Entities;

namespace ToyStoreManagement.Application.Interfaces.Repositories
{
    public interface ICustomerFeedbackRepository : IGenericRepository<CustomerFeedback>
    {
        Task<IEnumerable<CustomerFeedback>> GetAllWithDetailsAsync();
        Task<CustomerFeedback?> GetByIdWithDetailsAsync(long customerFeedbackId);
        Task<IEnumerable<CustomerFeedback>> GetByCustomerIdAsync(int customerId);
        Task<IEnumerable<CustomerFeedback>> GetByOrderIdAsync(int orderId);
    }
}