using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Data;
using Microsoft.EntityFrameworkCore;
using ToyStore.Application.Interfaces.Repositories;
using ToyStoreManagement.Application.DTOs.Import;
using ToyStoreManagement.Application.Interfaces.Repositories;
using ToyStoreManagement.Application.Interfaces.Services;
using ToyStoreManagement.Domain.Entities;
using ToyStoreManagement.Infrastructure.Data;

namespace ToyStoreManagement.Infrastructure.Services
{
    public class ImportReceiptService : IImportReceiptService
    {
        private readonly IImportReceiptRepository _repository;
        private readonly IGenericRepository<Supplier> _supplierRepository;
        private readonly IGenericRepository<ProductVariant> _variantRepository;
        private readonly IUnitOfWork _unitOfWork;
        private readonly ApplicationDbContext _context;

        public ImportReceiptService(
            IImportReceiptRepository repository,
            IGenericRepository<Supplier> supplierRepository,
            IGenericRepository<ProductVariant> variantRepository,
            IUnitOfWork unitOfWork,
            ApplicationDbContext context)
        {
            _repository = repository;
            _supplierRepository = supplierRepository;
            _variantRepository = variantRepository;
            _unitOfWork = unitOfWork;
            _context = context;
        }

        public async Task<IEnumerable<ImportReceiptDto>> GetAllAsync()
        {
            var receipts = (await _repository.GetAllWithDetailsAsync()).ToList();
            if (receipts.Count == 0)
                return Enumerable.Empty<ImportReceiptDto>();

            var receiptIds = receipts.Select(r => r.ImportReceiptId).ToList();

            var allReceived = await _context.InventoryTransactions
                .Where(x => x.ReferenceType == "ImportReceipt"
                    && x.ReferenceId.HasValue
                    && receiptIds.Contains(x.ReferenceId.Value))
                .GroupBy(x => new { ReceiptId = x.ReferenceId.Value, x.VariantId })
                .Select(x => new { x.Key.ReceiptId, x.Key.VariantId, Quantity = x.Sum(y => y.Quantity) })
                .ToListAsync();

            var receivedLookup = allReceived.ToDictionary(
                x => (x.ReceiptId, x.VariantId),
                x => x.Quantity
            );

            return receipts.Select(receipt => new ImportReceiptDto
            {
                ImportReceiptId = receipt.ImportReceiptId,
                SupplierId = receipt.SupplierId,
                SupplierName = receipt.Supplier?.Name,
                EmployeeId = receipt.EmployeeId,
                OrderedByUserId = receipt.OrderedByUserId,
                OrderedByName = receipt.OrderedByUser?.FullName,
                ReceiptCode = receipt.ReceiptCode,
                ImportDate = receipt.ImportDate,
                TotalAmount = receipt.TotalAmount,
                Status = receipt.Status,
                Note = receipt.Note,
                CreatedAt = receipt.CreatedAt,
                ImportReceiptDetails = receipt.ImportReceiptDetails.Select(x => new ImportReceiptDetailDto
                {
                    ImportReceiptDetailId = x.ImportReceiptDetailId,
                    ImportReceiptId = x.ImportReceiptId,
                    VariantId = x.VariantId,
                    SKU = x.ProductVariant?.SKU,
                    ProductName = x.ProductVariant?.Product?.Name,
                    Quantity = x.Quantity,
                    ReceivedQuantity = receivedLookup.GetValueOrDefault((receipt.ImportReceiptId, x.VariantId)),
                    UnitCost = x.UnitCost,
                    TotalAmount = x.TotalAmount
                }).ToList()
            }).ToList();
        }

        public async Task<ImportReceiptDto?> GetByIdAsync(int id)
        {
            var receipt = await _repository.GetByIdWithDetailsAsync(id);

            if (receipt == null)
                return null;

            return await MapToDtoAsync(receipt);
        }

        public async Task<ImportReceiptDto> CreateAsync(
            CreateImportReceiptDto dto,
            string orderedByUserId)
        {
            if (string.IsNullOrWhiteSpace(orderedByUserId)
                || !await _context.Users.AnyAsync(user => user.Id == orderedByUserId && user.IsActive))
            {
                throw new UnauthorizedAccessException("Không xác định được tài khoản đang đặt hàng.");
            }

            var supplier =
                await _supplierRepository.GetByIdAsync(dto.SupplierId);

            if (supplier == null)
                throw new Exception("Supplier không tồn tại.");

            if (!supplier.IsActive)
                throw new Exception("Supplier đang không hoạt động.");

            ValidateReceiptDetails(dto);

            if (dto.Details == null || dto.Details.Count == 0)
                throw new Exception(
                    "Phiếu nhập phải có ít nhất một sản phẩm.");

            if (dto.Details.GroupBy(x => x.VariantId).Any(x => x.Count() > 1))
                throw new Exception("Không được trùng sản phẩm trong cùng phiếu.");

            var receipt = new ImportReceipt
            {
                SupplierId = dto.SupplierId,
                EmployeeId = dto.EmployeeId,
                OrderedByUserId = orderedByUserId,
                ReceiptCode = dto.ReceiptCode,
                ImportDate = dto.ImportDate,
                Status = dto.Status,
                Note = dto.Note,
                CreatedAt = DateTime.UtcNow,
                TotalAmount = 0
            };

            decimal total = 0;

            foreach (var item in dto.Details)
            {
                if (item.Quantity <= 0)
                    throw new Exception(
                        "Quantity phải lớn hơn 0.");

                if (item.UnitCost < 0)
                    throw new Exception(
                        "UnitCost không được nhỏ hơn 0.");

                var variant =
                    await _variantRepository
                        .GetByIdAsync(item.VariantId);

                if (variant == null)
                    throw new Exception(
                        $"Variant {item.VariantId} không tồn tại.");

                decimal detailTotal =
                    item.Quantity * item.UnitCost;

                var detail = new ImportReceiptDetail
                {
                    VariantId = item.VariantId,
                    Quantity = item.Quantity,
                    UnitCost = item.UnitCost,
                    TotalAmount = detailTotal
                };

                receipt.ImportReceiptDetails.Add(detail);

                total += detailTotal;
            }

            receipt.TotalAmount = total;

            await _repository.AddAsync(receipt);
            await _unitOfWork.SaveChangesAsync();

            var result =
                await _repository
                    .GetByIdWithDetailsAsync(
                        receipt.ImportReceiptId);

            return await MapToDtoAsync(result!);
        }

        public async Task<ImportReceiptDto?> UpdateAsync(
            int id,
            CreateImportReceiptDto dto)
        {
            var receipt =
                await _repository.GetByIdWithDetailsAsync(id);

            if (receipt == null)
                return null;

            if (receipt.Status != 1)
                throw new Exception("Chỉ được cập nhật phiếu đang ở trạng thái nháp.");

            ValidateReceiptDetails(dto);

            var supplier =
                await _supplierRepository.GetByIdAsync(dto.SupplierId);

            if (supplier == null)
                throw new Exception("Supplier không tồn tại.");

            if (!supplier.IsActive)
                throw new Exception("Supplier đang không hoạt động.");

            receipt.SupplierId = dto.SupplierId;
            receipt.ReceiptCode = dto.ReceiptCode;
            receipt.ImportDate = dto.ImportDate;
            receipt.Status = 1;
            receipt.Note = dto.Note;

            receipt.ImportReceiptDetails.Clear();
            receipt.TotalAmount = 0;

            foreach (var item in dto.Details)
            {
                var variant = await _variantRepository.GetByIdAsync(item.VariantId);
                if (variant == null)
                    throw new Exception($"Variant {item.VariantId} không tồn tại.");

                var detailTotal = item.Quantity * item.UnitCost;
                receipt.ImportReceiptDetails.Add(new ImportReceiptDetail
                {
                    VariantId = item.VariantId,
                    Quantity = item.Quantity,
                    UnitCost = item.UnitCost,
                    TotalAmount = detailTotal
                });
                receipt.TotalAmount += detailTotal;
            }

            _repository.Update(receipt);

            await _unitOfWork.SaveChangesAsync();

            return await GetByIdAsync(id);
        }

        public async Task<ImportReceiptDto?> ReceiveAsync(
            int id,
            ReceiveImportReceiptDto dto)
        {
            if (dto.Details == null || dto.Details.Count == 0)
                throw new Exception("Phiếu nhập phải có ít nhất một sản phẩm.");

            if (dto.Details.GroupBy(x => x.ImportReceiptDetailId)
                .Any(x => x.Count() > 1))
                throw new Exception("Không được trùng chi tiết trong cùng lần nhập.");

            await using var transaction = await _context.Database
                .BeginTransactionAsync(IsolationLevel.Serializable);

            try
            {
                var receipt = await _context.ImportReceipts
                    .Include(x => x.ImportReceiptDetails)
                        .ThenInclude(x => x.ProductVariant)
                            .ThenInclude(x => x.Product)
                    .FirstOrDefaultAsync(x => x.ImportReceiptId == id);

                if (receipt == null)
                    return null;

                if (receipt.Status == 4)
                    throw new Exception("Không thể nhập hàng vào phiếu đã hủy.");

                if (receipt.Status == 3)
                    throw new Exception("Phiếu đã nhận đủ hàng.");

                var affectedProductIds = new HashSet<int>();

                foreach (var received in dto.Details)
                {
                    if (received.Quantity <= 0)
                        throw new Exception("Số lượng nhập phải lớn hơn 0.");

                    var detail = receipt.ImportReceiptDetails
                        .FirstOrDefault(x => x.ImportReceiptDetailId == received.ImportReceiptDetailId);

                    if (detail == null)
                        throw new Exception("Chi tiết nhập hàng không thuộc phiếu này.");

                    var receivedQuantity = await _context.InventoryTransactions
                        .Where(x => x.ReferenceType == "ImportReceipt"
                            && x.ReferenceId == receipt.ImportReceiptId
                            && x.VariantId == detail.VariantId)
                        .SumAsync(x => (int?)x.Quantity) ?? 0;

                    if (receivedQuantity + received.Quantity > detail.Quantity)
                        throw new Exception(
                            $"Số lượng nhận của sản phẩm {detail.ProductVariant?.SKU} vượt số lượng đã đặt.");

                    var inventory = await _context.Inventories
                        .FirstOrDefaultAsync(x => x.VariantId == detail.VariantId);

                    if (inventory == null)
                    {
                        inventory = new Inventory
                        {
                            VariantId = detail.VariantId,
                            Quantity = 0,
                            ReservedQuantity = 0,
                            UpdatedAt = DateTime.UtcNow
                        };
                        _context.Inventories.Add(inventory);
                    }

                    inventory.Quantity += received.Quantity;
                    inventory.UpdatedAt = DateTime.UtcNow;
                    detail.ProductVariant.CostPrice = detail.UnitCost;
                    detail.ProductVariant.UpdatedAt = DateTime.UtcNow;
                    affectedProductIds.Add(detail.ProductVariant.ProductId);

                    _context.InventoryTransactions.Add(new InventoryTransaction
                    {
                        VariantId = detail.VariantId,
                        TransactionType = 1,
                        Quantity = received.Quantity,
                        ReferenceType = "ImportReceipt",
                        ReferenceId = receipt.ImportReceiptId,
                        Note = $"Nhập hàng từ phiếu {receipt.ReceiptCode}",
                        CreatedAt = DateTime.UtcNow
                    });
                }

                await _unitOfWork.SaveChangesAsync();

                var receivedByVariant = await _context.InventoryTransactions
                    .Where(x => x.ReferenceType == "ImportReceipt"
                        && x.ReferenceId == receipt.ImportReceiptId)
                    .GroupBy(x => x.VariantId)
                    .Select(x => new { VariantId = x.Key, Quantity = x.Sum(y => y.Quantity) })
                    .ToDictionaryAsync(x => x.VariantId, x => x.Quantity);

                receipt.Status = receipt.ImportReceiptDetails.All(x =>
                    receivedByVariant.GetValueOrDefault(x.VariantId) == x.Quantity) ? 3 : 2;

                await _unitOfWork.SaveChangesAsync();

                foreach (var productId in affectedProductIds)
                {
                    var product = await _context.Products.FindAsync(productId);
                    if (product == null)
                        continue;

                    var totalQuantity = await _context.Inventories
                        .Where(x => x.ProductVariant.ProductId == productId)
                        .SumAsync(x => (int?)x.Quantity) ?? 0;

                    // Giữ trạng thái thanh lý/ngừng nhập mới do Admin đã chọn.
                    if (product.Status != 2)
                        product.Status = totalQuantity > 0 ? 1 : 0;

                    product.UpdatedAt = DateTime.UtcNow;
                }

                await _unitOfWork.SaveChangesAsync();
                await transaction.CommitAsync();

                return await GetByIdAsync(id);
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        public async Task<ImportReceiptDto?> ApproveAsync(int id)
        {
            var receipt = await _context.ImportReceipts
                .Include(x => x.ImportReceiptDetails)
                    .ThenInclude(x => x.ProductVariant)
                .FirstOrDefaultAsync(x => x.ImportReceiptId == id);

            if (receipt == null)
                return null;

            if (receipt.Status == 3)
                throw new Exception("Phiếu đặt hàng này đã được duyệt và nhập kho hoàn tất.");

            if (receipt.Status == 4)
                throw new Exception("Không thể duyệt phiếu đặt hàng đã bị hủy.");

            var receivedByVariant = await _context.InventoryTransactions
                .Where(x => x.ReferenceType == "ImportReceipt" && x.ReferenceId == receipt.ImportReceiptId)
                .GroupBy(x => x.VariantId)
                .Select(x => new { VariantId = x.Key, Quantity = x.Sum(y => y.Quantity) })
                .ToDictionaryAsync(x => x.VariantId, x => x.Quantity);

            var detailsToReceive = new List<ReceiveImportReceiptDetailDto>();
            foreach (var detail in receipt.ImportReceiptDetails)
            {
                var alreadyReceived = receivedByVariant.GetValueOrDefault(detail.VariantId);
                var remaining = detail.Quantity - alreadyReceived;
                if (remaining > 0)
                {
                    detailsToReceive.Add(new ReceiveImportReceiptDetailDto
                    {
                        ImportReceiptDetailId = detail.ImportReceiptDetailId,
                        Quantity = remaining
                    });
                }
            }

            if (detailsToReceive.Count == 0)
            {
                receipt.Status = 3;
                await _unitOfWork.SaveChangesAsync();
                return await GetByIdAsync(id);
            }

            return await ReceiveAsync(id, new ReceiveImportReceiptDto { Details = detailsToReceive });
        }

        public async Task<bool> CancelAsync(int id)
        {
            var receipt = await _repository.GetByIdAsync(id);
            if (receipt == null)
                return false;

            if (receipt.Status != 1)
                throw new Exception("Chỉ được hủy phiếu đang ở trạng thái nháp.");

            receipt.Status = 4;
            _repository.Update(receipt);
            await _unitOfWork.SaveChangesAsync();
            return true;
        }

        public async Task<bool> DeleteAsync(int id)
        {
            var receipt = await _repository.GetByIdAsync(id);

            if (receipt == null)
                return false;

            if (receipt.Status != 1)
                throw new Exception("Chỉ được xóa phiếu đang ở trạng thái nháp.");

            _repository.Delete(receipt);

            await _unitOfWork.SaveChangesAsync();

            return true;
        }

        private async Task<ImportReceiptDto> MapToDtoAsync(
            ImportReceipt receipt)
        {
            var receivedByVariant = await _context.InventoryTransactions
                .Where(x => x.ReferenceType == "ImportReceipt"
                    && x.ReferenceId == receipt.ImportReceiptId)
                .GroupBy(x => x.VariantId)
                .Select(x => new { VariantId = x.Key, Quantity = x.Sum(y => y.Quantity) })
                .ToDictionaryAsync(x => x.VariantId, x => x.Quantity);

            return new ImportReceiptDto
            {
                ImportReceiptId = receipt.ImportReceiptId,
                SupplierId = receipt.SupplierId,
                SupplierName = receipt.Supplier?.Name,
                EmployeeId = receipt.EmployeeId,
                OrderedByUserId = receipt.OrderedByUserId,
                OrderedByName = receipt.OrderedByUser?.FullName,
                ReceiptCode = receipt.ReceiptCode,
                ImportDate = receipt.ImportDate,
                TotalAmount = receipt.TotalAmount,
                Status = receipt.Status,
                Note = receipt.Note,
                CreatedAt = receipt.CreatedAt,

                ImportReceiptDetails =
                    receipt.ImportReceiptDetails
                        .Select(x => new ImportReceiptDetailDto
                        {
                            ImportReceiptDetailId =
                                x.ImportReceiptDetailId,

                            ImportReceiptId =
                                x.ImportReceiptId,

                            VariantId =
                                x.VariantId,

                            SKU =
                                x.ProductVariant?.SKU,

                            ProductName =
                                x.ProductVariant?.Product?.Name,

                            Quantity =
                                x.Quantity,

                            ReceivedQuantity =
                                receivedByVariant.GetValueOrDefault(x.VariantId),

                            UnitCost =
                                x.UnitCost,

                            TotalAmount =
                                x.TotalAmount
                        })
                        .ToList()
            };
        }

        private static void ValidateReceiptDetails(CreateImportReceiptDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.ReceiptCode))
                throw new Exception("ReceiptCode không được để trống.");

            if (dto.Details == null || dto.Details.Count == 0)
                throw new Exception("Phiếu nhập phải có ít nhất một sản phẩm.");

            if (dto.Details.GroupBy(x => x.VariantId).Any(x => x.Count() > 1))
                throw new Exception("Không được trùng sản phẩm trong cùng phiếu.");

            if (dto.Details.Any(x => x.Quantity <= 0))
                throw new Exception("Quantity phải lớn hơn 0.");

            if (dto.Details.Any(x => x.UnitCost < 0))
                throw new Exception("UnitCost không được nhỏ hơn 0.");
        }
    }
}
