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
    public class PromotionConditionRepository
        : GenericRepository<PromotionCondition>,
          IPromotionConditionRepository
    {
        public PromotionConditionRepository(ApplicationDbContext context)
            : base(context)
        {
        }

        public async Task<IEnumerable<PromotionCondition>>
            GetByPromotionIdAsync(int promotionId)
        {
            return await _dbSet
                .Include(x => x.Category)
                .Include(x => x.Brand)
                .Where(x => x.PromotionId == promotionId)
                .ToListAsync();
        }
    }
}
