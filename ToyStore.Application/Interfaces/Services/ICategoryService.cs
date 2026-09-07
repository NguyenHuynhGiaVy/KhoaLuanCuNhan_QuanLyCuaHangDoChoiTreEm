using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStoreManagement.Domain.Entities;
using ToyStore.Application.DTOs.Category;

namespace ToyStore.Application.Interfaces.Services
{
    public interface ICategoryService
    {
        Task<IEnumerable<CategoryDto>> GetAllAsync();

        Task<CategoryDto?> GetByIdAsync(int id);

        Task<CategoryDto> CreateAsync(
            CreateCategoryDto request);

        Task<bool> UpdateAsync(
            int id,
            UpdateCategoryDto request);

        Task<bool> DeleteAsync(int id);
    }
}
