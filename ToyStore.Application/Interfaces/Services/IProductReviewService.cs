using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStoreManagement.Application.DTOs.CustomerCare;

namespace ToyStoreManagement.Application.Interfaces.Services
{
    public interface IProductReviewService
    {
        Task<IEnumerable<ProductReviewDto>> GetAllAsync();

        Task<ProductReviewDto?> GetByIdAsync(long productReviewId);

        Task<IEnumerable<ProductReviewDto>> GetByProductIdAsync(int productId);

        Task<IEnumerable<ProductReviewDto>> GetByCustomerIdAsync(int customerId);

        Task<IEnumerable<ProductReviewDto>> GetByOrderIdAsync(int orderId);

        Task<ProductReviewDto> CreateAsync(CreateProductReviewDto dto);

        Task<ProductReviewDto?> UpdateAsync(
            long productReviewId,
            UpdateProductReviewDto dto);

        Task<bool> DeleteAsync(long productReviewId);
    }
}
