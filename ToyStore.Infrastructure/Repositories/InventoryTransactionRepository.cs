using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

using Microsoft.EntityFrameworkCore;

using ToyStoreManagement.Application.Interfaces.Repositories;
using ToyStoreManagement.Domain.Entities;
using ToyStore.Infrastructure.Repositories;
using ToyStoreManagement.Infrastructure.Data;

namespace ToyStoreManagement.Infrastructure.Repositories
{
    public class InventoryTransactionRepository
        : GenericRepository<InventoryTransaction>,
          IInventoryTransactionRepository
    {
        public InventoryTransactionRepository(ApplicationDbContext context)
            : base(context)
        {
        }

        public async Task<IEnumerable<InventoryTransaction>> GetAllWithDetailsAsync()
        {
            return await _dbSet
                .Include(x => x.ProductVariant)
                    .ThenInclude(x => x.Product)
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync();
        }

        public async Task<IEnumerable<InventoryTransaction>> GetByVariantIdAsync(
            int variantId)
        {
            return await _dbSet
                .Include(x => x.ProductVariant)
                    .ThenInclude(x => x.Product)
                .Where(x => x.VariantId == variantId)
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync();
        }
    }
}
