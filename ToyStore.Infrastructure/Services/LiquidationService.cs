using System.Data;
using Microsoft.EntityFrameworkCore;
using ToyStoreManagement.Application.DTOs.Liquidation;
using ToyStoreManagement.Application.Interfaces.Services;
using ToyStoreManagement.Domain.Entities;
using ToyStoreManagement.Infrastructure.Data;
using ToyStoreManagement.Domain.Common;

namespace ToyStoreManagement.Infrastructure.Services
{
    public class LiquidationService : ILiquidationService
    {
        private readonly ApplicationDbContext _context;

        public LiquidationService(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<LiquidationReceiptDto>> GetAllAsync()
        {
            var receipts = await _context.LiquidationReceipts
                .Include(x => x.Details)
                    .ThenInclude(x => x.ProductVariant)
                        .ThenInclude(x => x.Product)
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync();
            return receipts.Select(Map);
        }

        public async Task<LiquidationReceiptDto?> GetByIdAsync(int id)
        {
            var receipt = await GetReceipt(id);
            return receipt == null ? null : Map(receipt);
        }

        public async Task<LiquidationReceiptDto> CreateAsync(
            CreateLiquidationReceiptDto dto,
            string userId)
        {
            if (dto.Details == null || dto.Details.Count == 0)
                throw new InvalidOperationException("Phiếu thanh lý phải có ít nhất một sản phẩm.");
            if (dto.Details.Any(x => x.Quantity <= 0))
                throw new InvalidOperationException("Số lượng thanh lý phải lớn hơn 0.");
            if (dto.Details.GroupBy(x => x.VariantId).Any(x => x.Count() > 1))
                throw new InvalidOperationException("Không được lặp SKU trong cùng một phiếu thanh lý.");

            await using var transaction = await _context.Database
                .BeginTransactionAsync(IsolationLevel.Serializable);

            var variants = new Dictionary<int, ProductVariant>();
            foreach (var detail in dto.Details)
            {
                var variant = await _context.ProductVariants
                    .Include(x => x.Inventory)
                    .Include(x => x.Product)
                    .FirstOrDefaultAsync(x => x.VariantId == detail.VariantId);
                if (variant == null)
                    throw new InvalidOperationException($"Không tìm thấy biến thể ID {detail.VariantId}.");
                if (variant.Inventory == null
                    || variant.Inventory.Quantity <= 0
                    || variant.Inventory.ReservedQuantity < 0
                    || variant.Inventory.ReservedQuantity > variant.Inventory.Quantity)
                    throw new InvalidOperationException($"SKU {variant.SKU} không có tồn kho.");
                if (detail.Quantity > variant.Inventory.Quantity - variant.Inventory.ReservedQuantity)
                    throw new InvalidOperationException($"Số lượng thanh lý SKU {variant.SKU} vượt tồn kho khả dụng.");
                variants.Add(detail.VariantId, variant);
            }

            var now = DateTime.UtcNow;
            var receipt = new LiquidationReceipt
            {
                ReceiptCode = $"LIQ-{now:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}"[..42],
                CreatedByUserId = userId,
                Note = string.IsNullOrWhiteSpace(dto.Note) ? null : dto.Note.Trim(),
                Status = 0,
                CreatedAt = now,
                Details = dto.Details.Select(item => new LiquidationReceiptDetail
                {
                    VariantId = item.VariantId,
                    Quantity = item.Quantity
                }).ToList()
            };

            _context.LiquidationReceipts.Add(receipt);
            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            foreach (var item in receipt.Details)
                item.ProductVariant = variants[item.VariantId];
            return Map(receipt);
        }

        public async Task<LiquidationReceiptDto?> CompleteAsync(int id)
        {
            await using var transaction = await _context.Database
                .BeginTransactionAsync(IsolationLevel.Serializable);
            var receipt = await GetReceipt(id);
            if (receipt == null)
                return null;
            if (receipt.Status == 1)
                throw new InvalidOperationException("Phiếu thanh lý đã hoàn tất.");
            if (receipt.Status == 2)
                throw new InvalidOperationException("Phiếu đã hủy không thể tiếp tục xử lý.");
            if (receipt.Details.Count == 0)
                throw new InvalidOperationException("Phiếu thanh lý không có sản phẩm.");

            var affectedProductIds = new HashSet<int>();
            foreach (var detail in receipt.Details)
            {
                var variant = await _context.ProductVariants
                    .Include(x => x.Inventory)
                    .FirstOrDefaultAsync(x => x.VariantId == detail.VariantId);
                if (variant?.Inventory == null)
                    throw new InvalidOperationException($"SKU {detail.ProductVariant.SKU} không còn tồn kho.");
                var inventory = variant.Inventory;
                if (inventory.Quantity < 0
                    || inventory.ReservedQuantity < 0
                    || inventory.ReservedQuantity > inventory.Quantity)
                    throw new InvalidOperationException($"Dữ liệu tồn kho SKU {variant.SKU} không hợp lệ.");
                if (detail.Quantity <= 0 || detail.Quantity > inventory.Quantity - inventory.ReservedQuantity)
                    throw new InvalidOperationException($"Tồn kho khả dụng của SKU {variant.SKU} đã thay đổi; không thể thanh lý.");

                inventory.Quantity -= detail.Quantity;
                inventory.UpdatedAt = DateTime.UtcNow;
                affectedProductIds.Add(variant.ProductId);
                _context.InventoryTransactions.Add(new InventoryTransaction
                {
                    TransactionId = 0,
                    VariantId = variant.VariantId,
                    TransactionType = 2,
                    Quantity = -detail.Quantity,
                    ReferenceType = "Liquidation",
                    ReferenceId = receipt.LiquidationReceiptId,
                    Note = $"Thanh lý theo phiếu {receipt.ReceiptCode}",
                    CreatedAt = DateTime.UtcNow
                });
            }

            foreach (var productId in affectedProductIds)
            {
                var product = await _context.Products.FindAsync(productId);
                if (product == null)
                    continue;
                var totalStock = await _context.Inventories
                    .Where(x => x.ProductVariant.ProductId == productId)
                    .SumAsync(x => (int?)x.Quantity) ?? 0;
                ProductStockStatus.Synchronize(product, totalStock);
                product.UpdatedAt = DateTime.UtcNow;
            }

            receipt.Status = 1;
            receipt.CompletedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
            return Map(receipt);
        }

        public async Task<LiquidationReceiptDto?> CancelAsync(int id)
        {
            await using var transaction = await _context.Database
                .BeginTransactionAsync(IsolationLevel.Serializable);
            var receipt = await _context.LiquidationReceipts
                .Include(x => x.Details).ThenInclude(x => x.ProductVariant).ThenInclude(x => x.Product)
                .FirstOrDefaultAsync(x => x.LiquidationReceiptId == id);
            if (receipt == null)
                return null;
            if (receipt.Status != 0)
                throw new InvalidOperationException("Chỉ có thể hủy phiếu thanh lý đang chờ xử lý.");
            receipt.Status = 2;
            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
            return Map(receipt);
        }

        private Task<LiquidationReceipt?> GetReceipt(int id)
        {
            return _context.LiquidationReceipts
                .Include(x => x.Details)
                    .ThenInclude(x => x.ProductVariant)
                        .ThenInclude(x => x.Product)
                .FirstOrDefaultAsync(x => x.LiquidationReceiptId == id);
        }

        private static LiquidationReceiptDto Map(LiquidationReceipt receipt)
        {
            return new LiquidationReceiptDto
            {
                LiquidationReceiptId = receipt.LiquidationReceiptId,
                ReceiptCode = receipt.ReceiptCode,
                CreatedByUserId = receipt.CreatedByUserId,
                Note = receipt.Note,
                Status = receipt.Status,
                CreatedAt = receipt.CreatedAt,
                CompletedAt = receipt.CompletedAt,
                Details = receipt.Details.Select(x => new LiquidationReceiptDetailDto
                {
                    VariantId = x.VariantId,
                    SKU = x.ProductVariant?.SKU ?? string.Empty,
                    ProductName = x.ProductVariant?.Product?.Name ?? string.Empty,
                    Quantity = x.Quantity
                }).ToList()
            };
        }
    }
}
