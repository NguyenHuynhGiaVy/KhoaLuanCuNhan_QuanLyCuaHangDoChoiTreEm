using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStoreManagement.Domain.Entities;
using ToyStore.Application.Interfaces.Repositories;

namespace ToyStoreManagement.Application.Interfaces.Repositories
{
    public interface ILoyaltyTransactionRepository
        : IGenericRepository<LoyaltyTransaction>
    {
        Task<IEnumerable<LoyaltyTransaction>> GetAllWithDetailsAsync();

        Task<IEnumerable<LoyaltyTransaction>> GetByCustomerIdAsync(
            int customerId);
    }
}
