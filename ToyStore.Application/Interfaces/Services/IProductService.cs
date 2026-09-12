using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStoreManagement.Application.DTOs.Product;

namespace ToyStoreManagement.Application.Interfaces.Services
{
    public interface IProductService
    {
        Task<IEnumerable<ProductDto>> GetAllAsync();

        Task<ProductDto?> GetByIdAsync(int productId);

        Task<ProductDto> CreateAsync(
            CreateProductDto dto);

        Task<bool> UpdateAsync(
            int productId,
            UpdateProductDto dto);

        Task<bool> DeleteAsync(
            int productId);

        Task<ProductVariantDto> AddVariantAsync(
            int productId,
            CreateProductVariantDto dto);

        Task<bool> UpdateVariantAsync(
            int variantId,
            UpdateProductVariantDto dto);

        Task<bool> DeleteVariantAsync(
            int variantId);
    }
}