using Microsoft.AspNetCore.Mvc;

using Microsoft.AspNetCore.Authorization;
using ToyStoreManagement.Application.DTOs.Import;
using ToyStoreManagement.Application.Interfaces.Services;

namespace ToyStoreManagement.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class SupplierController : ControllerBase
    {
        private readonly ISupplierService _service;

        public SupplierController(ISupplierService service)
        {
            _service = service;
        }

        // GET: api/Supplier
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var suppliers = await _service.GetAllAsync();

            return Ok(suppliers);
        }

        // GET: api/Supplier/1
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var supplier = await _service.GetByIdAsync(id);

            if (supplier == null)
                return NotFound(new
                {
                    message = "Không tìm thấy nhà cung cấp."
                });

            return Ok(supplier);
        }

        // POST: api/Supplier
        [HttpPost]
        [Authorize(Policy = "AdminOrManager")]
        public async Task<IActionResult> Create(
            [FromBody] CreateSupplierDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var supplier = await _service.CreateAsync(dto);

            return CreatedAtAction(
                nameof(GetById),
                new { id = supplier.SupplierId },
                supplier);
        }

        // PUT: api/Supplier/1
        [HttpPut("{id}")]
        [Authorize(Policy = "AdminOrManager")]
        public async Task<IActionResult> Update(
            int id,
            [FromBody] UpdateSupplierDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var supplier = await _service.UpdateAsync(id, dto);

            if (supplier == null)
                return NotFound(new
                {
                    message = "Không tìm thấy nhà cung cấp."
                });

            return Ok(supplier);
        }

        // DELETE: api/Supplier/1
        [HttpDelete("{id}")]
        [Authorize(Policy = "AdminOrManager")]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _service.DeleteAsync(id);

            if (!result)
                return NotFound(new
                {
                    message = "Không tìm thấy nhà cung cấp."
                });

            return Ok(new
            {
                message = "Đã vô hiệu hóa nhà cung cấp."
            });
        }
    }
}
