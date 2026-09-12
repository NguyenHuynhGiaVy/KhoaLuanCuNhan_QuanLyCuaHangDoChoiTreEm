using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStoreManagement.Application.DTOs.Customer;

namespace ToyStoreManagement.Application.Interfaces.Services
{
    public interface ICustomerService
    {
        Task<IEnumerable<CustomerDto>> GetAllAsync();

        Task<CustomerDto?> GetByIdAsync(int customerId);

        Task<CustomerDto?> GetByUserIdAsync(string userId);

        Task<CustomerDto> CreateAsync(CreateCustomerDto dto);

        Task<CustomerDto?> UpdateAsync(
            int customerId,
            UpdateCustomerDto dto);

        Task<bool> DeleteAsync(int customerId);
    }
}