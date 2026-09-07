using Microsoft.AspNetCore.Mvc;
namespace ToyStore.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class HealthController : ControllerBase
    {
        private readonly ILogger<HealthController> _logger;

        public HealthController(
            ILogger<HealthController> logger)
        {
            _logger = logger;
        }

        [HttpGet]
        public IActionResult Get()
        {
            _logger.LogInformation(
                "Health check API được gọi.");

            return Ok(new
            {
                success = true,
                message = "ToyStore API is running!",
                timestamp = DateTime.UtcNow
            });
        }
    }
}