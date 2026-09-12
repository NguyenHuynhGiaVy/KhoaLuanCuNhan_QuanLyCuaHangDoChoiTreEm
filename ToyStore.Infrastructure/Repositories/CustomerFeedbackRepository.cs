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
    public class CustomerFeedbackRepository : GenericRepository<CustomerFeedback>, ICustomerFeedbackRepository
    {
        public CustomerFeedbackRepository(ApplicationDbContext context)
            : base(context)
        {
        }

        public async Task<IEnumerable<CustomerFeedback>> GetAllWithDetailsAsync()
        {
            return await _context.CustomerFeedbacks
                .Include(x => x.Customer)
                .Include(x => x.Order)
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync();
        }

        public async Task<CustomerFeedback?> GetByIdWithDetailsAsync(long customerFeedbackId)
        {
            return await _context.CustomerFeedbacks
                .Include(x => x.Customer)
                .Include(x => x.Order)
                .FirstOrDefaultAsync(x => x.CustomerFeedbackId == customerFeedbackId);
        }

        public async Task<IEnumerable<CustomerFeedback>> GetByCustomerIdAsync(int customerId)
        {
            return await _context.CustomerFeedbacks
                .Include(x => x.Order)
                .Where(x => x.CustomerId == customerId)
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync();
        }

        public async Task<IEnumerable<CustomerFeedback>> GetByOrderIdAsync(int orderId)
        {
            return await _context.CustomerFeedbacks
                .Include(x => x.Customer)
                .Where(x => x.OrderId == orderId)
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync();
        }
    }
}
