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
    public class VoucherUsageRepository
        : GenericRepository<VoucherUsage>,
          IVoucherUsageRepository
    {
        public VoucherUsageRepository(ApplicationDbContext context)
            : base(context)
        {
        }

        public async Task<IEnumerable<VoucherUsage>>
            GetByVoucherIdAsync(int voucherId)
        {
            return await _dbSet
                .Include(x => x.Customer)
                .Include(x => x.Order)
                .Where(x => x.VoucherId == voucherId)
                .OrderByDescending(x => x.UsedAt)
                .ToListAsync();
        }

        public async Task<IEnumerable<VoucherUsage>>
            GetByOrderIdAsync(int orderId)
        {
            return await _dbSet
                .Include(x => x.Voucher)
                .Include(x => x.Customer)
                .Where(x => x.OrderId == orderId)
                .OrderByDescending(x => x.UsedAt)
                .ToListAsync();
        }

        public async Task<IEnumerable<VoucherUsage>>
            GetByCustomerIdAsync(int customerId)
        {
            return await _dbSet
                .Include(x => x.Voucher)
                .Include(x => x.Order)
                .Where(x => x.CustomerId == customerId)
                .OrderByDescending(x => x.UsedAt)
                .ToListAsync();
        }
    }
}