using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStoreManagement.Application.DTOs.Inventory;
using ToyStoreManagement.Application.Interfaces;
using ToyStoreManagement.Application.Interfaces.Repositories;
using ToyStoreManagement.Application.Interfaces.Services;
using ToyStoreManagement.Domain.Entities;
using ToyStore.Application.Interfaces.Repositories;

namespace ToyStoreManagement.Infrastructure.Services
{
    public class InventoryService : IInventoryService
    {
        private readonly IInventoryRepository _inventoryRepository;
        private readonly IGenericRepository<ProductVariant> _variantRepository;
        private readonly IUnitOfWork _unitOfWork;

        public InventoryService(
            IInventoryRepository inventoryRepository,
            IGenericRepository<ProductVariant> variantRepository,
            IUnitOfWork unitOfWork)
        {
            _inventoryRepository = inventoryRepository;
            _variantRepository = variantRepository;
            _unitOfWork = unitOfWork;
        }

        public async Task<IEnumerable<InventoryDto>> GetAllAsync()
        {
            var inventories =
                await _inventoryRepository.GetAllWithDetailsAsync();

            return inventories.Select(MapToDto);
        }

        public async Task<InventoryDto?> GetByIdAsync(int inventoryId)
        {
            var inventory =
                await _inventoryRepository.GetByIdWithDetailsAsync(inventoryId);

            return inventory == null ? null : MapToDto(inventory);
        }

        public async Task<InventoryDto?> GetByVariantIdAsync(int variantId)
        {
            var inventory =
                await _inventoryRepository.GetByVariantIdAsync(variantId);

            return inventory == null ? null : MapToDto(inventory);
        }

        public async Task<InventoryDto> CreateAsync(CreateInventoryDto dto)
        {
            if (dto.Quantity < 0)
                throw new Exception("Số lượng tồn kho không được âm.");

            if (dto.ReservedQuantity < 0)
                throw new Exception("Số lượng đã giữ không được âm.");

            if (dto.ReservedQuantity > dto.Quantity)
                throw new Exception(
                    "Số lượng đã giữ không được lớn hơn số lượng tồn kho.");

            var variant =
                await _variantRepository.GetByIdAsync(dto.VariantId);

            if (variant == null)
                throw new Exception("Không tìm thấy ProductVariant.");

            var existing =
                await _inventoryRepository.GetByVariantIdAsync(dto.VariantId);

            if (existing != null)
                throw new Exception(
                    "ProductVariant này đã có bản ghi tồn kho.");

            var inventory = new Inventory
            {
                VariantId = dto.VariantId,
                Quantity = dto.Quantity,
                ReservedQuantity = dto.ReservedQuantity,
                UpdatedAt = DateTime.UtcNow
            };

            await _inventoryRepository.AddAsync(inventory);
            await _unitOfWork.SaveChangesAsync();

            var result =
                await _inventoryRepository.GetByIdWithDetailsAsync(
                    inventory.InventoryId);

            return MapToDto(result!);
        }

        public async Task<InventoryDto?> UpdateAsync(
            int inventoryId,
            UpdateInventoryDto dto)
        {
            if (dto.Quantity < 0)
                throw new Exception("Số lượng tồn kho không được âm.");

            if (dto.ReservedQuantity < 0)
                throw new Exception("Số lượng đã giữ không được âm.");

            if (dto.ReservedQuantity > dto.Quantity)
                throw new Exception(
                    "Số lượng đã giữ không được lớn hơn số lượng tồn kho.");

            var inventory =
                await _inventoryRepository.GetByIdAsync(inventoryId);

            if (inventory == null)
                return null;

            inventory.Quantity = dto.Quantity;
            inventory.ReservedQuantity = dto.ReservedQuantity;
            inventory.UpdatedAt = DateTime.UtcNow;

            _inventoryRepository.Update(inventory);

            await _unitOfWork.SaveChangesAsync();

            var result =
                await _inventoryRepository.GetByIdWithDetailsAsync(
                    inventoryId);

            return MapToDto(result!);
        }

        private static InventoryDto MapToDto(Inventory inventory)
        {
            return new InventoryDto
            {
                InventoryId = inventory.InventoryId,
                VariantId = inventory.VariantId,
                SKU = inventory.ProductVariant?.SKU,
                ProductName = inventory.ProductVariant?.Product?.Name,
                Quantity = inventory.Quantity,
                ReservedQuantity = inventory.ReservedQuantity,
                AvailableQuantity =
                    inventory.Quantity - inventory.ReservedQuantity,
                UpdatedAt = inventory.UpdatedAt
            };
        }
    }
}
