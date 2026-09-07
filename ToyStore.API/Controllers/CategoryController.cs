using Microsoft.AspNetCore.Mvc;

using Microsoft.AspNetCore.Authorization;

using ToyStore.Application.DTOs.Category;
using ToyStore.Application.Interfaces.Services;

namespace ToyStore.API.Controllers
{
    public class CategoryController : BaseApiController
    {
        private readonly ICategoryService _categoryService;

        public CategoryController(
            ICategoryService categoryService)
        {
            _categoryService = categoryService;
        }

        [HttpGet]
        [Authorize]
        public async Task<IActionResult> GetAll()
        {
            var result =
                await _categoryService.GetAllAsync();

            return Ok(result);
        }

        [HttpGet("{id:int}")]
        [Authorize]
        public async Task<IActionResult> GetById(int id)
        {
            var result =
                await _categoryService.GetByIdAsync(id);

            if (result == null)
            {
                return NotFound(new
                {
                    message = "Không tìm thấy danh mục."
                });
            }

            return Ok(result);
        }

        [HttpPost]
        [Authorize(Policy = "AdminOrManager")]
        public async Task<IActionResult> Create(
            CreateCategoryDto request)
        {
            var result =
                await _categoryService.CreateAsync(request);

            return CreatedAtAction(
                nameof(GetById),
                new { id = result.Id },
                result);
        }

        [HttpPut("{id:int}")]
        [Authorize(Policy = "AdminOrManager")]
        public async Task<IActionResult> Update(
            int id,
            UpdateCategoryDto request)
        {
            var success =
                await _categoryService.UpdateAsync(
                    id,
                    request);

            if (!success)
            {
                return NotFound(new
                {
                    message = "Không tìm thấy danh mục."
                });
            }

            return Ok(new
            {
                message = "Cập nhật danh mục thành công."
            });
        }

        [HttpDelete("{id:int}")]
        [Authorize(Policy = "AdminOrManager")]
        public async Task<IActionResult> Delete(int id)
        {
            var success =
                await _categoryService.DeleteAsync(id);

            if (!success)
            {
                return NotFound(new
                {
                    message = "Không tìm thấy danh mục."
                });
            }

            return Ok(new
            {
                message = "Xóa danh mục thành công."
            });
        }
    }
}
