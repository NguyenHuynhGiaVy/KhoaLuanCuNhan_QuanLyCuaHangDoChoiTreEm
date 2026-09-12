using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ToyStore.Infrastructure.Repositories;
using ToyStoreManagement.Application.Interfaces.Repositories;
using ToyStoreManagement.Domain.Entities;
using ToyStoreManagement.Infrastructure.Data;

namespace ToyStoreManagement.Infrastructure.Repositories
{
    public class ImportReceiptRepository
        : GenericRepository<ImportReceipt>,
          IImportReceiptRepository
    {
        public ImportReceiptRepository(ApplicationDbContext context)
            : base(context)
        {
        }

        public async Task<IEnumerable<ImportReceipt>> GetAllWithDetailsAsync()
        {
            return await _dbSet
                .Include(x => x.Supplier)
                .Include(x => x.ImportReceiptDetails)
                    .ThenInclude(x => x.ProductVariant)
                        .ThenInclude(x => x.Product)
                .OrderByDescending(x => x.ImportDate)
                .ToListAsync();
        }

        public async Task<ImportReceipt?> GetByIdWithDetailsAsync(int id)
        {
            return await _dbSet
                .Include(x => x.Supplier)
                .Include(x => x.ImportReceiptDetails)
                    .ThenInclude(x => x.ProductVariant)
                        .ThenInclude(x => x.Product)
                .FirstOrDefaultAsync(x => x.ImportReceiptId == id);
        }
    }
}
