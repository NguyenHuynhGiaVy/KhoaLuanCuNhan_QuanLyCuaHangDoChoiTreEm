using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ToyStoreManagement.Application.DTOs.Import;
using ToyStoreManagement.Application.Interfaces.Services;

namespace ToyStoreManagement.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ImportReceiptController : ControllerBase
    {
        private readonly IImportReceiptService _service;

        public ImportReceiptController(
            IImportReceiptService service)
        {
            _service = service;
        }

        // GET: api/ImportReceipt
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var receipts = await _service.GetAllAsync();

            return Ok(receipts);
        }

        // GET: api/ImportReceipt/1
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var receipt = await _service.GetByIdAsync(id);

            if (receipt == null)
                return NotFound(new
                {
                    message = "Không tìm thấy phiếu nhập."
                });

            return Ok(receipt);
        }

        // POST: api/ImportReceipt
        [HttpPost]
        [Authorize(Policy = "AdminOrManager")]
        public async Task<IActionResult> Create(
            [FromBody] CreateImportReceiptDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            try
            {
                var receipt = await _service.CreateAsync(dto);

                return CreatedAtAction(
                    nameof(GetById),
                    new { id = receipt.ImportReceiptId },
                    receipt);
            }
            catch (Exception ex)
            {
                return BadRequest(new
                {
                    message = ex.Message
                });
            }
        }

        // PUT: api/ImportReceipt/1
        [HttpPut("{id}")]
        [Authorize(Policy = "AdminOrManager")]
        public async Task<IActionResult> Update(
            int id,
            [FromBody] CreateImportReceiptDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            try
            {
                var receipt =
                    await _service.UpdateAsync(id, dto);

                if (receipt == null)
                    return NotFound(new
                    {
                        message = "Không tìm thấy phiếu nhập."
                    });

                return Ok(receipt);
            }
            catch (Exception ex)
            {
                return BadRequest(new
                {
                    message = ex.Message
                });
            }
        }

        // DELETE: api/ImportReceipt/1
        [HttpDelete("{id}")]
        [Authorize(Policy = "AdminOrManager")]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _service.DeleteAsync(id);

            if (!result)
                return NotFound(new
                {
                    message = "Không tìm thấy phiếu nhập."
                });

            return Ok(new
            {
                message = "Xóa phiếu nhập thành công."
            });
        }
    }
}