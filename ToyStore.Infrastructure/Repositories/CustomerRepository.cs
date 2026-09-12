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
    public class CustomerRepository
        : GenericRepository<Customer>, ICustomerRepository
    {
        public CustomerRepository(ApplicationDbContext context)
            : base(context)
        {
        }

        public async Task<IEnumerable<Customer>> GetAllWithDetailsAsync()
        {
            return await _dbSet
                .Include(x => x.User)
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync();
        }

        public async Task<Customer?> GetByIdWithDetailsAsync(int customerId)
        {
            return await _dbSet
                .Include(x => x.User)
                .FirstOrDefaultAsync(x => x.CustomerId == customerId);
        }

        public async Task<Customer?> GetByUserIdAsync(string userId)
        {
            return await _dbSet
                .Include(x => x.User)
                .FirstOrDefaultAsync(x => x.UserId == userId);
        }
    }
}
