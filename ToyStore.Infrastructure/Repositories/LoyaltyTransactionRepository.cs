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
    public class LoyaltyTransactionRepository
        : GenericRepository<LoyaltyTransaction>,
          ILoyaltyTransactionRepository
    {
        public LoyaltyTransactionRepository(ApplicationDbContext context)
            : base(context)
        {
        }

        public async Task<IEnumerable<LoyaltyTransaction>>
            GetAllWithDetailsAsync()
        {
            return await _dbSet
                .Include(x => x.Customer)
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync();
        }

        public async Task<IEnumerable<LoyaltyTransaction>>
            GetByCustomerIdAsync(int customerId)
        {
            return await _dbSet
                .Include(x => x.Customer)
                .Where(x => x.CustomerId == customerId)
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync();
        }
    }
}