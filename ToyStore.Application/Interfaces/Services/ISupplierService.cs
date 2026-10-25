using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

using ToyStoreManagement.Application.DTOs.Import;
using ToyStoreManagement.Application.DTOs.Product;


namespace ToyStoreManagement.Application.Interfaces.Services
{
    public interface ISupplierService
    {
        Task<IEnumerable<SupplierDto>> GetAllAsync();

        Task<SupplierDto?> GetByIdAsync(int id);

        Task<SupplierDto> CreateAsync(CreateSupplierDto dto);

        Task<SupplierDto?> UpdateAsync(
            int id,
            UpdateSupplierDto dto);

        Task<bool> DeleteAsync(int id);

        Task<IEnumerable<CungUngDto>> GetSuppliedProductsAsync(int id);
    }
}
