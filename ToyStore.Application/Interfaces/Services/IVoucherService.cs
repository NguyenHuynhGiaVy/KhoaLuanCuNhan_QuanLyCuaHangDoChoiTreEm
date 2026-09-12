using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStoreManagement.Application.DTOs.Promotion;

namespace ToyStoreManagement.Application.Interfaces.Services
{
    public interface IVoucherService
    {
        Task<IEnumerable<VoucherDto>> GetAllAsync();

        Task<VoucherDto?> GetByIdAsync(int voucherId);

        Task<VoucherDto?> GetByCodeAsync(string code);

        Task<VoucherDto> CreateAsync(CreateVoucherDto dto);

        Task<VoucherDto?> UpdateAsync(
            int voucherId,
            UpdateVoucherDto dto);

        Task<bool> DeleteAsync(int voucherId);

        Task<VoucherUsageDto> UseVoucherAsync(
            int voucherId,
            int orderId,
            int? customerId,
            decimal discountAmount);
    }
}
