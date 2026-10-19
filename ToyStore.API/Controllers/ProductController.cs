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
        [AllowAnonymous]
        public async Task<IActionResult> GetAll(
            [FromQuery] int? categoryId = null,
            [FromQuery] int? brandId = null,
            [FromQuery] int? status = null,
            [FromQuery] decimal? minPrice = null,
            [FromQuery] decimal? maxPrice = null,
            [FromQuery] string? search = null)
        {
            var products =
                await _productService.GetAllAsync();

            IEnumerable<ProductDto> query = products;

            if (categoryId.HasValue)
                query = query.Where(p => p.CategoryId == categoryId.Value);

            if (brandId.HasValue)
                query = query.Where(p => p.BrandId == brandId.Value);

            if (status.HasValue)
                query = query.Where(p => p.Status == status.Value);

            if (minPrice.HasValue)
            {
                query = query.Where(p =>
                {
                    var price = p.BasePrice ?? (p.ProductVariants != null && p.ProductVariants.Count > 0 ? p.ProductVariants[0].Price : 0);
                    return price >= minPrice.Value;
                });
            }

            if (maxPrice.HasValue)
            {
                query = query.Where(p =>
                {
                    var price = p.BasePrice ?? (p.ProductVariants != null && p.ProductVariants.Count > 0 ? p.ProductVariants[0].Price : 0);
                    return price <= maxPrice.Value;
                });
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLower();
                query = query.Where(p => (p.Name != null && p.Name.ToLower().Contains(s))
                    || p.ProductId.ToString() == s
                    || (p.ProductVariants != null && p.ProductVariants.Any(v => v.SKU != null && v.SKU.ToLower().Contains(s))));
            }

            return Ok(query.ToList());
        }

        // ==========================================
        // GET BY ID
        // ==========================================

        [HttpGet("{id:int}")]
        [AllowAnonymous]
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
                    message = GetFriendlyErrorMessage(ex)
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

        private static string GetFriendlyErrorMessage(Exception ex)
        {
            var msg = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
            if (msg.Contains("IX_ProductVariants_SKU") || msg.Contains("duplicate key"))
            {
                return "Mã SKU của biến thể sản phẩm đã tồn tại trong hệ thống. Vui lòng nhập mã SKU khác.";
            }
            return msg;
        }
    }
}
