using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStoreManagement.Application.DTOs.Import;
using ToyStoreManagement.Application.DTOs.Product;
using ToyStoreManagement.Application.Interfaces.Repositories;
using ToyStoreManagement.Application.Interfaces.Services;
using ToyStoreManagement.Domain.Entities;
using ToyStore.Application.Interfaces.Repositories;
using ToyStoreManagement.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ToyStoreManagement.Infrastructure.Services
{
    public class SupplierService : ISupplierService
    {
        private readonly ISupplierRepository _repository;
        private readonly IUnitOfWork _unitOfWork;
        private readonly ApplicationDbContext _context;

        public SupplierService(
            ISupplierRepository repository,
            IUnitOfWork unitOfWork,
            ApplicationDbContext context)
        {
            _repository = repository;
            _unitOfWork = unitOfWork;
            _context = context;
        }

        public async Task<IEnumerable<SupplierDto>> GetAllAsync()
        {
            var suppliers = await _repository.GetAllAsync();

            return suppliers.Select(x => new SupplierDto
            {
                SupplierId = x.SupplierId,
                Name = x.Name,
                Phone = x.Phone,
                Email = x.Email,
                Address = x.Address,
                TaxCode = x.TaxCode,
                IsActive = x.IsActive,
                CreatedAt = x.CreatedAt,
                UpdatedAt = x.UpdatedAt
            });
        }

        public async Task<SupplierDto?> GetByIdAsync(int id)
        {
            var supplier = await _repository.GetByIdAsync(id);

            if (supplier == null)
                return null;

            return new SupplierDto
            {
                SupplierId = supplier.SupplierId,
                Name = supplier.Name,
                Phone = supplier.Phone,
                Email = supplier.Email,
                Address = supplier.Address,
                TaxCode = supplier.TaxCode,
                IsActive = supplier.IsActive,
                CreatedAt = supplier.CreatedAt,
                UpdatedAt = supplier.UpdatedAt
            };
        }

        public async Task<SupplierDto> CreateAsync(
            CreateSupplierDto dto)
        {
            var supplier = new Supplier
            {
                Name = dto.Name,
                Phone = dto.Phone,
                Email = dto.Email,
                Address = dto.Address,
                TaxCode = dto.TaxCode,
                IsActive = dto.IsActive,
                CreatedAt = DateTime.UtcNow
            };

            await _repository.AddAsync(supplier);
            await _unitOfWork.SaveChangesAsync();

            return new SupplierDto
            {
                SupplierId = supplier.SupplierId,
                Name = supplier.Name,
                Phone = supplier.Phone,
                Email = supplier.Email,
                Address = supplier.Address,
                TaxCode = supplier.TaxCode,
                IsActive = supplier.IsActive,
                CreatedAt = supplier.CreatedAt,
                UpdatedAt = supplier.UpdatedAt
            };
        }

        public async Task<SupplierDto?> UpdateAsync(
            int id,
            UpdateSupplierDto dto)
        {
            var supplier = await _repository.GetByIdAsync(id);

            if (supplier == null)
                return null;

            supplier.Name = dto.Name;
            supplier.Phone = dto.Phone;
            supplier.Email = dto.Email;
            supplier.Address = dto.Address;
            supplier.TaxCode = dto.TaxCode;
            supplier.IsActive = dto.IsActive;
            supplier.UpdatedAt = DateTime.UtcNow;

            _repository.Update(supplier);
            await _unitOfWork.SaveChangesAsync();

            return await GetByIdAsync(id);
        }

        public async Task<bool> DeleteAsync(int id)
        {
            var supplier = await _repository.GetByIdAsync(id);

            if (supplier == null)
                return false;

            supplier.IsActive = false;
            supplier.UpdatedAt = DateTime.UtcNow;

            _repository.Update(supplier);
            await _unitOfWork.SaveChangesAsync();

            return true;
        }

        public async Task<IEnumerable<SupplierPriceComparisonDto>> ComparePricesAsync(int productId)
        {
            var product = await _context.Products
                .AsNoTracking()
                .Include(p => p.ProductVariants)
                .FirstOrDefaultAsync(p => p.ProductId == productId);

            if (product == null)
                return Enumerable.Empty<SupplierPriceComparisonDto>();

            var variantIds = product.ProductVariants.Select(v => v.VariantId).ToList();

            var cungUngs = await _context.CungUngs
                .AsNoTracking()
                .Include(c => c.Supplier)
                .Where(c => c.ProductId == productId && c.Supplier.IsActive)
                .ToListAsync();

            var supplierIds = cungUngs.Select(c => c.SupplierId).Distinct().ToList();

            // Lấy giá nhập gần nhất từ các phiếu nhập đã duyệt
            var lastImports = await _context.ImportReceiptDetails
                .AsNoTracking()
                .Where(d => variantIds.Contains(d.VariantId) && supplierIds.Contains(d.ImportReceipt.SupplierId))
                .OrderByDescending(d => d.ImportReceipt.ImportDate)
                .Select(d => new
                {
                    d.ImportReceipt.SupplierId,
                    d.UnitCost,
                    d.ImportReceipt.ImportDate
                })
                .ToListAsync();

            var result = new List<SupplierPriceComparisonDto>();

            foreach (var cu in cungUngs)
            {
                var lastImport = lastImports.FirstOrDefault(li => li.SupplierId == cu.SupplierId);

                result.Add(new SupplierPriceComparisonDto
                {
                    ProductId = productId,
                    ProductName = product.Name,
                    SupplierId = cu.SupplierId,
                    SupplierName = cu.Supplier?.Name ?? "NCC",
                    Phone = cu.Supplier?.Phone,
                    Email = cu.Supplier?.Email,
                    Address = cu.Supplier?.Address,
                    GiaNhapThamKhao = cu.GiaNhapThamKhao,
                    LastImportPrice = lastImport?.UnitCost,
                    LastImportDate = lastImport?.ImportDate,
                    MaHangNCC = cu.MaHangNCC,
                    IsDefault = cu.IsDefault
                });
            }

            // Nếu sản phẩm chưa có NCC nào trong CungUng, lấy danh sách active suppliers làm gợi ý
            if (!result.Any())
            {
                var allActiveSuppliers = await _context.Suppliers
                    .AsNoTracking()
                    .Where(s => s.IsActive)
                    .Take(10)
                    .ToListAsync();

                foreach (var s in allActiveSuppliers)
                {
                    result.Add(new SupplierPriceComparisonDto
                    {
                        ProductId = productId,
                        ProductName = product.Name,
                        SupplierId = s.SupplierId,
                        SupplierName = s.Name,
                        Phone = s.Phone,
                        Email = s.Email,
                        Address = s.Address,
                        GiaNhapThamKhao = product.ProductVariants.FirstOrDefault(v => v.CostPrice > 0)?.CostPrice,
                        IsDefault = s.SupplierId == product.SupplierId
                    });
                }
            }

            return result.OrderByDescending(x => x.IsDefault)
                         .ThenBy(x => x.GiaNhapThamKhao ?? decimal.MaxValue);
        }

        public async Task<IEnumerable<CungUngDto>> GetSuppliedProductsAsync(int id)
        {
            return await _context.CungUngs
                .Where(c => c.SupplierId == id)
                .Include(c => c.Supplier)
                .Select(c => new CungUngDto
                {
                    Id = c.Id,
                    ProductId = c.ProductId,
                    SupplierId = c.SupplierId,
                    SupplierName = c.Supplier.Name,
                    SupplierPhone = c.Supplier.Phone,
                    GiaNhapThamKhao = c.GiaNhapThamKhao,
                    MaHangNCC = c.MaHangNCC,
                    IsDefault = c.IsDefault,
                    CreatedAt = c.CreatedAt,
                    UpdatedAt = c.UpdatedAt
                })
                .ToListAsync();
        }
    }
}
