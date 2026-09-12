using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStoreManagement.Application.DTOs.CustomerCare;

namespace ToyStoreManagement.Application.Interfaces.Services
{
    public interface ICustomerFeedbackService
    {
        Task<IEnumerable<CustomerFeedbackDto>> GetAllAsync();

        Task<CustomerFeedbackDto?> GetByIdAsync(long customerFeedbackId);

        Task<IEnumerable<CustomerFeedbackDto>> GetByCustomerIdAsync(int customerId);

        Task<IEnumerable<CustomerFeedbackDto>> GetByOrderIdAsync(int orderId);

        Task<CustomerFeedbackDto> CreateAsync(
            CreateCustomerFeedbackDto dto);

        Task<CustomerFeedbackDto?> UpdateAsync(
            long customerFeedbackId,
            UpdateCustomerFeedbackDto dto);

        Task<bool> DeleteAsync(long customerFeedbackId);
    }
}
