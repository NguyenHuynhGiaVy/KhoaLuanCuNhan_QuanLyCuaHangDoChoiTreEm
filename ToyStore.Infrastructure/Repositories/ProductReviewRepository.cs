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
    public class ProductReviewRepository : GenericRepository<ProductReview>, IProductReviewRepository
    {
        public ProductReviewRepository(ApplicationDbContext context)
            : base(context)
        {
        }

        public async Task<IEnumerable<ProductReview>> GetAllWithDetailsAsync()
        {
            return await _context.ProductReviews
                .Include(x => x.Product)
                .Include(x => x.ProductVariant)
                .Include(x => x.Customer)
                .Include(x => x.Order)
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync();
        }

        public async Task<ProductReview?> GetByIdWithDetailsAsync(long productReviewId)
        {
            return await _context.ProductReviews
                .Include(x => x.Product)
                .Include(x => x.ProductVariant)
                .Include(x => x.Customer)
                .Include(x => x.Order)
                .FirstOrDefaultAsync(x => x.ProductReviewId == productReviewId);
        }

        public async Task<IEnumerable<ProductReview>> GetByProductIdAsync(int productId)
        {
            return await _context.ProductReviews
                .Include(x => x.ProductVariant)
                .Include(x => x.Customer)
                .Include(x => x.Order)
                .Where(x => x.ProductId == productId)
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync();
        }

        public async Task<IEnumerable<ProductReview>> GetByCustomerIdAsync(int customerId)
        {
            return await _context.ProductReviews
                .Include(x => x.Product)
                .Include(x => x.ProductVariant)
                .Include(x => x.Order)
                .Where(x => x.CustomerId == customerId)
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync();
        }

        public async Task<IEnumerable<ProductReview>> GetByOrderIdAsync(int orderId)
        {
            return await _context.ProductReviews
                .Include(x => x.Product)
                .Include(x => x.ProductVariant)
                .Include(x => x.Customer)
                .Where(x => x.OrderId == orderId)
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync();
        }
    }
}
