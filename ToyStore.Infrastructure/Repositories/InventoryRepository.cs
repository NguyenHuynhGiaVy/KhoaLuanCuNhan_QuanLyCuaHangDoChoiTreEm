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
    public class InventoryRepository
        : GenericRepository<Inventory>, IInventoryRepository
    {
        public InventoryRepository(ApplicationDbContext context)
            : base(context)
        {
        }

        public async Task<IEnumerable<Inventory>> GetAllWithDetailsAsync()
        {
            return await _dbSet
                .Include(x => x.ProductVariant)
                    .ThenInclude(x => x.Product)
                .OrderByDescending(x => x.UpdatedAt)
                .ToListAsync();
        }

        public async Task<Inventory?> GetByVariantIdAsync(int variantId)
        {
            return await _dbSet
                .Include(x => x.ProductVariant)
                    .ThenInclude(x => x.Product)
                .FirstOrDefaultAsync(x => x.VariantId == variantId);
        }

        public async Task<Inventory?> GetByIdWithDetailsAsync(int inventoryId)
        {
            return await _dbSet
                .Include(x => x.ProductVariant)
                    .ThenInclude(x => x.Product)
                .FirstOrDefaultAsync(x => x.InventoryId == inventoryId);
        }
    }
}
