using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStore.Application.DTOs.Brand;

namespace ToyStore.Application.Interfaces.Services
{
    public interface IBrandService
    {
        Task<IEnumerable<BrandDto>> GetAllAsync();

        Task<BrandDto?> GetByIdAsync(int id);

        Task<BrandDto> CreateAsync(
            CreateBrandDto request);

        Task<bool> UpdateAsync(
            int id,
            UpdateBrandDto request);

        Task<bool> DeleteAsync(int id);
    }
}
