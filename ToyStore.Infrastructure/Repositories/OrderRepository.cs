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
    public class OrderRepository
        : GenericRepository<Order>, IOrderRepository
    {
        public OrderRepository(ApplicationDbContext context)
            : base(context)
        {
        }

        public async Task<IEnumerable<Order>>
            GetAllWithDetailsAsync()
        {
            return await _dbSet
                .Include(x => x.Customer)
                .Include(x => x.OrderDetails)
                    .ThenInclude(x => x.ProductVariant)
                        .ThenInclude(x => x.Product)
                .Include(x => x.Payment)
                .Include(x => x.Shipping)
                .OrderByDescending(x => x.OrderDate)
                .ToListAsync();
        }

        public async Task<Order?>
            GetByIdWithDetailsAsync(int orderId)
        {
            return await _dbSet
                .Include(x => x.Customer)
                .Include(x => x.OrderDetails)
                    .ThenInclude(x => x.ProductVariant)
                        .ThenInclude(x => x.Product)
                .Include(x => x.Payment)
                .Include(x => x.Shipping)
                .FirstOrDefaultAsync(x => x.OrderId == orderId);
        }

        public async Task<Order?>
            GetByOrderCodeAsync(string orderCode)
        {
            return await _dbSet
                .FirstOrDefaultAsync(
                    x => x.OrderCode == orderCode);
        }

        public async Task<IEnumerable<Order>>
            GetByCustomerIdAsync(int customerId)
        {
            return await _dbSet
                .Include(x => x.OrderDetails)
                    .ThenInclude(x => x.ProductVariant)
                        .ThenInclude(x => x.Product)
                .Include(x => x.Payment)
                .Include(x => x.Shipping)
                .Where(x => x.CustomerId == customerId)
                .OrderByDescending(x => x.OrderDate)
                .ToListAsync();
        }
    }
}
