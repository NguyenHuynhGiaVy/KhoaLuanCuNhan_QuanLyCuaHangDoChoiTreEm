using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ToyStore.API.Controllers
{
    public class TestAuthController : BaseApiController
    {
        [HttpGet("public")]
        [AllowAnonymous]
        public IActionResult Public()
        {
            return Ok(new
            {
                message = "API công khai hoạt động."
            });
        }

        [HttpGet("authenticated")]
        [Authorize]
        public IActionResult Authenticated()
        {
            return Ok(new
            {
                message = "Bạn đã đăng nhập.",
                userId = User.FindFirstValue(ClaimTypes.NameIdentifier),
                email = User.FindFirstValue(
                    ClaimTypes.Email)
            });
        }

        [HttpGet("customer")]
        [Authorize(Policy = "CustomerAccess")]
        public IActionResult Customer()
        {
            return Ok(new
            {
                message = "Bạn có quyền Customer."
            });
        }

        [HttpGet("staff")]
        [Authorize(Policy = "StaffAccess")]
        public IActionResult Staff()
        {
            return Ok(new
            {
                message = "Bạn có quyền Staff."
            });
        }

        [HttpGet("manager")]
        [Authorize(Policy = "ManagerOnly")]
        public IActionResult Manager()
        {
            return Ok(new
            {
                message = "Bạn có quyền Manager."
            });
        }

        [HttpGet("admin")]
        [Authorize(Policy = "AdminOnly")]
        public IActionResult Admin()
        {
            return Ok(new
            {
                message = "Bạn có quyền Admin."
            });
        }
    }
}