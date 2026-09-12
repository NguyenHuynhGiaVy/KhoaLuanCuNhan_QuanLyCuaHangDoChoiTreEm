using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Threading.Tasks;
using ToyStoreManagement.Application.DTOs.Promotion;
using ToyStoreManagement.Application.Interfaces.Services;

namespace ToyStoreManagement.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class VoucherController : ControllerBase
    {
        private readonly IVoucherService _voucherService;

        public VoucherController(
            IVoucherService voucherService)
        {
            _voucherService = voucherService;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            try
            {
                var result =
                    await _voucherService.GetAllAsync();

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpGet("{voucherId}")]
        public async Task<IActionResult> GetById(
            int voucherId)
        {
            try
            {
                var result =
                    await _voucherService
                        .GetByIdAsync(voucherId);

                if (result == null)
                    return NotFound(
                        "Không tìm thấy voucher.");

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpGet("code/{code}")]
        public async Task<IActionResult> GetByCode(
            string code)
        {
            try
            {
                var result =
                    await _voucherService
                        .GetByCodeAsync(code);

                if (result == null)
                    return NotFound(
                        "Không tìm thấy voucher.");

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPost]
        [Authorize(Policy = "AdminOrManager")]
        public async Task<IActionResult> Create(
            CreateVoucherDto dto)
        {
            try
            {
                var result =
                    await _voucherService.CreateAsync(dto);

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPut("{voucherId}")]
        [Authorize(Policy = "AdminOrManager")]
        public async Task<IActionResult> Update(
            int voucherId,
            UpdateVoucherDto dto)
        {
            try
            {
                var result =
                    await _voucherService
                        .UpdateAsync(voucherId, dto);

                if (result == null)
                    return NotFound(
                        "Không tìm thấy voucher.");

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpDelete("{voucherId}")]
        [Authorize(Policy = "AdminOrManager")]
        public async Task<IActionResult> Delete(
            int voucherId)
        {
            try
            {
                var result =
                    await _voucherService
                        .DeleteAsync(voucherId);

                if (!result)
                    return NotFound(
                        "Không tìm thấy voucher.");

                return Ok(
                    "Xóa voucher thành công.");
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPost("{voucherId}/use")]
        [Authorize(Policy = "StaffAccess")]
        public async Task<IActionResult> UseVoucher(
            int voucherId,
            int orderId,
            int? customerId,
            decimal discountAmount)
        {
            try
            {
                var result =
                    await _voucherService
                        .UseVoucherAsync(
                            voucherId,
                            orderId,
                            customerId,
                            discountAmount);

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }
    }
}