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
    
        // ══════════════════════════════════════════════════════════════════════════
        // QUY TRÌNH KIỂM KÊ KHO & ĐỐI SOÁT CHÊNH LỆCH 2 BƯỚC
        // ══════════════════════════════════════════════════════════════════════════

        public async Task<InventoryAuditTicketDto> CreateAuditTicketAsync(
            CreateInventoryAuditTicketDto dto,
            string userId,
            string userName)
        {
            if (dto.Details == null || !dto.Details.Any())
                throw new Exception("Phiếu kiểm kê phải có ít nhất một mặt hàng đồ chơi.");

            var now = DateTime.UtcNow;
            var ticketCode = $"KK-{now:yyyyMMddHHmmss}-{new Random().Next(100, 999)}";

            var ticket = new InventoryAuditTicket
            {
                TicketCode = ticketCode,
                CreatedByUserId = userId,
                CreatedByName = string.IsNullOrWhiteSpace(userName) ? "Nhân viên kho" : userName,
                CreatedAt = now,
                Status = 1, // 1: Chờ duyệt
                Note = dto.Note,
                TotalItems = dto.Details.Count
            };

            int totalDiscrepancyQty = 0;
            decimal totalDiscrepancyValue = 0;

            foreach (var item in dto.Details)
            {
                if (item.ActualQuantity < 0)
                    throw new Exception("Số lượng thực tế đếm được không được âm.");

                var inventory = await _context.Inventories
                    .FirstOrDefaultAsync(i => i.VariantId == item.VariantId);

                var variant = await _context.ProductVariants
                    .Include(v => v.Product)
                    .FirstOrDefaultAsync(v => v.VariantId == item.VariantId);

                if (variant == null)
                    throw new Exception($"Không tìm thấy biến thể đồ chơi #{item.VariantId}.");

                int systemQty = inventory?.Quantity ?? 0;
                int diffQty = item.ActualQuantity - systemQty;
                decimal cost = variant.CostPrice;
                decimal diffVal = diffQty * cost;

                totalDiscrepancyQty += diffQty;
                totalDiscrepancyValue += diffVal;

                ticket.Details.Add(new InventoryAuditTicketDetail
                {
                    VariantId = item.VariantId,
                    SystemQuantity = systemQty,
                    ActualQuantity = item.ActualQuantity,
                    DiscrepancyQuantity = diffQty,
                    CostPrice = cost,
                    DiscrepancyValue = diffVal,
                    DiscrepancyReason = item.DiscrepancyReason,
                    Note = item.Note
                });
            }

            ticket.TotalDiscrepancyQty = totalDiscrepancyQty;
            ticket.TotalDiscrepancyValue = totalDiscrepancyValue;

            await _context.InventoryAuditTickets.AddAsync(ticket);
            await _unitOfWork.SaveChangesAsync();

            return await GetAuditTicketByIdAsync(ticket.AuditTicketId)
                ?? throw new Exception("Không thể tải thông tin phiếu kiểm kê vừa tạo.");
        }

        public async Task<IEnumerable<InventoryAuditTicketDto>> GetAllAuditTicketsAsync(int? status = null)
        {
            var query = _context.InventoryAuditTickets
                .Include(t => t.Details)
                    .ThenInclude(d => d.ProductVariant)
                        .ThenInclude(v => v.Product)
                .AsQueryable();

            if (status.HasValue && status.Value > 0)
            {
                query = query.Where(t => t.Status == status.Value);
            }

            var list = await query
                .OrderByDescending(t => t.CreatedAt)
                .ToListAsync();

            return list.Select(MapAuditTicketToDto).ToList();
        }

        public async Task<InventoryAuditTicketDto?> GetAuditTicketByIdAsync(int ticketId)
        {
            var ticket = await _context.InventoryAuditTickets
                .Include(t => t.Details)
                    .ThenInclude(d => d.ProductVariant)
                        .ThenInclude(v => v.Product)
                .FirstOrDefaultAsync(t => t.AuditTicketId == ticketId);

            return ticket == null ? null : MapAuditTicketToDto(ticket);
        }

        public async Task<InventoryAuditTicketDto> ApproveAuditTicketAsync(
            int ticketId,
            string approvedByUserId,
            string approvedByName)
        {
            var ticket = await _context.InventoryAuditTickets
                .Include(t => t.Details)
                    .ThenInclude(d => d.ProductVariant)
                        .ThenInclude(v => v.Product)
                .FirstOrDefaultAsync(t => t.AuditTicketId == ticketId);

            if (ticket == null)
                throw new Exception("Không tìm thấy phiếu kiểm kê kho.");

            if (ticket.Status != 1)
                throw new Exception("Chỉ được phê duyệt phiếu kiểm kê đang ở trạng thái Chờ duyệt.");

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var now = DateTime.UtcNow;

                foreach (var detail in ticket.Details)
                {
                    var inventory = await _context.Inventories
                        .FirstOrDefaultAsync(i => i.VariantId == detail.VariantId);

                    if (inventory == null)
                    {
                        inventory = new Inventory
                        {
                            VariantId = detail.VariantId,
                            Quantity = 0,
                            ReservedQuantity = 0,
                            UpdatedAt = now
                        };
                        await _context.Inventories.AddAsync(inventory);
                    }

                    int oldQty = inventory.Quantity;
                    int diff = detail.ActualQuantity - oldQty;

                    inventory.Quantity = detail.ActualQuantity;
                    inventory.UpdatedAt = now;

                    if (diff != 0)
                    {
                        _context.InventoryTransactions.Add(new InventoryTransaction
                        {
                            VariantId = detail.VariantId,
                            TransactionType = 3, // 3: Điều chỉnh kiểm kê
                            Quantity = diff,
                            ReferenceType = "InventoryAuditTicket",
                            ReferenceId = ticket.AuditTicketId,
                            Note = $"Phê duyệt phiếu kiểm kê {ticket.TicketCode}: Tồn cũ {oldQty}, Thực tế {detail.ActualQuantity}, Lệch {(diff > 0 ? "+" : "")}{diff}. Lý do: {detail.DiscrepancyReason ?? "Kiểm kê định kỳ"}",
                            CreatedAt = now
                        });
                    }

                    await SyncProductStatusAsync(detail.VariantId);
                }

                ticket.Status = 2; // 2: Đã phê duyệt cân bằng kho
                ticket.ApprovedByUserId = approvedByUserId;
                ticket.ApprovedByName = string.IsNullOrWhiteSpace(approvedByName) ? "Quản lý kho" : approvedByName;
                ticket.ApprovedAt = now;

                await _unitOfWork.SaveChangesAsync();
                await transaction.CommitAsync();

                return MapAuditTicketToDto(ticket);
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        public async Task<InventoryAuditTicketDto> RejectAuditTicketAsync(
            int ticketId,
            string rejectedByUserId,
            string rejectedByName,
            string? reason)
        {
            var ticket = await _context.InventoryAuditTickets
                .Include(t => t.Details)
                    .ThenInclude(d => d.ProductVariant)
                        .ThenInclude(v => v.Product)
                .FirstOrDefaultAsync(t => t.AuditTicketId == ticketId);

            if (ticket == null)
                throw new Exception("Không tìm thấy phiếu kiểm kê kho.");

            if (ticket.Status != 1)
                throw new Exception("Chỉ được từ chối phiếu kiểm kê đang ở trạng thái Chờ duyệt.");

            ticket.Status = 3; // 3: Đã từ chối
            ticket.ApprovedByUserId = rejectedByUserId;
            ticket.ApprovedByName = string.IsNullOrWhiteSpace(rejectedByName) ? "Quản lý kho" : rejectedByName;
            ticket.ApprovedAt = DateTime.UtcNow;

            if (!string.IsNullOrWhiteSpace(reason))
            {
                ticket.Note = string.IsNullOrWhiteSpace(ticket.Note)
                    ? $"[Từ chối: {reason}]"
                    : $"{ticket.Note} | [Từ chối: {reason}]";
            }

            await _unitOfWork.SaveChangesAsync();
            return MapAuditTicketToDto(ticket);
        }

        private static InventoryAuditTicketDto MapAuditTicketToDto(InventoryAuditTicket ticket)
        {
            return new InventoryAuditTicketDto
            {
                AuditTicketId = ticket.AuditTicketId,
                TicketCode = ticket.TicketCode,
                CreatedByUserId = ticket.CreatedByUserId,
                CreatedByName = ticket.CreatedByName,
                CreatedAt = ticket.CreatedAt,
                Status = ticket.Status,
                ApprovedByUserId = ticket.ApprovedByUserId,
                ApprovedByName = ticket.ApprovedByName,
                ApprovedAt = ticket.ApprovedAt,
                Note = ticket.Note,
                TotalItems = ticket.TotalItems,
                TotalDiscrepancyQty = ticket.TotalDiscrepancyQty,
                TotalDiscrepancyValue = ticket.TotalDiscrepancyValue,
                Details = ticket.Details.Select(d => new InventoryAuditTicketDetailDto
                {
                    DetailId = d.DetailId,
                    AuditTicketId = d.AuditTicketId,
                    VariantId = d.VariantId,
                    SKU = d.ProductVariant?.SKU ?? string.Empty,
                    ProductName = d.ProductVariant?.Product?.Name ?? string.Empty,
                    Color = d.ProductVariant?.Color,
                    SystemQuantity = d.SystemQuantity,
                    ActualQuantity = d.ActualQuantity,
                    DiscrepancyQuantity = d.DiscrepancyQuantity,
                    CostPrice = d.CostPrice,
                    DiscrepancyValue = d.DiscrepancyValue,
                    DiscrepancyReason = d.DiscrepancyReason,
                    Note = d.Note
                }).ToList()
            };
        }

    }
}
