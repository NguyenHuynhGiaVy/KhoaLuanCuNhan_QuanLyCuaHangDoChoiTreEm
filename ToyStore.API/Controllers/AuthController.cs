using Microsoft.AspNetCore.Mvc;
using ToyStore.Application.DTOs.Auth;
using ToyStore.Application.Interfaces.Services;

namespace ToyStore.API.Controllers
{
    public class AuthController : BaseApiController
    {
        private readonly IAuthService _authService;

        public AuthController(IAuthService authService)
        {
            _authService = authService;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register(
            RegisterRequestDto request)
        {
            try
            {
                var result =
                    await _authService.RegisterAsync(request);

                if (result == null)
                {
                    return BadRequest(new
                    {
                        message = "Email đã được sử dụng."
                    });
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(new
                {
                    message = ex.Message
                });
            }
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login(
            LoginRequestDto request)
        {
            var result =
                await _authService.LoginAsync(request);

            if (result == null)
            {
                return Unauthorized(new
                {
                    message = "Email hoặc mật khẩu không chính xác."
                });
            }

            return Ok(result);
        }
    }
}
