using Microsoft.AspNetCore.Mvc;

using Microsoft.AspNetCore.Authorization;
using System;
using System.Threading.Tasks;
using ToyStoreManagement.Application.DTOs.Order;
using ToyStoreManagement.Application.Interfaces.Services;

namespace ToyStoreManagement.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class OrderController : ControllerBase
    {
        private readonly IOrderService _orderService;

        public OrderController(IOrderService orderService)
        {
            _orderService = orderService;
        }

        // GET: api/Order
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var result = await _orderService.GetAllAsync();
            return Ok(result);
        }

        // GET: api/Order/5
        [HttpGet("{orderId}")]
        public async Task<IActionResult> GetById(int orderId)
        {
            var result = await _orderService.GetByIdAsync(orderId);

            if (result == null)
                return NotFound("Không tìm thấy đơn hàng.");

            return Ok(result);
        }

        // GET: api/Order/code/ORD-20260911203000123
        [HttpGet("code/{orderCode}")]
        public async Task<IActionResult> GetByOrderCode(
            string orderCode)
        {
            var result =
                await _orderService.GetByOrderCodeAsync(orderCode);

            if (result == null)
                return NotFound("Không tìm thấy đơn hàng.");

            return Ok(result);
        }

        // GET: api/Order/customer/5
        [HttpGet("customer/{customerId}")]
        public async Task<IActionResult> GetByCustomerId(
            int customerId)
        {
            var result =
                await _orderService.GetByCustomerIdAsync(customerId);

            return Ok(result);
        }

        // POST: api/Order
        [HttpPost]
        [Authorize(Policy = "StaffAccess")]
        public async Task<IActionResult> Create(
            [FromBody] CreateOrderDto dto)
        {
            try
            {
                var result =
                    await _orderService.CreateAsync(dto);

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // PUT: api/Order/5
        [HttpPut("{orderId}")]
        [Authorize(Policy = "StaffAccess")]
        public async Task<IActionResult> Update(
            int orderId,
            [FromBody] UpdateOrderDto dto)
        {
            try
            {
                var result =
                    await _orderService.UpdateAsync(
                        orderId,
                        dto);

                if (result == null)
                    return NotFound("Không tìm thấy đơn hàng.");

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // DELETE: api/Order/5
        [HttpDelete("{orderId}")]
        [Authorize(Policy = "AdminOrManager")]
        public async Task<IActionResult> Delete(int orderId)
        {
            try
            {
                var result =
                    await _orderService.DeleteAsync(orderId);

                if (!result)
                    return NotFound("Không tìm thấy đơn hàng.");

                return Ok(new
                {
                    message = "Xóa đơn hàng thành công."
                });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // GET: api/Order/5/payment
        [HttpGet("{orderId}/payment")]
        public async Task<IActionResult> GetPayment(int orderId)
        {
            var result =
                await _orderService.GetPaymentAsync(orderId);

            if (result == null)
                return NotFound(
                    "Đơn hàng chưa có thông tin thanh toán.");

            return Ok(result);
        }

        // POST: api/Order/5/payment
        [HttpPost("{orderId}/payment")]
        [Authorize(Policy = "StaffAccess")]
        public async Task<IActionResult> AddPayment(
            int orderId,
            [FromBody] CreatePaymentDto dto)
        {
            try
            {
                var result =
                    await _orderService.AddPaymentAsync(
                        orderId,
                        dto);

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // GET: api/Order/5/shipping
        [HttpGet("{orderId}/shipping")]
        public async Task<IActionResult> GetShipping(int orderId)
        {
            var result =
                await _orderService.GetShippingAsync(orderId);

            if (result == null)
                return NotFound(
                    "Đơn hàng chưa có thông tin giao hàng.");

            return Ok(result);
        }

        // POST: api/Order/5/shipping
        [HttpPost("{orderId}/shipping")]
        [Authorize(Policy = "StaffAccess")]
        public async Task<IActionResult> AddShipping(
            int orderId,
            [FromBody] CreateShippingDto dto)
        {
            try
            {
                var result =
                    await _orderService.AddShippingAsync(
                        orderId,
                        dto);

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }
    }
}