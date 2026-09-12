using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStoreManagement.Application.DTOs.Customer;

namespace ToyStoreManagement.Application.Interfaces.Services
{
    public interface ILoyaltyTransactionService
    {
        Task<IEnumerable<LoyaltyTransactionDto>> GetAllAsync();

        Task<IEnumerable<LoyaltyTransactionDto>>
            GetByCustomerIdAsync(int customerId);
    }
}
