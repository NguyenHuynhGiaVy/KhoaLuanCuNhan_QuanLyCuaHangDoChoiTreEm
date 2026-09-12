using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStore.Application.Interfaces.Repositories;
using ToyStoreManagement.Application.DTOs.Import;
using ToyStoreManagement.Application.Interfaces.Repositories;
using ToyStoreManagement.Application.Interfaces.Services;
using ToyStoreManagement.Domain.Entities;

namespace ToyStoreManagement.Infrastructure.Services
{
    public class ImportReceiptService : IImportReceiptService
    {
        private readonly IImportReceiptRepository _repository;
        private readonly IGenericRepository<Supplier> _supplierRepository;
        private readonly IGenericRepository<ProductVariant> _variantRepository;
        private readonly IUnitOfWork _unitOfWork;

        public ImportReceiptService(
            IImportReceiptRepository repository,
            IGenericRepository<Supplier> supplierRepository,
            IGenericRepository<ProductVariant> variantRepository,
            IUnitOfWork unitOfWork)
        {
            _repository = repository;
            _supplierRepository = supplierRepository;
            _variantRepository = variantRepository;
            _unitOfWork = unitOfWork;
        }

        public async Task<IEnumerable<ImportReceiptDto>> GetAllAsync()
        {
            var receipts = await _repository.GetAllWithDetailsAsync();

            return receipts.Select(MapToDto);
        }

        public async Task<ImportReceiptDto?> GetByIdAsync(int id)
        {
            var receipt = await _repository.GetByIdWithDetailsAsync(id);

            if (receipt == null)
                return null;

            return MapToDto(receipt);
        }

        public async Task<ImportReceiptDto> CreateAsync(
            CreateImportReceiptDto dto)
        {
            var supplier =
                await _supplierRepository.GetByIdAsync(dto.SupplierId);

            if (supplier == null)
                throw new Exception("Supplier không tồn tại.");

            if (!supplier.IsActive)
                throw new Exception("Supplier đang không hoạt động.");

            if (dto.Details == null || dto.Details.Count == 0)
                throw new Exception(
                    "Phiếu nhập phải có ít nhất một sản phẩm.");

            var receipt = new ImportReceipt
            {
                SupplierId = dto.SupplierId,
                EmployeeId = dto.EmployeeId,
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

            return MapToDto(result!);
        }

        public async Task<ImportReceiptDto?> UpdateAsync(
            int id,
            CreateImportReceiptDto dto)
        {
            var receipt =
                await _repository.GetByIdWithDetailsAsync(id);

            if (receipt == null)
                return null;

            var supplier =
                await _supplierRepository.GetByIdAsync(dto.SupplierId);

            if (supplier == null)
                throw new Exception("Supplier không tồn tại.");

            receipt.SupplierId = dto.SupplierId;
            receipt.EmployeeId = dto.EmployeeId;
            receipt.ReceiptCode = dto.ReceiptCode;
            receipt.ImportDate = dto.ImportDate;
            receipt.Status = dto.Status;
            receipt.Note = dto.Note;

            _repository.Update(receipt);

            await _unitOfWork.SaveChangesAsync();

            return await GetByIdAsync(id);
        }

        public async Task<bool> DeleteAsync(int id)
        {
            var receipt = await _repository.GetByIdAsync(id);

            if (receipt == null)
                return false;

            _repository.Delete(receipt);

            await _unitOfWork.SaveChangesAsync();

            return true;
        }

        private static ImportReceiptDto MapToDto(
            ImportReceipt receipt)
        {
            return new ImportReceiptDto
            {
                ImportReceiptId = receipt.ImportReceiptId,
                SupplierId = receipt.SupplierId,
                SupplierName = receipt.Supplier?.Name,
                EmployeeId = receipt.EmployeeId,
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

                            UnitCost =
                                x.UnitCost,

                            TotalAmount =
                                x.TotalAmount
                        })
                        .ToList()
            };
        }
    }
}
