using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Threading.Tasks;
using ToyStoreManagement.Domain.Entities;
using ToyStore.Application.Interfaces.Repositories;

namespace ToyStoreManagement.Application.Interfaces.Repositories
{
    public interface IInventoryRepository : IGenericRepository<Inventory>
    {
        Task<IEnumerable<Inventory>> GetAllWithDetailsAsync();

        Task<Inventory?> GetByVariantIdAsync(int variantId);

        Task<Inventory?> GetByIdWithDetailsAsync(int inventoryId);
    }
}