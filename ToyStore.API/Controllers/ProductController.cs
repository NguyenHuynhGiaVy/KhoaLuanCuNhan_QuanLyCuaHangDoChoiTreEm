using Microsoft.AspNetCore.Mvc;

using Microsoft.AspNetCore.Authorization;

using ToyStoreManagement.Application.DTOs.Product;
using ToyStoreManagement.Application.Interfaces.Services;

namespace ToyStoreManagement.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ProductController : ControllerBase
    {
        private readonly IProductService _productService;

        public ProductController(
            IProductService productService)
        {
            _productService = productService;
        }

        // ==========================================
        // GET ALL
        // ==========================================

        [HttpGet]
        [Authorize]
        public async Task<IActionResult> GetAll()
        {
            var products =
                await _productService.GetAllAsync();

            return Ok(products);
        }

        // ==========================================
        // GET BY ID
        // ==========================================

        [HttpGet("{id:int}")]
        [Authorize]
        public async Task<IActionResult> GetById(
            int id)
        {
            var product =
                await _productService
                    .GetByIdAsync(id);

            if (product == null)
            {
                return NotFound(new
                {
                    message =
                        "Không tìm thấy sản phẩm."
                });
            }

            return Ok(product);
        }

        // ==========================================
        // CREATE
        // ==========================================

        [HttpPost]
        [Authorize(Policy = "AdminOrManager")]
        public async Task<IActionResult> Create(
            CreateProductDto dto)
        {
            try
            {
                var product =
                    await _productService
                        .CreateAsync(dto);

                return CreatedAtAction(
                    nameof(GetById),
                    new
                    {
                        id = product.ProductId
                    },
                    product);
            }
            catch (Exception ex)
            {
                return BadRequest(new
                {
                    message = ex.Message
                });
            }
        }

        // ==========================================
        // UPDATE
        // ==========================================

        [HttpPut("{id:int}")]
        [Authorize(Policy = "AdminOrManager")]
        public async Task<IActionResult> Update(
            int id,
            UpdateProductDto dto)
        {
            try
            {
                var result =
                    await _productService
                        .UpdateAsync(id, dto);

                if (!result)
                {
                    return NotFound(new
                    {
                        message =
                            "Không tìm thấy sản phẩm."
                    });
                }

                return Ok(new
                {
                    message =
                        "Cập nhật sản phẩm thành công."
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new
                {
                    message = ex.Message
                });
            }
        }

        // ==========================================
        // DELETE
        // ==========================================

        [HttpDelete("{id:int}")]
        [Authorize(Policy = "AdminOrManager")]
        public async Task<IActionResult> Delete(
            int id)
        {
            try
            {
                var result =
                    await _productService
                        .DeleteAsync(id);

                if (!result)
                {
                    return NotFound(new
                    {
                        message =
                            "Không tìm thấy sản phẩm."
                    });
                }

                return Ok(new
                {
                    message =
                        "Xóa sản phẩm thành công."
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new
                {
                    message = ex.Message
                });
            }
        }

        // ==========================================
        // ADD VARIANT
        // ==========================================

        [HttpPost("{productId:int}/variants")]
        [Authorize(Policy = "AdminOrManager")]
        public async Task<IActionResult> AddVariant(
            int productId,
            CreateProductVariantDto dto)
        {
            try
            {
                var variant =
                    await _productService
                        .AddVariantAsync(
                            productId,
                            dto);

                return Ok(variant);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new
                {
                    message = ex.Message
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new
                {
                    message = ex.Message
                });
            }
        }

        // ==========================================
        // UPDATE VARIANT
        // ==========================================

        [HttpPut("variants/{variantId:int}")]
        [Authorize(Policy = "AdminOrManager")]
        public async Task<IActionResult> UpdateVariant(
            int variantId,
            UpdateProductVariantDto dto)
        {
            try
            {
                var result =
                    await _productService
                        .UpdateVariantAsync(
                            variantId,
                            dto);

                if (!result)
                {
                    return NotFound(new
                    {
                        message =
                            "Không tìm thấy biến thể."
                    });
                }

                return Ok(new
                {
                    message =
                        "Cập nhật biến thể thành công."
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new
                {
                    message = ex.Message
                });
            }
        }

        // ==========================================
        // DELETE VARIANT
        // ==========================================

        [HttpDelete("variants/{variantId:int}")]
        [Authorize(Policy = "AdminOrManager")]
        public async Task<IActionResult> DeleteVariant(
            int variantId)
        {
            var result =
                await _productService
                    .DeleteVariantAsync(variantId);

            if (!result)
            {
                return NotFound(new
                {
                    message =
                        "Không tìm thấy biến thể."
                });
            }

            return Ok(new
            {
                message =
                    "Xóa biến thể thành công."
            });
        }
    }
}
