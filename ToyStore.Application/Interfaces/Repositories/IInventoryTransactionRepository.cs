using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStoreManagement.Domain.Entities;
using ToyStore.Application.Interfaces.Repositories;

namespace ToyStoreManagement.Application.Interfaces.Repositories
{
    public interface IInventoryTransactionRepository
        : IGenericRepository<InventoryTransaction>
    {
        Task<IEnumerable<InventoryTransaction>> GetAllWithDetailsAsync();

        Task<IEnumerable<InventoryTransaction>> GetByVariantIdAsync(int variantId);
    }
}