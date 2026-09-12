using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStoreManagement.Application.DTOs.Customer;
using ToyStoreManagement.Application.Interfaces.Repositories;
using ToyStoreManagement.Application.Interfaces.Services;

namespace ToyStoreManagement.Infrastructure.Services
{
    public class LoyaltyTransactionService
        : ILoyaltyTransactionService
    {
        private readonly ILoyaltyTransactionRepository
            _loyaltyTransactionRepository;

        public LoyaltyTransactionService(
            ILoyaltyTransactionRepository loyaltyTransactionRepository)
        {
            _loyaltyTransactionRepository =
                loyaltyTransactionRepository;
        }

        public async Task<IEnumerable<LoyaltyTransactionDto>>
            GetAllAsync()
        {
            var transactions =
                await _loyaltyTransactionRepository
                    .GetAllWithDetailsAsync();

            return transactions.Select(MapToDto);
        }

        public async Task<IEnumerable<LoyaltyTransactionDto>>
            GetByCustomerIdAsync(int customerId)
        {
            var transactions =
                await _loyaltyTransactionRepository
                    .GetByCustomerIdAsync(customerId);

            return transactions.Select(MapToDto);
        }

        private static LoyaltyTransactionDto MapToDto(
            Domain.Entities.LoyaltyTransaction transaction)
        {
            return new LoyaltyTransactionDto
            {
                LoyaltyTransactionId =
                    transaction.LoyaltyTransactionId,

                CustomerId = transaction.CustomerId,

                OrderId = transaction.OrderId,

                Points = transaction.Points,

                TransactionType =
                    transaction.TransactionType,

                Description = transaction.Description,

                CreatedAt = transaction.CreatedAt
            };
        }
    }
}
