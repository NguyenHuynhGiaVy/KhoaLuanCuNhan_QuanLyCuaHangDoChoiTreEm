using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStoreManagement.Application.DTOs.Inventory;
using ToyStoreManagement.Application.Interfaces;
using ToyStoreManagement.Application.Interfaces.Repositories;
using ToyStoreManagement.Application.Interfaces.Services;
using ToyStoreManagement.Domain.Entities;
using ToyStore.Application.Interfaces.Repositories;
using Microsoft.EntityFrameworkCore;
using ToyStoreManagement.Infrastructure.Data;
using ToyStoreManagement.Domain.Common;

namespace ToyStoreManagement.Infrastructure.Services
{
    public class InventoryService : IInventoryService
    {
        private readonly IInventoryRepository _inventoryRepository;
        private readonly IGenericRepository<ProductVariant> _variantRepository;
        private readonly IUnitOfWork _unitOfWork;
        private readonly ApplicationDbContext _context;

        public InventoryService(
            IInventoryRepository inventoryRepository,
            IGenericRepository<ProductVariant> variantRepository,
            IUnitOfWork unitOfWork,
            ApplicationDbContext context)
        {
            _inventoryRepository = inventoryRepository;
            _variantRepository = variantRepository;
            _unitOfWork = unitOfWork;
            _context = context;
        }

        public async Task<IEnumerable<InventoryDto>> GetAllAsync()
        {
            var inventories =
                await _inventoryRepository.GetAllWithDetailsAsync();

            return inventories.Select(MapToDto);
        }

        public async Task<InventoryDto?> GetByIdAsync(int inventoryId)
        {
            var inventory =
                await _inventoryRepository.GetByIdWithDetailsAsync(inventoryId);

            return inventory == null ? null : MapToDto(inventory);
        }

        public async Task<InventoryDto?> GetByVariantIdAsync(int variantId)
        {
            var inventory =
                await _inventoryRepository.GetByVariantIdAsync(variantId);

            return inventory == null ? null : MapToDto(inventory);
        }

        public async Task<InventoryDto> CreateAsync(CreateInventoryDto dto)
        {
            if (dto.Quantity < 0)
                throw new Exception("Số lượng tồn kho không được âm.");

            if (dto.ReservedQuantity < 0)
                throw new Exception("Số lượng đã giữ không được âm.");

            if (dto.ReservedQuantity > dto.Quantity)
                throw new Exception(
                    "Số lượng đã giữ không được lớn hơn số lượng tồn kho.");

            var variant =
                await _variantRepository.GetByIdAsync(dto.VariantId);

            if (variant == null)
                throw new Exception("Không tìm thấy ProductVariant.");

            var existing =
                await _inventoryRepository.GetByVariantIdAsync(dto.VariantId);

            if (existing != null)
                throw new Exception(
                    "ProductVariant này đã có bản ghi tồn kho.");

            var inventory = new Inventory
            {
                VariantId = dto.VariantId,
                Quantity = dto.Quantity,
                ReservedQuantity = dto.ReservedQuantity,
                UpdatedAt = DateTime.UtcNow
            };

            await _inventoryRepository.AddAsync(inventory);
            await _unitOfWork.SaveChangesAsync();

            await SyncProductStatusAsync(dto.VariantId);

            var result =
                await _inventoryRepository.GetByIdWithDetailsAsync(
                    inventory.InventoryId);

            return MapToDto(result!);
        }

        public async Task<InventoryDto?> UpdateAsync(
            int inventoryId,
            UpdateInventoryDto dto)
        {
            if (dto.Quantity < 0)
                throw new Exception("Số lượng tồn kho không được âm.");

            if (dto.ReservedQuantity < 0)
                throw new Exception("Số lượng đã giữ không được âm.");

            if (dto.ReservedQuantity > dto.Quantity)
                throw new Exception(
                    "Số lượng đã giữ không được lớn hơn số lượng tồn kho.");

            var inventory =
                await _inventoryRepository.GetByIdAsync(inventoryId);

            if (inventory == null)
                return null;

            inventory.Quantity = dto.Quantity;
            inventory.ReservedQuantity = dto.ReservedQuantity;
            inventory.UpdatedAt = DateTime.UtcNow;

            _inventoryRepository.Update(inventory);

            await _unitOfWork.SaveChangesAsync();

            await SyncProductStatusAsync(inventory.VariantId);

            var result =
                await _inventoryRepository.GetByIdWithDetailsAsync(
                    inventoryId);

            return MapToDto(result!);
        }

        public async Task<InventoryDto> AuditStockAsync(InventoryAuditDto dto)
        {
            if (dto.ActualQuantity < 0)
                throw new Exception("Số lượng thực tế kiểm kê không được âm.");

            var inventory = await _inventoryRepository.GetByVariantIdAsync(dto.VariantId);
            if (inventory == null)
            {
                var variant = await _context.ProductVariants.FindAsync(dto.VariantId);
                if (variant == null)
                    throw new Exception("Không tìm thấy biến thể sản phẩm.");

                inventory = new Inventory
                {
                    VariantId = dto.VariantId,
                    Quantity = 0,
                    ReservedQuantity = 0,
                    UpdatedAt = DateTime.UtcNow
                };
                await _inventoryRepository.AddAsync(inventory);
                await _unitOfWork.SaveChangesAsync();
            }

            int oldQuantity = inventory.Quantity;
            int diff = dto.ActualQuantity - oldQuantity;

            inventory.Quantity = dto.ActualQuantity;
            inventory.UpdatedAt = DateTime.UtcNow;

            _inventoryRepository.Update(inventory);

            // Ghi nhật ký thẻ kho biến động kiểm kê
            _context.InventoryTransactions.Add(new InventoryTransaction
            {
                VariantId = dto.VariantId,
                TransactionType = 3, // 3: Điều chỉnh kiểm kê
                Quantity = diff,
                ReferenceType = "InventoryAudit",
                ReferenceId = inventory.InventoryId,
                Note = $"Kiểm kê kho: Thực tế {dto.ActualQuantity}, Hệ thống cũ {oldQuantity}, Chênh lệch {(diff > 0 ? "+" : "")}{diff}. Lý do: {dto.Reason ?? "Kiểm kê cân bằng kho định kỳ"}",
                CreatedAt = DateTime.UtcNow
            });

            await _unitOfWork.SaveChangesAsync();
            await SyncProductStatusAsync(dto.VariantId);

            var updated = await _inventoryRepository.GetByIdWithDetailsAsync(inventory.InventoryId);
            return MapToDto(updated!);
        }

        public async Task<IEnumerable<StockMovementSummaryDto>> GetStockMovementReportAsync(StockMovementFilterDto filter)
        {
            var fromDate = filter?.FromDate ?? DateTime.UtcNow.AddMonths(-1);
            var toDate = filter?.ToDate ?? DateTime.UtcNow;

            var variantQuery = _context.ProductVariants
                .AsNoTracking()
                .Include(v => v.Product)
                .Include(v => v.VariantAttributes)
                .AsQueryable();

            if (filter?.VariantId.HasValue == true)
            {
                variantQuery = variantQuery.Where(v => v.VariantId == filter.VariantId.Value);
            }
            else if (filter?.ProductId.HasValue == true)
            {
                variantQuery = variantQuery.Where(v => v.ProductId == filter.ProductId.Value);
            }

            var variants = await variantQuery.ToListAsync();
            var variantIds = variants.Select(v => v.VariantId).ToList();

            var inventories = await _context.Inventories
                .AsNoTracking()
                .Where(i => variantIds.Contains(i.VariantId))
                .ToDictionaryAsync(i => i.VariantId, i => i.Quantity);

            var transactions = await _context.InventoryTransactions
                .AsNoTracking()
                .Where(t => variantIds.Contains(t.VariantId))
                .ToListAsync();

            var result = new List<StockMovementSummaryDto>();

            foreach (var variant in variants)
            {
                int currentStock = inventories.TryGetValue(variant.VariantId, out var qty) ? qty : 0;
                var varTxns = transactions.Where(t => t.VariantId == variant.VariantId).ToList();

                // Giao dịch sau khoảng ToDate
                int afterToDateNet = varTxns.Where(t => t.CreatedAt > toDate).Sum(t => t.Quantity);
                int closingStockAtToDate = currentStock - afterToDateNet;

                // Giao dịch trong kỳ [FromDate, ToDate]
                var inPeriodTxns = varTxns.Where(t => t.CreatedAt >= fromDate && t.CreatedAt <= toDate).ToList();
                int inStock = inPeriodTxns.Where(t => t.Quantity > 0).Sum(t => t.Quantity);
                int outStock = inPeriodTxns.Where(t => t.Quantity < 0).Sum(t => Math.Abs(t.Quantity));

                // Tồn đầu kỳ = Tồn cuối kỳ - Nhập trong kỳ + Xuất trong kỳ
                int openingStock = closingStockAtToDate - inStock + outStock;
                if (openingStock < 0)
                {
                    openingStock = 0;
                    closingStockAtToDate = openingStock + inStock - outStock;
                }

                // Attributes string
                var attrTexts = variant.VariantAttributes?
                    .OrderBy(a => a.DisplayOrder)
                    .Select(a => $"{a.AttributeName}: {a.AttributeValue}")
                    .ToList();
                string attributesStr = attrTexts != null && attrTexts.Any() ? string.Join(", ", attrTexts) : (variant.Color ?? "Tiêu chuẩn");

                decimal unitCost = variant.CostPrice > 0 ? variant.CostPrice : (variant.Price > 0 ? Math.Round(variant.Price * 0.65m, 0) : 0);
                decimal totalCost = Math.Max(0, closingStockAtToDate) * unitCost;

                result.Add(new StockMovementSummaryDto
                {
                    VariantId = variant.VariantId,
                    SKU = variant.SKU,
                    ProductName = variant.Product?.Name ?? "N/A",
                    Attributes = attributesStr,
                    OpeningStock = openingStock,
                    InStock = inStock,
                    OutStock = outStock,
                    ClosingStock = closingStockAtToDate,
                    UnitCost = unitCost,
                    TotalCostValue = totalCost
                });
            }

            return result;
        }

        private async Task SyncProductStatusAsync(int variantId)
        {
            var variant = await _context.ProductVariants
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.VariantId == variantId);

            if (variant == null)
                return;

            var product = await _context.Products.FindAsync(variant.ProductId);
            if (product == null)
                return;

            var totalQuantity = await _context.Inventories
                .Where(x => x.ProductVariant.ProductId == product.ProductId)
                .SumAsync(x => (int?)x.Quantity) ?? 0;

            ProductStockStatus.Synchronize(product, totalQuantity);

            product.UpdatedAt = DateTime.UtcNow;
            await _unitOfWork.SaveChangesAsync();
        }

        private static InventoryDto MapToDto(Inventory inventory)
        {
            var variant = inventory.ProductVariant;
            var available = inventory.Quantity - inventory.ReservedQuantity;

            string? color = variant?.VariantAttributes?
                .FirstOrDefault(x => x.AttributeName.Equals("Màu sắc", StringComparison.OrdinalIgnoreCase) || x.AttributeName.Equals("Color", StringComparison.OrdinalIgnoreCase))?.AttributeValue
                ?? variant?.Color;

            string? size = variant?.VariantAttributes?
                .FirstOrDefault(x => x.AttributeName.Equals("Kích thước", StringComparison.OrdinalIgnoreCase) || x.AttributeName.Equals("Size", StringComparison.OrdinalIgnoreCase))?.AttributeValue
                ?? variant?.Size;

            string? ageRange = variant?.Product != null
                ? $"{variant.Product.AgeFrom} - {variant.Product.AgeTo} tuổi"
                : null;

            return new InventoryDto
            {
                InventoryId = inventory.InventoryId,
                VariantId = inventory.VariantId,
                SKU = variant?.SKU ?? string.Empty,
                ProductName = variant?.Product?.Name ?? string.Empty,
                Quantity = inventory.Quantity,
                ReservedQuantity = inventory.ReservedQuantity,
                AvailableQuantity = available,
                Color = color,
                Size = size,
                AgeRange = ageRange,
                Price = variant?.Price ?? 0,
                CostPrice = variant?.CostPrice ?? 0,
                IsLowStock = available <= 5,
                IsSlowMoving = inventory.UpdatedAt < DateTime.UtcNow.AddMonths(-2) && available > 10,
                UpdatedAt = inventory.UpdatedAt
            };
        }

        public async Task<bool> DeleteAsync(int inventoryId)
        {
            var inventory =
                await _inventoryRepository.GetByIdAsync(inventoryId);

            if (inventory == null)
                return false;

            _inventoryRepository.Delete(inventory);

            await _unitOfWork.SaveChangesAsync();

            await SyncProductStatusAsync(inventory.VariantId);

            return true;
        }
    }
}
