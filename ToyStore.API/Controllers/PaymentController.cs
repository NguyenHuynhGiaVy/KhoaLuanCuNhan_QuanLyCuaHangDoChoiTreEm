using Microsoft.AspNetCore.Mvc;

using Microsoft.AspNetCore.Authorization;

using System.Threading.Tasks;
using ToyStoreManagement.Application.Interfaces.Services;

namespace ToyStoreManagement.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class PaymentController : ControllerBase
    {
        private readonly IPaymentService _paymentService;

        public PaymentController(IPaymentService paymentService)
        {
            _paymentService = paymentService;
        }

        // GET: api/Payment
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var result = await _paymentService.GetAllAsync();

            return Ok(result);
        }

        // GET: api/Payment/5
        [HttpGet("{paymentId}")]
        public async Task<IActionResult> GetById(int paymentId)
        {
            var result =
                await _paymentService.GetByIdAsync(paymentId);

            if (result == null)
                return NotFound(
                    "Không tìm thấy thanh toán.");

            return Ok(result);
        }

        // GET: api/Payment/order/5
        [HttpGet("order/{orderId}")]
        public async Task<IActionResult> GetByOrderId(
            int orderId)
        {
            var result =
                await _paymentService.GetByOrderIdAsync(orderId);

            if (result == null)
                return NotFound(
                    "Không tìm thấy thanh toán của đơn hàng.");

            return Ok(result);
        }
    }
}