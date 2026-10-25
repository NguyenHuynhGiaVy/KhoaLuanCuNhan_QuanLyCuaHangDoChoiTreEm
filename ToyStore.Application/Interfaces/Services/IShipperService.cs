using System.Collections.Generic;
using System.Threading.Tasks;
using ToyStoreManagement.Application.DTOs.Order;
using ToyStoreManagement.Application.DTOs.Shipper;

namespace ToyStoreManagement.Application.Interfaces.Services
{
    public interface IShipperService
    {
        Task<List<ShipperDto>> GetAllShippersAsync();
        Task<ShipperDto?> GetShipperByIdAsync(int id);
        Task<ShipperDto?> GetShipperByUserIdAsync(string userId);
        Task<ShipperDto> CreateShipperAsync(CreateShipperDto dto);
        Task<ShipperDto> UpdateShipperAsync(int id, UpdateShipperDto dto);
        Task<bool> DeleteShipperAsync(int id);

        Task<bool> AssignShipperAsync(AssignOrderShipperDto dto, string? performedByUserId = null, string? performedByName = null);
        Task<List<OrderDto>> GetShipperOrdersAsync(int shipperId, string? status = null);

        // Quy trình 5 bước chuẩn hóa của Shipper
        Task<OrderDto> AcceptOrderAsync(int orderId, int shipperId, string? userId = null, string? performerName = null, string? note = null);
        Task<OrderDto> PickupOrderAsync(int orderId, int shipperId, string? userId = null, string? performerName = null, string? note = null);
        Task<OrderDto> StartDeliveryAsync(int orderId, int shipperId, string? userId = null, string? performerName = null, string? note = null);
        Task<OrderDto> CompleteDeliveryAsync(int orderId, int shipperId, string? userId = null, string? performerName = null, string? note = null);
        Task<OrderDto> SubmitCodAsync(int orderId, int shipperId, string? userId = null, string? performerName = null, string? note = null);

        Task<OrderDto> FailDeliveryAsync(int orderId, int shipperId, FailDeliveryDto dto, string? userId = null, string? performerName = null);
        Task<OrderDto> RetryDeliveryAsync(int orderId, int shipperId, string? userId = null, string? performerName = null, string? note = null);

        // Audit Tracking Logs
        Task<List<OrderTrackingLogDto>> GetOrderTrackingLogsAsync(int orderId);
        Task AddOrderTrackingLogAsync(int orderId, int? shippingId, string action, string? previousStatus, string newStatus, string? userId, string performerName, string performerRole, string? note = null);

        // COD Reconciliation
        Task<List<CodReconciliationDto>> GetCodReconciliationListAsync(int? shipperId = null, int? codStatus = null);
        Task<bool> ConfirmCodSubmissionAsync(ConfirmCodSubmissionDto dto, string? confirmedByUserId = null, string? confirmedByName = null);
    }
}
