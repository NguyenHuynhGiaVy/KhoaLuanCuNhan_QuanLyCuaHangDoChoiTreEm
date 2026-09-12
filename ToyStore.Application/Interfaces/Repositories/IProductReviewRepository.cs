using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStore.Application.Interfaces.Repositories;
using ToyStoreManagement.Application.Interfaces.Repositories;
using ToyStoreManagement.Domain.Entities;

namespace ToyStoreManagement.Application.Interfaces.Repositories
{
    public interface IProductReviewRepository : IGenericRepository<ProductReview>
    {
        Task<IEnumerable<ProductReview>> GetAllWithDetailsAsync();
        Task<ProductReview?> GetByIdWithDetailsAsync(long productReviewId);
        Task<IEnumerable<ProductReview>> GetByProductIdAsync(int productId);
        Task<IEnumerable<ProductReview>> GetByCustomerIdAsync(int customerId);
        Task<IEnumerable<ProductReview>> GetByOrderIdAsync(int orderId);
    }
}