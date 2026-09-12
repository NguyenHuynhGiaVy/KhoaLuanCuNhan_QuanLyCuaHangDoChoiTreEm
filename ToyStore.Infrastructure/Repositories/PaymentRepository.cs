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
    public class PaymentRepository
        : GenericRepository<Payment>, IPaymentRepository
    {
        public PaymentRepository(ApplicationDbContext context)
            : base(context)
        {
        }

        public async Task<IEnumerable<Payment>>
            GetAllWithDetailsAsync()
        {
            return await _dbSet
                .Include(x => x.Order)
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync();
        }

        public async Task<Payment?>
            GetByIdWithDetailsAsync(int paymentId)
        {
            return await _dbSet
                .Include(x => x.Order)
                .FirstOrDefaultAsync(
                    x => x.PaymentId == paymentId);
        }

        public async Task<Payment?>
            GetByOrderIdAsync(int orderId)
        {
            return await _dbSet
                .Include(x => x.Order)
                .FirstOrDefaultAsync(
                    x => x.OrderId == orderId);
        }
    }
}
