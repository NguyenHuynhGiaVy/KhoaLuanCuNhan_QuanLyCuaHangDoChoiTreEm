using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStoreManagement.Application.DTOs.CustomerCare;

namespace ToyStoreManagement.Application.Interfaces.Services
{
    public interface IReturnRequestService
    {
        Task<IEnumerable<ReturnRequestDto>> GetAllAsync();

        Task<ReturnRequestDto?> GetByIdAsync(int returnRequestId);

        Task<IEnumerable<ReturnRequestDto>> GetByCustomerIdAsync(
            int customerId);

        Task<IEnumerable<ReturnRequestDto>> GetByOrderIdAsync(
            int orderId);

        Task<ReturnRequestDto?> GetByReturnCodeAsync(
            string returnCode);

        Task<ReturnRequestDto> CreateAsync(
            CreateReturnRequestDto dto);

        Task<ReturnRequestDto?> UpdateAsync(
            int returnRequestId,
            UpdateReturnRequestDto dto);

        Task<bool> DeleteAsync(int returnRequestId);

        Task<ReturnRequestDetailDto> AddDetailAsync(
            int returnRequestId,
            CreateReturnRequestDetailDto dto);

        Task<bool> DeleteDetailAsync(
            int returnRequestDetailId);
    }
}