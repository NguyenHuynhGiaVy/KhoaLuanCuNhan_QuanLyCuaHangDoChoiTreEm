using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStoreManagement.Application.DTOs.Inventory;

namespace ToyStoreManagement.Application.Interfaces.Services
{
    public interface IInventoryService
    {
        Task<IEnumerable<InventoryDto>> GetAllAsync();

        Task<InventoryDto?> GetByIdAsync(int inventoryId);

        Task<InventoryDto?> GetByVariantIdAsync(int variantId);

        Task<InventoryDto> CreateAsync(CreateInventoryDto dto);

        Task<InventoryDto?> UpdateAsync(
            int inventoryId,
            UpdateInventoryDto dto);
    }
}
