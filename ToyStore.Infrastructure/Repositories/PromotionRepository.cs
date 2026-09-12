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
    public class PromotionRepository
        : GenericRepository<Promotion>, IPromotionRepository
    {
        public PromotionRepository(ApplicationDbContext context)
            : base(context)
        {
        }

        public async Task<IEnumerable<Promotion>>
            GetAllWithDetailsAsync()
        {
            return await _dbSet
                .Include(x => x.PromotionConditions)
                    .ThenInclude(x => x.Category)
                .Include(x => x.PromotionConditions)
                    .ThenInclude(x => x.Brand)
                .Include(x => x.PromotionProducts)
                    .ThenInclude(x => x.ProductVariant)
                        .ThenInclude(x => x.Product)
                .OrderByDescending(x => x.StartDate)
                .ToListAsync();
        }

        public async Task<Promotion?>
            GetByIdWithDetailsAsync(int promotionId)
        {
            return await _dbSet
                .Include(x => x.PromotionConditions)
                    .ThenInclude(x => x.Category)
                .Include(x => x.PromotionConditions)
                    .ThenInclude(x => x.Brand)
                .Include(x => x.PromotionProducts)
                    .ThenInclude(x => x.ProductVariant)
                        .ThenInclude(x => x.Product)
                .FirstOrDefaultAsync(
                    x => x.PromotionId == promotionId);
        }
    }
}