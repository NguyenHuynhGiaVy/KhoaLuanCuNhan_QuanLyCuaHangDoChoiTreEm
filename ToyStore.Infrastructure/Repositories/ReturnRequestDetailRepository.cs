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
    public class ReturnRequestDetailRepository : GenericRepository<ReturnRequestDetail>, IReturnRequestDetailRepository
    {
        public ReturnRequestDetailRepository(ApplicationDbContext context)
            : base(context)
        {
        }

        public async Task<IEnumerable<ReturnRequestDetail>> GetByReturnRequestIdAsync(int returnRequestId)
        {
            return await _context.ReturnRequestDetails
                .Include(x => x.ProductVariant)
                    .ThenInclude(x => x.Product)
                .Where(x => x.ReturnRequestId == returnRequestId)
                .ToListAsync();
        }
    }
}
