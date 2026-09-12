using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStoreManagement.Application.DTOs.Inventory;
using ToyStoreManagement.Application.Interfaces.Repositories;
using ToyStoreManagement.Application.Interfaces.Services;
using ToyStoreManagement.Domain.Entities;

namespace ToyStoreManagement.Infrastructure.Services
{
    public class InventoryTransactionService
        : IInventoryTransactionService
    {
        private readonly IInventoryTransactionRepository
            _transactionRepository;

        public InventoryTransactionService(
            IInventoryTransactionRepository transactionRepository)
        {
            _transactionRepository = transactionRepository;
        }

        public async Task<IEnumerable<InventoryTransactionDto>> GetAllAsync()
        {
            var transactions =
                await _transactionRepository.GetAllWithDetailsAsync();

            return transactions.Select(MapToDto);
        }

        public async Task<IEnumerable<InventoryTransactionDto>>
            GetByVariantIdAsync(int variantId)
        {
            var transactions =
                await _transactionRepository
                    .GetByVariantIdAsync(variantId);

            return transactions.Select(MapToDto);
        }

        private static InventoryTransactionDto MapToDto(
            InventoryTransaction transaction)
        {
            return new InventoryTransactionDto
            {
                Id = transaction.Id,
                TransactionId = transaction.TransactionId,
                VariantId = transaction.VariantId,
                SKU = transaction.ProductVariant?.SKU,
                ProductName =
                    transaction.ProductVariant?.Product?.Name,
                TransactionType = transaction.TransactionType,
                Quantity = transaction.Quantity,
                ReferenceType = transaction.ReferenceType,
                ReferenceId = transaction.ReferenceId,
                CreatedAt = transaction.CreatedAt,
                Note = transaction.Note
            };
        }
    }
}
