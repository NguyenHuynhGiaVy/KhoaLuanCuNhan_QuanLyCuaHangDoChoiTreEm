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
    public class VoucherRepository
        : GenericRepository<Voucher>, IVoucherRepository
    {
        public VoucherRepository(ApplicationDbContext context)
            : base(context)
        {
        }

        public async Task<IEnumerable<Voucher>>
            GetAllWithDetailsAsync()
        {
            return await _dbSet
                .Include(x => x.VoucherUsages)
                    .ThenInclude(x => x.Customer)
                .Include(x => x.VoucherUsages)
                    .ThenInclude(x => x.Order)
                .OrderByDescending(x => x.StartDate)
                .ToListAsync();
        }

        public async Task<Voucher?>
            GetByIdWithDetailsAsync(int voucherId)
        {
            return await _dbSet
                .Include(x => x.VoucherUsages)
                    .ThenInclude(x => x.Customer)
                .Include(x => x.VoucherUsages)
                    .ThenInclude(x => x.Order)
                .FirstOrDefaultAsync(
                    x => x.VoucherId == voucherId);
        }

        public async Task<Voucher?>
            GetByCodeAsync(string code)
        {
            return await _dbSet
                .FirstOrDefaultAsync(
                    x => x.Code == code);
        }
    }
}
