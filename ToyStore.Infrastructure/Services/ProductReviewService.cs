using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStore.Application.Interfaces.Repositories;
using ToyStoreManagement.Application.DTOs.CustomerCare;
using ToyStoreManagement.Application.Interfaces.Repositories;
using ToyStoreManagement.Application.Interfaces.Services;
using ToyStoreManagement.Domain.Entities;

namespace ToyStoreManagement.Infrastructure.Services
{
    public class ProductReviewService : IProductReviewService
    {
        private readonly IProductReviewRepository _productReviewRepository;
        private readonly IGenericRepository<Product> _productRepository;
        private readonly IGenericRepository<ProductVariant> _variantRepository;
        private readonly IGenericRepository<Customer> _customerRepository;
        private readonly IGenericRepository<Order> _orderRepository;
        private readonly IUnitOfWork _unitOfWork;

        public ProductReviewService(
            IProductReviewRepository productReviewRepository,
            IGenericRepository<Product> productRepository,
            IGenericRepository<ProductVariant> variantRepository,
            IGenericRepository<Customer> customerRepository,
            IGenericRepository<Order> orderRepository,
            IUnitOfWork unitOfWork)
        {
            _productReviewRepository = productReviewRepository;
            _productRepository = productRepository;
            _variantRepository = variantRepository;
            _customerRepository = customerRepository;
            _orderRepository = orderRepository;
            _unitOfWork = unitOfWork;
        }

        public async Task<IEnumerable<ProductReviewDto>> GetAllAsync()
        {
            var reviews = await _productReviewRepository.GetAllWithDetailsAsync();

            return reviews.Select(MapToDto);
        }

        public async Task<ProductReviewDto?> GetByIdAsync(long productReviewId)
        {
            var review = await _productReviewRepository
                .GetByIdWithDetailsAsync(productReviewId);

            return review == null ? null : MapToDto(review);
        }

        public async Task<IEnumerable<ProductReviewDto>> GetByProductIdAsync(
            int productId)
        {
            var reviews = await _productReviewRepository
                .GetByProductIdAsync(productId);

            return reviews.Select(MapToDto);
        }

        public async Task<IEnumerable<ProductReviewDto>> GetByCustomerIdAsync(
            int customerId)
        {
            var reviews = await _productReviewRepository
                .GetByCustomerIdAsync(customerId);

            return reviews.Select(MapToDto);
        }

        public async Task<IEnumerable<ProductReviewDto>> GetByOrderIdAsync(
            int orderId)
        {
            var reviews = await _productReviewRepository
                .GetByOrderIdAsync(orderId);

            return reviews.Select(MapToDto);
        }

        public async Task<ProductReviewDto> CreateAsync(
            CreateProductReviewDto dto)
        {
            if (dto.Rating < 1 || dto.Rating > 5)
                throw new Exception("Rating phải từ 1 đến 5.");

            if (string.IsNullOrWhiteSpace(dto.Comment))
                throw new Exception("Nội dung đánh giá không được để trống.");

            var product = await _productRepository.GetByIdAsync(dto.ProductId);
            if (product == null)
                throw new Exception("Sản phẩm không tồn tại.");

            var variant = await _variantRepository.GetByIdAsync(dto.VariantId);
            if (variant == null)
                throw new Exception("Biến thể sản phẩm không tồn tại.");

            if (variant.ProductId != dto.ProductId)
                throw new Exception("Variant không thuộc sản phẩm.");

            var customer = await _customerRepository.GetByIdAsync(dto.CustomerId);
            if (customer == null)
                throw new Exception("Khách hàng không tồn tại.");

            var order = await _orderRepository.GetByIdAsync(dto.OrderId);
            if (order == null)
                throw new Exception("Đơn hàng không tồn tại.");

            var existingReview = await _productReviewRepository
                .FirstOrDefaultAsync(x =>
                    x.CustomerId == dto.CustomerId &&
                    x.OrderId == dto.OrderId &&
                    x.VariantId == dto.VariantId);

            if (existingReview != null)
                throw new Exception("Khách hàng đã đánh giá sản phẩm này trong đơn hàng.");

            var review = new ProductReview
            {
                ProductId = dto.ProductId,
                VariantId = dto.VariantId,
                CustomerId = dto.CustomerId,
                OrderId = dto.OrderId,
                Rating = dto.Rating,
                Comment = dto.Comment,
                IsApproved = false,
                CreatedAt = DateTime.UtcNow
            };

            await _productReviewRepository.AddAsync(review);
            await _unitOfWork.SaveChangesAsync();

            var result = await _productReviewRepository
                .GetByIdWithDetailsAsync(review.ProductReviewId);

            return MapToDto(result!);
        }

        public async Task<ProductReviewDto?> UpdateAsync(
            long productReviewId,
            UpdateProductReviewDto dto)
        {
            if (dto.Rating < 1 || dto.Rating > 5)
                throw new Exception("Rating phải từ 1 đến 5.");

            if (string.IsNullOrWhiteSpace(dto.Comment))
                throw new Exception("Nội dung đánh giá không được để trống.");

            var review = await _productReviewRepository
                .GetByIdAsync(productReviewId);

            if (review == null)
                return null;

            review.Rating = dto.Rating;
            review.Comment = dto.Comment;
            review.IsApproved = dto.IsApproved;
            review.UpdatedAt = DateTime.UtcNow;

            _productReviewRepository.Update(review);
            await _unitOfWork.SaveChangesAsync();

            var result = await _productReviewRepository
                .GetByIdWithDetailsAsync(productReviewId);

            return MapToDto(result!);
        }

        public async Task<bool> DeleteAsync(long productReviewId)
        {
            var review = await _productReviewRepository
                .GetByIdAsync(productReviewId);

            if (review == null)
                return false;

            _productReviewRepository.Delete(review);

            await _unitOfWork.SaveChangesAsync();

            return true;
        }

        private static ProductReviewDto MapToDto(ProductReview review)
        {
            return new ProductReviewDto
            {
                ProductReviewId = review.ProductReviewId,
                ProductId = review.ProductId,
                ProductName = review.Product?.Name,
                VariantId = review.VariantId,
                SKU = review.ProductVariant?.SKU,
                CustomerId = review.CustomerId,
                CustomerName = review.Customer?.FullName,
                OrderId = review.OrderId,
                OrderCode = review.Order?.OrderCode,
                Rating = review.Rating,
                Comment = review.Comment,
                IsApproved = review.IsApproved,
                CreatedAt = review.CreatedAt,
                UpdatedAt = review.UpdatedAt
            };
        }
    }
}
