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
        Task<ShipperDto> CreateShipperAsync(CreateShipperDto dto);
        Task<ShipperDto> UpdateShipperAsync(int id, UpdateShipperDto dto);
        Task<bool> DeleteShipperAsync(int id);

        Task<bool> AssignShipperAsync(AssignOrderShipperDto dto);
        Task<List<OrderDto>> GetShipperOrdersAsync(int shipperId, string? status = null);

        Task<OrderDto> StartDeliveryAsync(int orderId, int shipperId);
        Task<OrderDto> CompleteDeliveryAsync(int orderId, int shipperId);
        Task<OrderDto> FailDeliveryAsync(int orderId, int shipperId, FailDeliveryDto dto);
        Task<OrderDto> RetryDeliveryAsync(int orderId, int shipperId);

        Task<List<CodReconciliationDto>> GetCodReconciliationListAsync(int? shipperId = null, int? codStatus = null);
        Task<bool> ConfirmCodSubmissionAsync(ConfirmCodSubmissionDto dto);
    }
}
