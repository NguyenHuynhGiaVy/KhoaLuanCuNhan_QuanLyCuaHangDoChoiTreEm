using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStoreManagement.Application.DTOs.Promotion;
using ToyStoreManagement.Application.Interfaces.Repositories;
using ToyStoreManagement.Application.Interfaces.Services;
using ToyStoreManagement.Domain.Entities;
using ToyStore.Application.Interfaces.Repositories;

namespace ToyStoreManagement.Infrastructure.Services
{
    public class PromotionService : IPromotionService
    {
        private readonly IPromotionRepository _promotionRepository;
        private readonly IPromotionConditionRepository _conditionRepository;
        private readonly IPromotionProductRepository _productRepository;
        private readonly IGenericRepository<Category> _categoryRepository;
        private readonly IGenericRepository<Brand> _brandRepository;
        private readonly IGenericRepository<ProductVariant> _variantRepository;
        private readonly IUnitOfWork _unitOfWork;

        public PromotionService(
            IPromotionRepository promotionRepository,
            IPromotionConditionRepository conditionRepository,
            IPromotionProductRepository productRepository,
            IGenericRepository<Category> categoryRepository,
            IGenericRepository<Brand> brandRepository,
            IGenericRepository<ProductVariant> variantRepository,
            IUnitOfWork unitOfWork)
        {
            _promotionRepository = promotionRepository;
            _conditionRepository = conditionRepository;
            _productRepository = productRepository;
            _categoryRepository = categoryRepository;
            _brandRepository = brandRepository;
            _variantRepository = variantRepository;
            _unitOfWork = unitOfWork;
        }

        public async Task<IEnumerable<PromotionDto>> GetAllAsync()
        {
            var promotions =
                await _promotionRepository.GetAllWithDetailsAsync();

            return promotions.Select(MapToDto);
        }

        public async Task<PromotionDto?> GetByIdAsync(int promotionId)
        {
            var promotion =
                await _promotionRepository.GetByIdWithDetailsAsync(
                    promotionId);

            if (promotion == null)
                return null;

            return MapToDto(promotion);
        }

        public async Task<PromotionDto> CreateAsync(
            CreatePromotionDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Name))
                throw new Exception("Tên khuyến mãi không được để trống.");

            if (dto.StartDate >= dto.EndDate)
                throw new Exception(
                    "Ngày bắt đầu phải trước ngày kết thúc.");

            if (dto.DiscountValue < 0)
                throw new Exception(
                    "Giá trị giảm giá không được âm.");

            if (dto.MaximumDiscount.HasValue &&
                dto.MaximumDiscount.Value < 0)
                throw new Exception(
                    "Mức giảm tối đa không được âm.");

            var promotion = new Promotion
            {
                Name = dto.Name,
                Description = dto.Description,
                PromotionType = dto.PromotionType,
                DiscountValue = dto.DiscountValue,
                MaximumDiscount = dto.MaximumDiscount,
                StartDate = dto.StartDate,
                EndDate = dto.EndDate,
                Priority = dto.Priority,
                CanCombine = dto.CanCombine,
                Status = dto.Status,
                CreatedAt = DateTime.UtcNow
            };

            await _promotionRepository.AddAsync(promotion);
            await _unitOfWork.SaveChangesAsync();

            var result =
                await _promotionRepository.GetByIdWithDetailsAsync(
                    promotion.PromotionId);

            return MapToDto(result!);
        }

        public async Task<PromotionDto?> UpdateAsync(
            int promotionId,
            UpdatePromotionDto dto)
        {
            var promotion =
                await _promotionRepository.GetByIdWithDetailsAsync(
                    promotionId);

            if (promotion == null)
                return null;

            if (string.IsNullOrWhiteSpace(dto.Name))
                throw new Exception("Tên khuyến mãi không được để trống.");

            if (dto.StartDate >= dto.EndDate)
                throw new Exception(
                    "Ngày bắt đầu phải trước ngày kết thúc.");

            if (dto.DiscountValue < 0)
                throw new Exception(
                    "Giá trị giảm giá không được âm.");

            if (dto.MaximumDiscount.HasValue &&
                dto.MaximumDiscount.Value < 0)
                throw new Exception(
                    "Mức giảm tối đa không được âm.");

            promotion.Name = dto.Name;
            promotion.Description = dto.Description;
            promotion.PromotionType = dto.PromotionType;
            promotion.DiscountValue = dto.DiscountValue;
            promotion.MaximumDiscount = dto.MaximumDiscount;
            promotion.StartDate = dto.StartDate;
            promotion.EndDate = dto.EndDate;
            promotion.Priority = dto.Priority;
            promotion.CanCombine = dto.CanCombine;
            promotion.Status = dto.Status;
            promotion.UpdatedAt = DateTime.UtcNow;

            _promotionRepository.Update(promotion);

            await _unitOfWork.SaveChangesAsync();

            return MapToDto(promotion);
        }

        public async Task<bool> DeleteAsync(int promotionId)
        {
            var promotion =
                await _promotionRepository.GetByIdAsync(promotionId);

            if (promotion == null)
                return false;

            _promotionRepository.Delete(promotion);

            await _unitOfWork.SaveChangesAsync();

            return true;
        }

        public async Task<PromotionConditionDto>
            AddConditionAsync(
                int promotionId,
                CreatePromotionConditionDto dto)
        {
            var promotion =
                await _promotionRepository.GetByIdAsync(
                    promotionId);

            if (promotion == null)
                throw new Exception(
                    "Không tìm thấy chương trình khuyến mãi.");

            if (dto.PromotionId != promotionId)
                throw new Exception(
                    "PromotionId không khớp.");

            if (dto.MinimumOrderValue.HasValue &&
                dto.MinimumOrderValue.Value < 0)
                throw new Exception(
                    "Giá trị đơn hàng tối thiểu không được âm.");

            if (dto.MinimumQuantity.HasValue &&
                dto.MinimumQuantity.Value <= 0)
                throw new Exception(
                    "Số lượng tối thiểu phải lớn hơn 0.");

            if (dto.CategoryId.HasValue)
            {
                var category =
                    await _categoryRepository.GetByIdAsync(
                        dto.CategoryId.Value);

                if (category == null)
                    throw new Exception(
                        "Không tìm thấy danh mục.");
            }

            if (dto.BrandId.HasValue)
            {
                var brand =
                    await _brandRepository.GetByIdAsync(
                        dto.BrandId.Value);

                if (brand == null)
                    throw new Exception(
                        "Không tìm thấy thương hiệu.");
            }

            var condition = new PromotionCondition
            {
                PromotionId = promotionId,
                ConditionType = dto.ConditionType,
                MinimumOrderValue = dto.MinimumOrderValue,
                MinimumQuantity = dto.MinimumQuantity,
                CategoryId = dto.CategoryId,
                BrandId = dto.BrandId,
                CustomerLevel = dto.CustomerLevel,
                Description = dto.Description
            };

            await _conditionRepository.AddAsync(condition);

            await _unitOfWork.SaveChangesAsync();

            var conditions =
                await _conditionRepository.GetByPromotionIdAsync(
                    promotionId);

            var result =
                conditions.FirstOrDefault(
                    x => x.PromotionConditionId ==
                         condition.PromotionConditionId);

            return MapConditionToDto(result!);
        }

        public async Task<bool> DeleteConditionAsync(
            int conditionId)
        {
            var condition =
                await _conditionRepository.GetByIdAsync(
                    conditionId);

            if (condition == null)
                return false;

            _conditionRepository.Delete(condition);

            await _unitOfWork.SaveChangesAsync();

            return true;
        }

        public async Task<PromotionProductDto>
            AddProductAsync(
                int promotionId,
                CreatePromotionProductDto dto)
        {
            var promotion =
                await _promotionRepository.GetByIdAsync(
                    promotionId);

            if (promotion == null)
                throw new Exception(
                    "Không tìm thấy chương trình khuyến mãi.");

            if (dto.PromotionId != promotionId)
                throw new Exception(
                    "PromotionId không khớp.");

            var variant =
                await _variantRepository.GetByIdAsync(
                    dto.VariantId);

            if (variant == null)
                throw new Exception(
                    "Không tìm thấy sản phẩm biến thể.");

            var existingProducts =
                await _productRepository.GetByPromotionIdAsync(
                    promotionId);

            if (existingProducts.Any(
                x => x.VariantId == dto.VariantId))
                throw new Exception(
                    "Sản phẩm biến thể đã được thêm vào khuyến mãi.");

            var promotionProduct = new PromotionProduct
            {
                PromotionId = promotionId,
                VariantId = dto.VariantId
            };

            await _productRepository.AddAsync(
                promotionProduct);

            await _unitOfWork.SaveChangesAsync();

            var products =
                await _productRepository.GetByPromotionIdAsync(
                    promotionId);

            var result =
                products.FirstOrDefault(
                    x => x.PromotionProductId ==
                         promotionProduct.PromotionProductId);

            return MapProductToDto(result!);
        }

        public async Task<bool> DeleteProductAsync(
            int promotionProductId)
        {
            var product =
                await _productRepository.GetByIdAsync(
                    promotionProductId);

            if (product == null)
                return false;

            _productRepository.Delete(product);

            await _unitOfWork.SaveChangesAsync();

            return true;
        }

        private PromotionDto MapToDto(Promotion promotion)
        {
            return new PromotionDto
            {
                PromotionId = promotion.PromotionId,
                Name = promotion.Name,
                Description = promotion.Description,
                PromotionType = promotion.PromotionType,
                DiscountValue = promotion.DiscountValue,
                MaximumDiscount = promotion.MaximumDiscount,
                StartDate = promotion.StartDate,
                EndDate = promotion.EndDate,
                Priority = promotion.Priority,
                CanCombine = promotion.CanCombine,
                Status = promotion.Status,
                CreatedAt = promotion.CreatedAt,
                UpdatedAt = promotion.UpdatedAt,

                PromotionConditions =
                    promotion.PromotionConditions?
                        .Select(MapConditionToDto)
                        .ToList()
                    ?? new List<PromotionConditionDto>(),

                PromotionProducts =
                    promotion.PromotionProducts?
                        .Select(MapProductToDto)
                        .ToList()
                    ?? new List<PromotionProductDto>()
            };
        }

        private PromotionConditionDto MapConditionToDto(
            PromotionCondition condition)
        {
            return new PromotionConditionDto
            {
                PromotionConditionId =
                    condition.PromotionConditionId,

                PromotionId =
                    condition.PromotionId,

                ConditionType =
                    condition.ConditionType,

                MinimumOrderValue =
                    condition.MinimumOrderValue,

                MinimumQuantity =
                    condition.MinimumQuantity,

                CategoryId =
                    condition.CategoryId,

                CategoryName =
                    condition.Category?.Name,

                BrandId =
                    condition.BrandId,

                BrandName =
                    condition.Brand?.Name,

                CustomerLevel =
                    condition.CustomerLevel,

                Description =
                    condition.Description
            };
        }

        private PromotionProductDto MapProductToDto(
            PromotionProduct product)
        {
            return new PromotionProductDto
            {
                PromotionProductId =
                    product.PromotionProductId,

                PromotionId =
                    product.PromotionId,

                VariantId =
                    product.VariantId,

                SKU =
                    product.ProductVariant?.SKU,

                ProductName =
                    product.ProductVariant?.Product?.Name
            };
        }
    }
}
