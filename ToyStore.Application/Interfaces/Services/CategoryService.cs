using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStore.Application.Interfaces.Repositories;
using ToyStore.Application.Interfaces.Services;
using ToyStoreManagement.Domain.Entities;
using ToyStore.Application.DTOs.Category;

namespace ToyStore.Application.Services
{
    public class CategoryService : ICategoryService
    {
        private readonly ICategoryRepository _categoryRepository;
        private readonly IUnitOfWork _unitOfWork;

        public CategoryService(
            ICategoryRepository categoryRepository,
            IUnitOfWork unitOfWork)
        {
            _categoryRepository = categoryRepository;
            _unitOfWork = unitOfWork;
        }

        public async Task<IEnumerable<CategoryDto>> GetAllAsync()
        {
            var categories = await _categoryRepository.GetAllWithProductsAsync();

            return categories.Select(x => new CategoryDto
            {
                Id = x.CategoryId,
                Name = x.Name,
                Description = x.Description,
                IsActive = x.IsActive,
                ProductCount = x.Products?.Count ?? 0
            });
        }

        public async Task<CategoryDto?> GetByIdAsync(int id)
        {
            var category =
                await _categoryRepository.GetByIdAsync(id);

            if (category == null)
            {
                return null;
            }

            return new CategoryDto
            {
                Id = category.CategoryId,
                Name = category.Name,
                Description = category.Description,
                IsActive = category.IsActive
            };
        }

        public async Task<CategoryDto> CreateAsync(CreateCategoryDto request)
        {
            var name = request.Name.Trim();

            var exists = await _categoryRepository
                .AnyAsync(x => x.Name.ToLower() == name.ToLower());

            if (exists)
            {
                throw new InvalidOperationException(
                    "Tên danh mục đã tồn tại.");
            }

            var category = new Category
            {
                Name = name,
                Description = request.Description?.Trim(),
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            await _categoryRepository.AddAsync(category);
            await _unitOfWork.SaveChangesAsync();

            return new CategoryDto
            {
                Id = category.CategoryId,
                Name = category.Name,
                Description = category.Description,
                IsActive = category.IsActive
            };
        }

        public async Task<bool> UpdateAsync(
            int id,
            UpdateCategoryDto request)
        {
            var category =
                await _categoryRepository.GetByIdAsync(id);

            if (category == null)
            {
                return false;
            }

            category.Name = request.Name.Trim();
            category.Description = request.Description?.Trim();
            category.IsActive = request.IsActive;
            category.UpdatedAt = DateTime.UtcNow;

            _categoryRepository.Update(category);
            await _unitOfWork.SaveChangesAsync();

            return true;
        }

        public async Task<bool> DeleteAsync(int id)
        {
            var category =
                await _categoryRepository.GetByIdAsync(id);

            if (category == null)
            {
                return false;
            }

            _categoryRepository.Delete(category);
            await _unitOfWork.SaveChangesAsync();

            return true;
        }
    }
}
