using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStoreManagement.Application.DTOs.Inventory;

namespace ToyStoreManagement.Application.Interfaces.Services
{
    public interface IInventoryTransactionService
    {
        Task<IEnumerable<InventoryTransactionDto>> GetAllAsync();

        Task<IEnumerable<InventoryTransactionDto>> GetByVariantIdAsync(
            int variantId);
    }
}
