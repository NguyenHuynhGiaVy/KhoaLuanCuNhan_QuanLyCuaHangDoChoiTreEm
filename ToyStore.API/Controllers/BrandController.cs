using Microsoft.AspNetCore.Mvc;

using Microsoft.AspNetCore.Authorization;

using ToyStore.Application.DTOs.Brand;
using ToyStore.Application.Interfaces.Services;

namespace ToyStore.API.Controllers
{
    public class BrandController : BaseApiController
    {
        private readonly IBrandService _brandService;

        public BrandController(
            IBrandService brandService)
        {
            _brandService = brandService;
        }

        [HttpGet]
        [Authorize]
        public async Task<IActionResult> GetAll()
        {
            var result =
                await _brandService.GetAllAsync();

            return Ok(result);
        }

        [HttpGet("{id:int}")]
        [Authorize]
        public async Task<IActionResult> GetById(int id)
        {
            var result =
                await _brandService.GetByIdAsync(id);

            if (result == null)
            {
                return NotFound(new
                {
                    message = "Không tìm thấy thương hiệu."
                });
            }

            return Ok(result);
        }

        [HttpPost]
        [Authorize(Policy = "AdminOrManager")]
        public async Task<IActionResult> Create(
            CreateBrandDto request)
        {
            var result =
                await _brandService.CreateAsync(request);

            return CreatedAtAction(
                nameof(GetById),
                new { id = result.Id },
                result);
        }

        [HttpPut("{id:int}")]
        [Authorize(Policy = "AdminOrManager")]
        public async Task<IActionResult> Update(
            int id,
            UpdateBrandDto request)
        {
            var success =
                await _brandService.UpdateAsync(
                    id,
                    request);

            if (!success)
            {
                return NotFound(new
                {
                    message = "Không tìm thấy thương hiệu."
                });
            }

            return Ok(new
            {
                message = "Cập nhật thương hiệu thành công."
            });
        }

        [HttpDelete("{id:int}")]
        [Authorize(Policy = "AdminOrManager")]
        public async Task<IActionResult> Delete(int id)
        {
            var success =
                await _brandService.DeleteAsync(id);

            if (!success)
            {
                return NotFound(new
                {
                    message = "Không tìm thấy thương hiệu."
                });
            }

            return Ok(new
            {
                message = "Xóa thương hiệu thành công."
            });
        }
    }
}
