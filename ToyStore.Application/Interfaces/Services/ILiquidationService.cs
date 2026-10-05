using ToyStoreManagement.Application.DTOs.Liquidation;

namespace ToyStoreManagement.Application.Interfaces.Services
{
    public interface ILiquidationService
    {
        Task<IEnumerable<LiquidationReceiptDto>> GetAllAsync();
        Task<LiquidationReceiptDto?> GetByIdAsync(int id);
        Task<LiquidationReceiptDto> CreateAsync(CreateLiquidationReceiptDto dto, string userId);
        Task<LiquidationReceiptDto?> CompleteAsync(int id);
        Task<LiquidationReceiptDto?> CancelAsync(int id);
    }
}
