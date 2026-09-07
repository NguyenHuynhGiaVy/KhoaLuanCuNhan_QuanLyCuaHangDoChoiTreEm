using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

using ToyStore.Application.DTOs.Brand;
using ToyStore.Application.Interfaces.Repositories;
using ToyStore.Application.Interfaces.Services;
using ToyStoreManagement.Domain.Entities;

namespace ToyStore.Application.Services
{
    public class BrandService : IBrandService
    {
        private readonly IBrandRepository _brandRepository;
        private readonly IUnitOfWork _unitOfWork;

        public BrandService(
            IBrandRepository brandRepository,
            IUnitOfWork unitOfWork)
        {
            _brandRepository = brandRepository;
            _unitOfWork = unitOfWork;
        }

        public async Task<IEnumerable<BrandDto>> GetAllAsync()
        {
            var brands =
                await _brandRepository.GetAllAsync();

            return brands.Select(x => new BrandDto
            {
                Id = x.BrandId,
                Name = x.Name,
                Description = x.Description,
                IsActive = x.IsActive
            });
        }

        public async Task<BrandDto?> GetByIdAsync(int id)
        {
            var brand =
                await _brandRepository.GetByIdAsync(id);

            if (brand == null)
            {
                return null;
            }

            return new BrandDto
            {
                Id = brand.BrandId,
                Name = brand.Name,
                Description = brand.Description,
                IsActive = brand.IsActive
            };
        }

        public async Task<BrandDto> CreateAsync(
            CreateBrandDto request)
        {
            var brand = new Brand
            {
                Name = request.Name.Trim(),
                Description = request.Description?.Trim(),
                IsActive = true
            };

            await _brandRepository.AddAsync(brand);

            await _unitOfWork.SaveChangesAsync();

            return new BrandDto
            {
                Id = brand.BrandId,
                Name = brand.Name,
                Description = brand.Description,
                IsActive = brand.IsActive
            };
        }

        public async Task<bool> UpdateAsync(
            int id,
            UpdateBrandDto request)
        {
            var brand =
                await _brandRepository.GetByIdAsync(id);

            if (brand == null)
            {
                return false;
            }

            brand.Name = request.Name.Trim();
            brand.Description = request.Description?.Trim();
            brand.IsActive = request.IsActive;

            _brandRepository.Update(brand);

            await _unitOfWork.SaveChangesAsync();

            return true;
        }

        public async Task<bool> DeleteAsync(int id)
        {
            var brand =
                await _brandRepository.GetByIdAsync(id);

            if (brand == null)
            {
                return false;
            }

            _brandRepository.Delete(brand);

            await _unitOfWork.SaveChangesAsync();

            return true;
        }
    }
}
