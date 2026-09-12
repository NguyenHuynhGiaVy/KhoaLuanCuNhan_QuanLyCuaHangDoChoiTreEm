using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

using Microsoft.EntityFrameworkCore;
using ToyStore.Application.Interfaces.Repositories;

using ToyStoreManagement.Domain.Entities;
using ToyStoreManagement.Infrastructure.Data;

using ToyStoreManagement.Application.Interfaces.Repositories;

using ToyStore.Infrastructure.Repositories;

namespace ToyStoreManagement.Infrastructure.Repositories
{
    public class ProductRepository
        : GenericRepository<Product>,
          IProductRepository
    {
        public ProductRepository(ApplicationDbContext context)
            : base(context)
        {
        }

        public async Task<IEnumerable<Product>>
            GetProductsWithDetailsAsync()
        {
            return await _dbSet
                .Include(p => p.Category)
                .Include(p => p.Brand)
                .Include(p => p.ProductVariants)
                .ToListAsync();
        }

        public async Task<Product?>
            GetProductWithDetailsAsync(int productId)
        {
            return await _dbSet
                .Include(p => p.Category)
                .Include(p => p.Brand)
                .Include(p => p.ProductVariants)
                .FirstOrDefaultAsync(
                    p => p.ProductId == productId);
        }
    }
}