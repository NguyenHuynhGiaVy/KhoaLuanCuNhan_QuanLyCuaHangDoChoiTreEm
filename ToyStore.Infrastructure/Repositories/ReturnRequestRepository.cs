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
    public class ReturnRequestRepository : GenericRepository<ReturnRequest>, IReturnRequestRepository
    {
        public ReturnRequestRepository(ApplicationDbContext context)
            : base(context)
        {
        }

        public async Task<IEnumerable<ReturnRequest>> GetAllWithDetailsAsync()
        {
            return await _context.ReturnRequests
                .Include(x => x.Order)
                .Include(x => x.Customer)
                .Include(x => x.ReturnRequestDetails)
                    .ThenInclude(x => x.ProductVariant)
                        .ThenInclude(x => x.Product)
                .OrderByDescending(x => x.RequestedAt)
                .ToListAsync();
        }

        public async Task<ReturnRequest?> GetByIdWithDetailsAsync(int returnRequestId)
        {
            return await _context.ReturnRequests
                .Include(x => x.Order)
                .Include(x => x.Customer)
                .Include(x => x.ReturnRequestDetails)
                    .ThenInclude(x => x.ProductVariant)
                        .ThenInclude(x => x.Product)
                .FirstOrDefaultAsync(x => x.ReturnRequestId == returnRequestId);
        }

        public async Task<IEnumerable<ReturnRequest>> GetByCustomerIdAsync(int customerId)
        {
            return await _context.ReturnRequests
                .Include(x => x.Order)
                .Include(x => x.ReturnRequestDetails)
                    .ThenInclude(x => x.ProductVariant)
                        .ThenInclude(x => x.Product)
                .Where(x => x.CustomerId == customerId)
                .OrderByDescending(x => x.RequestedAt)
                .ToListAsync();
        }

        public async Task<IEnumerable<ReturnRequest>> GetByOrderIdAsync(int orderId)
        {
            return await _context.ReturnRequests
                .Include(x => x.Customer)
                .Include(x => x.ReturnRequestDetails)
                    .ThenInclude(x => x.ProductVariant)
                        .ThenInclude(x => x.Product)
                .Where(x => x.OrderId == orderId)
                .OrderByDescending(x => x.RequestedAt)
                .ToListAsync();
        }

        public async Task<ReturnRequest?> GetByReturnCodeAsync(string returnCode)
        {
            return await _context.ReturnRequests
                .Include(x => x.Order)
                .Include(x => x.Customer)
                .Include(x => x.ReturnRequestDetails)
                    .ThenInclude(x => x.ProductVariant)
                        .ThenInclude(x => x.Product)
                .FirstOrDefaultAsync(x => x.ReturnCode == returnCode);
        }
    }
}
