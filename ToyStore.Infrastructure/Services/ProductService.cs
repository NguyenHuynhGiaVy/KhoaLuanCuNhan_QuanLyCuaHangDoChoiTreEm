using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStore.Application.Interfaces.Repositories;
using ToyStore.Application.Interfaces.Services;
using ToyStore.Application.Interfaces;
using ToyStoreManagement.Domain.Entities;
using ToyStoreManagement.Domain.Common;
using ToyStoreManagement.Application.DTOs.Product;
using ToyStoreManagement.Application.Interfaces;
using ToyStoreManagement.Application.Interfaces.Repositories;
using ToyStoreManagement.Application.Interfaces.Services;
using Microsoft.EntityFrameworkCore;
using ToyStoreManagement.Infrastructure.Data;


namespace ToyStoreManagement.Infrastructure.Services
{
    public class ProductService : IProductService
    {
        private readonly IProductRepository _productRepository;

        private readonly IGenericRepository<ProductVariant>
            _variantRepository;

        private readonly IUnitOfWork _unitOfWork;
        private readonly ApplicationDbContext _context;

        public ProductService(
    IProductRepository productRepository,
    IGenericRepository<ProductVariant> variantRepository,
    IUnitOfWork unitOfWork,
    ApplicationDbContext context)
        {
            _productRepository = productRepository;
            _variantRepository = variantRepository;
            _unitOfWork = unitOfWork;
            _context = context;
        }

        // ==========================================
        // GET ALL PRODUCTS
        // ==========================================

        public async Task<IEnumerable<ProductDto>> GetAllAsync()
        {
            var products =
                await _productRepository
                    .GetProductsWithDetailsAsync();

            var productList = products.ToList();
            var promotionPrices = await GetActivePromotionPricesAsync(productList);

            return productList.Select(product =>
                MapToDto(product, promotionPrices));
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

            var promotionPrices = await GetActivePromotionPricesAsync(
                new[] { product });

            return MapToDto(product, promotionPrices);
        }

        // ==========================================
        // CREATE PRODUCT
        // ==========================================

        public async Task<ProductDto> CreateAsync(
            CreateProductDto dto)
        {
            if (dto.Variants == null || dto.Variants.Count == 0)
                throw new InvalidOperationException(
                    "Sản phẩm cần có ít nhất một biến thể để lập phiếu nhập kho.");

            if (dto.Variants.Any(variant => variant.Price.HasValue))
                throw new InvalidOperationException(
                    "Biến thể chỉ được nhập giá bán sau khi đã có tồn kho.");

            ValidateAgeRange(dto.AgeFrom, dto.AgeTo);
            ValidateVariantDefinitions(dto.Variants);

            var requestedSkus = dto.Variants
                .Select(variant => variant.SKU?.Trim() ?? string.Empty)
                .ToList();

            if (requestedSkus.Any(string.IsNullOrWhiteSpace))
                throw new InvalidOperationException("SKU không được để trống.");

            if (requestedSkus.GroupBy(sku => sku, StringComparer.OrdinalIgnoreCase)
                .Any(group => group.Count() > 1))
            {
                throw new InvalidOperationException(
                    "SKU của các biến thể trong cùng sản phẩm không được trùng nhau.");
            }

            if (await _context.ProductVariants.AnyAsync(variant =>
                requestedSkus.Contains(variant.SKU)))
            {
                throw new InvalidOperationException(
                    "Có SKU biến thể đã tồn tại trong hệ thống.");
            }

            var product = new Product
            {
                CategoryId = dto.CategoryId,

                BrandId = dto.BrandId,

                SupplierId = dto.SupplierId,

                Name = dto.Name,

                Description = dto.Description,

                AgeFrom = dto.AgeFrom,

                AgeTo = dto.AgeTo,

                Gender = dto.Gender,

                Status = 0,

                IsFeatured = dto.IsFeatured,

                // Giá hiển thị lấy theo biến thể. Sản phẩm mới chưa thể có giá
                // cho đến khi biến thể được nhập kho và cập nhật giá bán.
                BasePrice = null,

                IsNew = dto.IsNew,

                ImageUrl = dto.ImageUrl,

                CreatedAt = DateTime.UtcNow,

                UpdatedAt = null
            };

            await _productRepository
                .AddAsync(product);

            await _unitOfWork
                .SaveChangesAsync();

            if (dto.Variants.Count > 0)
            {
                foreach (var variantDto in dto.Variants)
                {
                    var existsSku = await _variantRepository.AnyAsync(v => v.SKU == variantDto.SKU);
                    if (existsSku)
                    {
                        throw new InvalidOperationException($"Mã SKU '{variantDto.SKU}' đã tồn tại trong hệ thống. Vui lòng nhập mã SKU khác.");
                    }

                    var variant = new ProductVariant
                    {
                        ProductId = product.ProductId,
                        SKU = variantDto.SKU.Trim(),
                        Color = GetAttributeValue(variantDto.Attributes, "Màu sắc", "Color"),
                        Size = GetAttributeValue(variantDto.Attributes, "Kích thước", "Size"),
                        Price = variantDto.Price ?? 0,
                        CostPrice = variantDto.CostPrice ?? 0,
                        Weight = variantDto.Weight,
                        ImageUrl = variantDto.ImageUrl,
                        Status = 1,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = null,
                        VariantAttributes = variantDto.Attributes.Select(attribute => new ProductVariantAttribute
                        {
                            AttributeName = attribute.AttributeName,
                            AttributeValue = attribute.AttributeValue,
                            DisplayOrder = attribute.DisplayOrder
                        }).ToList()
                    };

                    await _variantRepository.AddAsync(variant);
                }

                await _unitOfWork.SaveChangesAsync();
            }

            return await GetByIdAsync(product.ProductId)
                ?? MapToDto(product,
                    new Dictionary<int, PromotionPrice>());
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

            ValidateAgeRange(dto.AgeFrom, dto.AgeTo);

            product.CategoryId = dto.CategoryId;

            product.BrandId = dto.BrandId;

            product.SupplierId = dto.SupplierId;

            product.Name = dto.Name;

            product.Description = dto.Description;

            product.AgeFrom = dto.AgeFrom;

            product.AgeTo = dto.AgeTo;

            product.Gender = dto.Gender;

            product.IsFeatured = dto.IsFeatured;

            product.IsNew = dto.IsNew;

            product.ImageUrl = dto.ImageUrl;

            product.UpdatedAt = DateTime.UtcNow;

            _productRepository.Update(product);

            await _unitOfWork
                .SaveChangesAsync();

            return true;
        }

        private async Task SyncProductStatusAsync(int productId)
        {
            var totalQuantity = await _context.Inventories
                .Where(x => x.ProductVariant.ProductId == productId)
                .SumAsync(x => (int?)x.Quantity) ?? 0;

            var product = await _context.Products.FindAsync(productId);
            if (product == null)
                return;

            if (product.Status != 2)
                ProductStockStatus.Synchronize(product, totalQuantity);
            product.UpdatedAt = DateTime.UtcNow;
            await _unitOfWork.SaveChangesAsync();
        }

        // ==========================================
        // DELETE PRODUCT
        // ==========================================

        public async Task<bool> DeleteAsync(int productId)
        {
            var product = await _productRepository
                .GetByIdAsync(productId);

            if (product == null)
                return false;

            // Lấy toàn bộ Variant của sản phẩm
            var variantIds = await _context.ProductVariants
                .Where(x => x.ProductId == productId)
                .Select(x => x.VariantId)
                .ToListAsync();

            if (variantIds.Count > 0)
            {
                // Xóa đánh giá sản phẩm
                var reviews = await _context.ProductReviews
                    .Where(x =>
                        x.ProductId == productId ||
                        variantIds.Contains(x.VariantId))
                    .ToListAsync();

                _context.ProductReviews.RemoveRange(reviews);

                // Xóa chi tiết yêu cầu trả hàng
                var returnDetails = await _context.ReturnRequestDetails
                    .Where(x => variantIds.Contains(x.VariantId))
                    .ToListAsync();

                _context.ReturnRequestDetails.RemoveRange(returnDetails);

                // Xóa chi tiết phiếu nhập
                var importDetails = await _context.ImportReceiptDetails
                    .Where(x => variantIds.Contains(x.VariantId))
                    .ToListAsync();

                _context.ImportReceiptDetails.RemoveRange(importDetails);

                // Xóa chi tiết đơn hàng
                var orderDetails = await _context.OrderDetails
                    .Where(x => variantIds.Contains(x.VariantId))
                    .ToListAsync();

                _context.OrderDetails.RemoveRange(orderDetails);

                // Xóa sản phẩm khỏi chương trình khuyến mãi
                var promotionProducts = await _context.PromotionProducts
                    .Where(x => variantIds.Contains(x.VariantId))
                    .ToListAsync();

                _context.PromotionProducts.RemoveRange(promotionProducts);

                // Xóa lịch sử biến động kho
                var inventoryTransactions = await _context.InventoryTransactions
                    .Where(x => variantIds.Contains(x.VariantId))
                    .ToListAsync();

                _context.InventoryTransactions.RemoveRange(inventoryTransactions);

                // Xóa tồn kho
                var inventories = await _context.Inventories
                    .Where(x => variantIds.Contains(x.VariantId))
                    .ToListAsync();

                _context.Inventories.RemoveRange(inventories);

                // Xóa toàn bộ Variant
                var variants = await _context.ProductVariants
                    .Where(x => variantIds.Contains(x.VariantId))
                    .ToListAsync();

                _context.ProductVariants.RemoveRange(variants);
            }

            // Cuối cùng xóa Product
            _context.Products.Remove(product);

            await _unitOfWork.SaveChangesAsync();

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

            if (dto.Price.HasValue)
                throw new InvalidOperationException(
                    "Biến thể mới chỉ được nhập giá bán sau khi đã có tồn kho từ phiếu nhập NCC.");

            ValidateVariantAttributes(dto.Attributes);

            // Kiểm tra trùng tổ hợp thuộc tính với các biến thể đã có của sản phẩm này
            if (dto.Attributes != null && dto.Attributes.Count > 0)
            {
                var existingVariants = await _context.ProductVariants
                    .Include(v => v.VariantAttributes)
                    .Where(v => v.ProductId == productId)
                    .ToListAsync();

                var newDef = string.Join("|", dto.Attributes
                    .OrderBy(a => a.AttributeName, StringComparer.OrdinalIgnoreCase)
                    .ThenBy(a => a.AttributeValue, StringComparer.OrdinalIgnoreCase)
                    .Select(a => $"{a.AttributeName.Trim().ToUpperInvariant()}:{a.AttributeValue.Trim().ToUpperInvariant()}"));

                foreach (var ev in existingVariants)
                {
                    if (ev.VariantAttributes == null || !ev.VariantAttributes.Any())
                        continue;

                    var existingDef = string.Join("|", ev.VariantAttributes
                        .OrderBy(a => a.AttributeName, StringComparer.OrdinalIgnoreCase)
                        .ThenBy(a => a.AttributeValue, StringComparer.OrdinalIgnoreCase)
                        .Select(a => $"{a.AttributeName.Trim().ToUpperInvariant()}:{a.AttributeValue.Trim().ToUpperInvariant()}"));

                    if (string.Equals(newDef, existingDef, StringComparison.OrdinalIgnoreCase))
                    {
                        throw new InvalidOperationException(
                            "Đã tồn tại biến thể khác của sản phẩm này có cùng tổ hợp thuộc tính.");
                    }
                }
            }

            var variant = new ProductVariant
            {
                ProductId = productId,

                SKU = dto.SKU,

                Color = GetAttributeValue(dto.Attributes, "Màu sắc", "Color"),

                Size = GetAttributeValue(dto.Attributes, "Kích thước", "Size"),

                Price = dto.Price ?? 0,

                CostPrice = dto.CostPrice ?? 0,

                Weight = dto.Weight,

                ImageUrl = dto.ImageUrl,

                Status = 1,

                CreatedAt = DateTime.UtcNow,

                UpdatedAt = null
            };

            variant.VariantAttributes = dto.Attributes.Select(attribute => new ProductVariantAttribute
            {
                AttributeName = attribute.AttributeName,
                AttributeValue = attribute.AttributeValue,
                DisplayOrder = attribute.DisplayOrder
            }).ToList();

            await _variantRepository
                .AddAsync(variant);

            await _unitOfWork
                .SaveChangesAsync();

            return MapVariantToDto(variant, null);
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

            ValidateVariantAttributes(dto.Attributes);

            // Kiểm tra trùng tổ hợp thuộc tính với các biến thể khác của sản phẩm này
            if (dto.Attributes != null && dto.Attributes.Count > 0)
            {
                var otherVariants = await _context.ProductVariants
                    .Include(v => v.VariantAttributes)
                    .Where(v => v.ProductId == variant.ProductId && v.VariantId != variantId)
                    .ToListAsync();

                var updatedDef = string.Join("|", dto.Attributes
                    .OrderBy(a => a.AttributeName, StringComparer.OrdinalIgnoreCase)
                    .ThenBy(a => a.AttributeValue, StringComparer.OrdinalIgnoreCase)
                    .Select(a => $"{a.AttributeName.Trim().ToUpperInvariant()}:{a.AttributeValue.Trim().ToUpperInvariant()}"));

                foreach (var ov in otherVariants)
                {
                    if (ov.VariantAttributes == null || !ov.VariantAttributes.Any())
                        continue;

                    var otherDef = string.Join("|", ov.VariantAttributes
                        .OrderBy(a => a.AttributeName, StringComparer.OrdinalIgnoreCase)
                        .ThenBy(a => a.AttributeValue, StringComparer.OrdinalIgnoreCase)
                        .Select(a => $"{a.AttributeName.Trim().ToUpperInvariant()}:{a.AttributeValue.Trim().ToUpperInvariant()}"));

                    if (string.Equals(updatedDef, otherDef, StringComparison.OrdinalIgnoreCase))
                    {
                        throw new InvalidOperationException(
                            "Đã tồn tại biến thể khác của sản phẩm này có cùng tổ hợp thuộc tính.");
                    }
                }
            }

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

            variant.Color = GetAttributeValue(dto.Attributes, "Màu sắc", "Color");

            variant.Size = GetAttributeValue(dto.Attributes, "Kích thước", "Size");

            if (dto.Price.HasValue)
            {
                var hasInventory = await HasVariantAvailableInventoryAsync(variantId);
                if (!hasInventory)
                    throw new InvalidOperationException(
                        "Chỉ có thể nhập giá bán cho biến thể khi biến thể đã có tồn kho từ phiếu nhập NCC.");

                variant.Price = dto.Price.Value;
            }

            if (dto.CostPrice.HasValue)
                variant.CostPrice = dto.CostPrice.Value;

            variant.Weight = dto.Weight;

            variant.ImageUrl = dto.ImageUrl;

            var oldAttributes = await _context.ProductVariantAttributes
                .Where(attribute => attribute.VariantId == variantId)
                .ToListAsync();
            _context.ProductVariantAttributes.RemoveRange(oldAttributes);
            variant.VariantAttributes = dto.Attributes.Select(attribute => new ProductVariantAttribute
            {
                VariantId = variantId,
                AttributeName = attribute.AttributeName,
                AttributeValue = attribute.AttributeValue,
                DisplayOrder = attribute.DisplayOrder
            }).ToList();

            variant.UpdatedAt = DateTime.UtcNow;

            _variantRepository.Update(variant);

            await _unitOfWork
                .SaveChangesAsync();

            return true;
        }

        private static void ValidateAgeRange(int? ageFrom, int? ageTo)
        {
            if (ageFrom.HasValue && ageFrom.Value < 0
                || ageTo.HasValue && ageTo.Value < 0)
            {
                throw new InvalidOperationException(
                    "Độ tuổi phù hợp không được là số âm.");
            }

            if (ageFrom.HasValue && ageTo.HasValue && ageFrom > ageTo)
            {
                throw new InvalidOperationException(
                    "Độ tuổi bắt đầu không được lớn hơn độ tuổi kết thúc.");
            }
        }

        private static void ValidateVariantDefinitions(
            IReadOnlyCollection<CreateProductVariantDto> variants)
        {
            foreach (var variant in variants)
                ValidateVariantAttributes(variant.Attributes);

            if (variants.Count <= 1)
                return;

            if (variants.Any(variant => variant.Attributes == null
                || !variant.Attributes.Any()))
            {
                throw new InvalidOperationException(
                    "Khi có nhiều biến thể, mỗi biến thể cần nêu ít nhất một thông số khác biệt.");
            }

            var duplicatedDefinitions = variants
                .Select(variant => string.Join("|", variant.Attributes
                    .OrderBy(attribute => attribute.AttributeName,
                        StringComparer.OrdinalIgnoreCase)
                    .ThenBy(attribute => attribute.AttributeValue,
                        StringComparer.OrdinalIgnoreCase)
                    .Select(attribute =>
                        $"{attribute.AttributeName.Trim().ToUpperInvariant()}:{attribute.AttributeValue.Trim().ToUpperInvariant()}")))
                .GroupBy(definition => definition, StringComparer.OrdinalIgnoreCase)
                .Any(group => group.Count() > 1);

            if (duplicatedDefinitions)
            {
                throw new InvalidOperationException(
                    "Các biến thể phải có thông số khác biệt nhau.");
            }
        }

        private static void ValidateVariantAttributes(
            IEnumerable<CreateProductVariantAttributeDto>? attributes)
        {
            if (attributes == null)
                return;

            var attrList = attributes.ToList();

            if (attrList.Any(attribute =>
                string.IsNullOrWhiteSpace(attribute.AttributeName)
                || string.IsNullOrWhiteSpace(attribute.AttributeValue)))
            {
                throw new InvalidOperationException(
                    "Mỗi thông số biến thể cần có cả tên và giá trị.");
            }

            // Quy tắc nghiệp vụ: Một biến thể KHÔNG THỂ chứa 2 giá trị cho cùng 1 thuộc tính (VD: không thể có 2 Size hoặc 2 Màu trong 1 biến thể)
            var duplicateNames = attrList
                .GroupBy(a => a.AttributeName.Trim(), StringComparer.OrdinalIgnoreCase)
                .Where(g => g.Count() > 1)
                .Select(g => g.Key)
                .ToList();

            if (duplicateNames.Any())
            {
                throw new InvalidOperationException(
                    $"Một biến thể không thể chứa nhiều giá trị cho cùng một thuộc tính ({string.Join(", ", duplicateNames)}).");
            }
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
            Product product,
            IReadOnlyDictionary<int, PromotionPrice> promotionPrices)
        {
            return new ProductDto
            {
                ProductId = product.ProductId,

                CategoryId = product.CategoryId,

                CategoryName =
                    product.Category?.Name,

                BrandId = product.BrandId,

                SupplierId = product.SupplierId,

                BrandName =
                    product.Brand?.Name,

                SupplierName =
                    product.Supplier?.Name,

                Name = product.Name,

                Description = product.Description,

                AgeFrom = product.AgeFrom,

                AgeTo = product.AgeTo,

                Gender = product.Gender,

                Status = product.Status,

                IsFeatured = product.IsFeatured,

                BasePrice = product.BasePrice,

                IsNew = product.IsNew,

                ImageUrl = product.ImageUrl,

                CreatedAt = product.CreatedAt,

                UpdatedAt = product.UpdatedAt,

                ProductVariants =
                    product.ProductVariants?
                        .Select(variant => MapVariantToDto(
                            variant,
                            promotionPrices.TryGetValue(
                                variant.VariantId,
                                out var promotionPrice)
                                ? promotionPrice
                                : null))
                        .ToList()
                    ?? new List<ProductVariantDto>()
            };
        }

        // ==========================================
        // MAP VARIANT -> DTO
        // ==========================================

        private static ProductVariantDto
            MapVariantToDto(
                ProductVariant variant,
                PromotionPrice? promotionPrice)
        {
            var originalPrice = variant.Price;
            var salePrice = promotionPrice?.SalePrice ?? originalPrice;
            var discountAmount = promotionPrice?.DiscountAmount ?? 0;

            return new ProductVariantDto
            {
                VariantId = variant.VariantId,

                ProductId = variant.ProductId,

                SKU = variant.SKU,

                Color = variant.VariantAttributes?
                    .FirstOrDefault(x => x.AttributeName.Equals("Màu sắc", StringComparison.OrdinalIgnoreCase))?.AttributeValue
                    ?? variant.VariantAttributes?.FirstOrDefault(x => x.AttributeName.Equals("Color", StringComparison.OrdinalIgnoreCase))?.AttributeValue,

                Size = variant.VariantAttributes?
                    .FirstOrDefault(x => x.AttributeName.Equals("Kích thước", StringComparison.OrdinalIgnoreCase))?.AttributeValue
                    ?? variant.VariantAttributes?.FirstOrDefault(x => x.AttributeName.Equals("Size", StringComparison.OrdinalIgnoreCase))?.AttributeValue,

                Attributes = variant.VariantAttributes?
                    .OrderBy(x => x.DisplayOrder)
                    .Select(x => new CreateProductVariantAttributeDto
                    {
                        AttributeName = x.AttributeName,
                        AttributeValue = x.AttributeValue,
                        DisplayOrder = x.DisplayOrder
                    }).ToList() ?? new List<CreateProductVariantAttributeDto>(),

                Price = variant.Price,

                OriginalPrice = originalPrice,

                SalePrice = salePrice,

                PromotionDiscountAmount = discountAmount,

                PromotionName = promotionPrice?.PromotionName,

                CostPrice = variant.CostPrice,

                Weight = variant.Weight,

                ImageUrl = variant.ImageUrl,

                Status = variant.Status,

                AvailableQuantity = variant.Inventory == null
                    ? null
                    : Math.Max(0, variant.Inventory.Quantity - variant.Inventory.ReservedQuantity),

                CreatedAt = variant.CreatedAt,

                UpdatedAt = variant.UpdatedAt
            };
        }

        private async Task<IReadOnlyDictionary<int, PromotionPrice>>
            GetActivePromotionPricesAsync(IEnumerable<Product> products)
        {
            var productList = products.ToList();
            if (productList.Count == 0)
                return new Dictionary<int, PromotionPrice>();

            var now = DateTime.UtcNow;
            var promotions = await _context.Promotions
                .AsNoTracking()
                .Include(promotion => promotion.PromotionProducts)
                .Include(promotion => promotion.PromotionConditions)
                .Where(promotion => promotion.Status == 1
                    && promotion.StartDate <= now
                    && promotion.EndDate >= now)
                .ToListAsync();

            var result = new Dictionary<int, PromotionPrice>();

            foreach (var product in productList)
            {
                foreach (var variant in product.ProductVariants ??
                    Enumerable.Empty<ProductVariant>())
                {
                    if (variant.Price <= 0)
                        continue;

                    PromotionPrice? bestPrice = null;

                    foreach (var promotion in promotions)
                    {
                        if (!AppliesToVariant(promotion, variant.VariantId))
                            continue;

                        if (promotion.PromotionConditions.Any(condition =>
                            (condition.CategoryId.HasValue
                                && condition.CategoryId.Value != product.CategoryId)
                            || (condition.BrandId.HasValue
                                && condition.BrandId.Value != product.BrandId)))
                        {
                            continue;
                        }

                        // Điều kiện giỏ hàng (giá trị đơn/số lượng) chỉ được
                        // xác nhận ở lúc tạo đơn. Giá trên catalog chỉ phản ánh
                        // chương trình áp trực tiếp cho sản phẩm.
                        if (promotion.PromotionConditions.Any(condition =>
                            condition.MinimumOrderValue.HasValue
                            || condition.MinimumQuantity.HasValue
                            || condition.CustomerLevel.HasValue))
                        {
                            continue;
                        }

                        var discountAmount = CalculatePromotionDiscount(
                            variant.Price,
                            promotion);

                        if (discountAmount <= 0)
                            continue;

                        var candidate = new PromotionPrice(
                            Math.Max(0, variant.Price - discountAmount),
                            discountAmount,
                            promotion.Name,
                            promotion.Priority);

                        if (bestPrice == null
                            || candidate.DiscountAmount > bestPrice.DiscountAmount
                            || (candidate.DiscountAmount == bestPrice.DiscountAmount
                                && candidate.Priority > bestPrice.Priority))
                        {
                            bestPrice = candidate;
                        }
                    }

                    if (bestPrice != null)
                        result[variant.VariantId] = bestPrice;
                }
            }

            return result;
        }

        private static bool AppliesToVariant(
            Promotion promotion,
            int variantId)
        {
            // Khuyến mãi mặt hàng chỉ có hiệu lực khi biến thể đã được chọn.
            return promotion.PromotionProducts.Any(product =>
                    product.VariantId == variantId);
        }

        private static decimal CalculatePromotionDiscount(
            decimal price,
            Promotion promotion)
        {
            var discount = promotion.PromotionType == 0
                ? price * promotion.DiscountValue / 100m
                : promotion.DiscountValue;

            if (promotion.MaximumDiscount.HasValue)
                discount = Math.Min(discount,
                    promotion.MaximumDiscount.Value);

            return Math.Min(price, Math.Max(0, discount));
        }

        private sealed record PromotionPrice(
            decimal SalePrice,
            decimal DiscountAmount,
            string? PromotionName,
            int Priority);

        private static string GetAttributeValue(
            IEnumerable<CreateProductVariantAttributeDto> attributes,
            params string[] names)
        {
            return attributes
                .FirstOrDefault(attribute => names.Any(name =>
                    attribute.AttributeName.Equals(name, StringComparison.OrdinalIgnoreCase)))
                ?.AttributeValue ?? string.Empty;
        }

        private Task<bool> HasProductAvailableInventoryAsync(int productId)
        {
            return _context.Inventories.AnyAsync(inventory =>
                inventory.ProductVariant.ProductId == productId &&
                inventory.Quantity - inventory.ReservedQuantity > 0);
        }

        private Task<bool> HasVariantAvailableInventoryAsync(int variantId)
        {
            return _context.Inventories.AnyAsync(inventory =>
                inventory.VariantId == variantId &&
                inventory.Quantity - inventory.ReservedQuantity > 0);
        }
    }
}
