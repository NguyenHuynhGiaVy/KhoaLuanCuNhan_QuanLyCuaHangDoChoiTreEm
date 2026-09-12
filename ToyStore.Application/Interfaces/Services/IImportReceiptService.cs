using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

using ToyStoreManagement.Application.DTOs.Import;


namespace ToyStoreManagement.Application.Interfaces.Services
{
    public interface IImportReceiptService
    {
        Task<IEnumerable<ImportReceiptDto>> GetAllAsync();

        Task<ImportReceiptDto?> GetByIdAsync(int id);

        Task<ImportReceiptDto> CreateAsync(
            CreateImportReceiptDto dto);

        Task<ImportReceiptDto?> UpdateAsync(
            int id,
            CreateImportReceiptDto dto);

        Task<bool> DeleteAsync(int id);
    }
}
