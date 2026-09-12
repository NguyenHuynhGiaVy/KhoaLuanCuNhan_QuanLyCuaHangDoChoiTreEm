using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStore.Application.Interfaces.Repositories;
using ToyStore.Application.Interfaces.Services;
using ToyStore.Application.Interfaces;
using ToyStoreManagement.Domain.Entities;
using ToyStoreManagement.Application.DTOs.Product;
using ToyStoreManagement.Application.Interfaces;
using ToyStoreManagement.Application.Interfaces.Repositories;
using ToyStoreManagement.Application.Interfaces.Services;


namespace ToyStoreManagement.Infrastructure.Services
{
    public class ProductService : IProductService
    {
        private readonly IProductRepository _productRepository;

        private readonly IGenericRepository<ProductVariant>
            _variantRepository;

        private readonly IUnitOfWork _unitOfWork;

        public ProductService(
            IProductRepository productRepository,
            IGenericRepository<ProductVariant> variantRepository,
            IUnitOfWork unitOfWork)
        {
            _productRepository = productRepository;
            _variantRepository = variantRepository;
            _unitOfWork = unitOfWork;
        }

        // ==========================================
        // GET ALL PRODUCTS
        // ==========================================

        public async Task<IEnumerable<ProductDto>> GetAllAsync()
        {
            var products =
                await _productRepository
                    .GetProductsWithDetailsAsync();

            return products.Select(MapToDto);
        }

        // ==========================================
        // GET PRODUCT BY ID
        // ==========================================

        public async Task<ProductDto?> GetByIdAsync(
            int productId)
        {
            var product =
                await _productRepository
                    .GetProductWithDetailsAsync(productId);

            if (product == null)
                return null;

            return MapToDto(product);
        }

        // ==========================================
        // CREATE PRODUCT
        // ==========================================

        public async Task<ProductDto> CreateAsync(
            CreateProductDto dto)
        {
            var product = new Product
            {
                CategoryId = dto.CategoryId,

                BrandId = dto.BrandId,

                Name = dto.Name,

                Description = dto.Description,

                AgeFrom = dto.AgeFrom,

                AgeTo = dto.AgeTo,

                Status = dto.Status,

                IsFeatured = dto.IsFeatured,

                BasePrice = dto.BasePrice,

                IsNew = dto.IsNew,

                ImageUrl = dto.ImageUrl,

                CreatedAt = DateTime.UtcNow,

                UpdatedAt = null
            };

            await _productRepository
                .AddAsync(product);

            await _unitOfWork
                .SaveChangesAsync();

            return MapToDto(product);
        }

        // ==========================================
        // UPDATE PRODUCT
        // ==========================================

        public async Task<bool> UpdateAsync(
            int productId,
            UpdateProductDto dto)
        {
            var product =
                await _productRepository
                    .GetByIdAsync(productId);

            if (product == null)
                return false;

            product.CategoryId = dto.CategoryId;

            product.BrandId = dto.BrandId;

            product.Name = dto.Name;

            product.Description = dto.Description;

            product.AgeFrom = dto.AgeFrom;

            product.AgeTo = dto.AgeTo;

            product.Status = dto.Status;

            product.IsFeatured = dto.IsFeatured;

            product.BasePrice = dto.BasePrice;

            product.IsNew = dto.IsNew;

            product.ImageUrl = dto.ImageUrl;

            product.UpdatedAt = DateTime.UtcNow;

            _productRepository.Update(product);

            await _unitOfWork
                .SaveChangesAsync();

            return true;
        }

        // ==========================================
        // DELETE PRODUCT
        // ==========================================

        public async Task<bool> DeleteAsync(
            int productId)
        {
            var product =
                await _productRepository
                    .GetProductWithDetailsAsync(productId);

            if (product == null)
                return false;

            _productRepository.Delete(product);

            await _unitOfWork
                .SaveChangesAsync();

            return true;
        }

        // ==========================================
        // ADD PRODUCT VARIANT
        // ==========================================

        public async Task<ProductVariantDto>
            AddVariantAsync(
                int productId,
                CreateProductVariantDto dto)
        {
            var product =
                await _productRepository
                    .GetByIdAsync(productId);

            if (product == null)
            {
                throw new KeyNotFoundException(
                    "Không tìm thấy sản phẩm.");
            }

            // Kiểm tra SKU đã tồn tại chưa
            var existsSku =
                await _variantRepository
                    .AnyAsync(v => v.SKU == dto.SKU);

            if (existsSku)
            {
                throw new InvalidOperationException(
                    "SKU đã tồn tại.");
            }

            var variant = new ProductVariant
            {
                ProductId = productId,

                SKU = dto.SKU,

                Color = dto.Color,

                Size = dto.Size,

                Price = dto.Price,

                CostPrice = dto.CostPrice,

                Weight = dto.Weight,

                ImageUrl = dto.ImageUrl,

                Status = dto.Status,

                CreatedAt = DateTime.UtcNow,

                UpdatedAt = null
            };

            await _variantRepository
                .AddAsync(variant);

            await _unitOfWork
                .SaveChangesAsync();

            return MapVariantToDto(variant);
        }

        // ==========================================
        // UPDATE PRODUCT VARIANT
        // ==========================================

        public async Task<bool> UpdateVariantAsync(
            int variantId,
            UpdateProductVariantDto dto)
        {
            var variant =
                await _variantRepository
                    .GetByIdAsync(variantId);

            if (variant == null)
                return false;

            // Kiểm tra SKU trùng
            var existsSku =
                await _variantRepository
                    .AnyAsync(v =>
                        v.SKU == dto.SKU &&
                        v.VariantId != variantId);

            if (existsSku)
            {
                throw new InvalidOperationException(
                    "SKU đã tồn tại.");
            }

            variant.SKU = dto.SKU;

            variant.Color = dto.Color;

            variant.Size = dto.Size;

            variant.Price = dto.Price;

            variant.CostPrice = dto.CostPrice;

            variant.Weight = dto.Weight;

            variant.ImageUrl = dto.ImageUrl;

            variant.Status = dto.Status;

            variant.UpdatedAt = DateTime.UtcNow;

            _variantRepository.Update(variant);

            await _unitOfWork
                .SaveChangesAsync();

            return true;
        }

        // ==========================================
        // DELETE PRODUCT VARIANT
        // ==========================================

        public async Task<bool> DeleteVariantAsync(
            int variantId)
        {
            var variant =
                await _variantRepository
                    .GetByIdAsync(variantId);

            if (variant == null)
                return false;

            _variantRepository.Delete(variant);

            await _unitOfWork
                .SaveChangesAsync();

            return true;
        }

        // ==========================================
        // MAP PRODUCT -> DTO
        // ==========================================

        private static ProductDto MapToDto(
            Product product)
        {
            return new ProductDto
            {
                ProductId = product.ProductId,

                CategoryId = product.CategoryId,

                CategoryName =
                    product.Category?.Name,

                BrandId = product.BrandId,

                BrandName =
                    product.Brand?.Name,

                Name = product.Name,

                Description = product.Description,

                AgeFrom = product.AgeFrom,

                AgeTo = product.AgeTo,

                Status = product.Status,

                IsFeatured = product.IsFeatured,

                BasePrice = product.BasePrice,

                IsNew = product.IsNew,

                ImageUrl = product.ImageUrl,

                CreatedAt = product.CreatedAt,

                UpdatedAt = product.UpdatedAt,

                ProductVariants =
                    product.ProductVariants?
                        .Select(MapVariantToDto)
                        .ToList()
                    ?? new List<ProductVariantDto>()
            };
        }

        // ==========================================
        // MAP VARIANT -> DTO
        // ==========================================

        private static ProductVariantDto
            MapVariantToDto(
                ProductVariant variant)
        {
            return new ProductVariantDto
            {
                VariantId = variant.VariantId,

                ProductId = variant.ProductId,

                SKU = variant.SKU,

                Color = variant.Color,

                Size = variant.Size,

                Price = variant.Price,

                CostPrice = variant.CostPrice,

                Weight = variant.Weight,

                ImageUrl = variant.ImageUrl,

                Status = variant.Status,

                CreatedAt = variant.CreatedAt,

                UpdatedAt = variant.UpdatedAt
            };
        }
    }
}