using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ToyStore.Application.Interfaces.Repositories;
using ToyStoreManagement.Domain.Entities;
using ToyStoreManagement.Infrastructure.Data;

namespace ToyStore.Infrastructure.Repositories
{
    public class CategoryRepository
        : GenericRepository<Category>, ICategoryRepository
    {
        public CategoryRepository(ApplicationDbContext context)
            : base(context)
        {
        }

        public async Task<IEnumerable<Category>> GetAllWithProductsAsync()
        {
            return await _context.Categories
                .Include(c => c.Products)
                .AsNoTracking()
                .ToListAsync();
        }
    }
}
