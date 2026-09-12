using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStoreManagement.Application.DTOs.Promotion;

namespace ToyStoreManagement.Application.Interfaces.Services
{
    public interface IPromotionService
    {
        Task<IEnumerable<PromotionDto>> GetAllAsync();

        Task<PromotionDto?> GetByIdAsync(int promotionId);

        Task<PromotionDto> CreateAsync(CreatePromotionDto dto);

        Task<PromotionDto?> UpdateAsync(
            int promotionId,
            UpdatePromotionDto dto);

        Task<bool> DeleteAsync(int promotionId);

        Task<PromotionConditionDto> AddConditionAsync(
            int promotionId,
            CreatePromotionConditionDto dto);

        Task<bool> DeleteConditionAsync(
            int conditionId);

        Task<PromotionProductDto> AddProductAsync(
            int promotionId,
            CreatePromotionProductDto dto);

        Task<bool> DeleteProductAsync(
            int promotionProductId);
    }
}
