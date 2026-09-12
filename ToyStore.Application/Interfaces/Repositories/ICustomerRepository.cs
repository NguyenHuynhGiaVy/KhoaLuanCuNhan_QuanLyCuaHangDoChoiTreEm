using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStoreManagement.Domain.Entities;
using ToyStore.Application.Interfaces.Repositories;

namespace ToyStoreManagement.Application.Interfaces.Repositories
{
    public interface ICustomerRepository : IGenericRepository<Customer>
    {
        Task<IEnumerable<Customer>> GetAllWithDetailsAsync();

        Task<Customer?> GetByIdWithDetailsAsync(int customerId);

        Task<Customer?> GetByUserIdAsync(string userId);
    }
}
