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

        Task<bool> DeleteAsync(int inventoryId);

        Task<InventoryDto?> UpdateAsync(
            int inventoryId,
            UpdateInventoryDto dto);

        Task<InventoryDto> AuditStockAsync(InventoryAuditDto dto);

        Task<IEnumerable<StockMovementSummaryDto>> GetStockMovementReportAsync(StockMovementFilterDto filter);

        // Quy trình kiểm kê kho & đối soát chênh lệch 2 bước:
        Task<InventoryAuditTicketDto> CreateAuditTicketAsync(CreateInventoryAuditTicketDto dto, string userId, string userName);
        Task<IEnumerable<InventoryAuditTicketDto>> GetAllAuditTicketsAsync(int? status = null);
        Task<InventoryAuditTicketDto?> GetAuditTicketByIdAsync(int ticketId);
        Task<InventoryAuditTicketDto> ApproveAuditTicketAsync(int ticketId, string approvedByUserId, string approvedByName);
        Task<InventoryAuditTicketDto> RejectAuditTicketAsync(int ticketId, string rejectedByUserId, string rejectedByName, string? reason);
    }
}
