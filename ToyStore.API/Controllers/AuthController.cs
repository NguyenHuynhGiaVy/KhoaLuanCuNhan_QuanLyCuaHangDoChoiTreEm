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
                    message = "Email hoặc mật khẩu không chính xác hoặc tài khoản đã bị khóa."
                });
            }

            return Ok(result);
        }

        [HttpPost("logout")]
        public IActionResult Logout()
        {
            return Ok(new { message = "Đăng xuất thành công." });
        }

        [HttpPost("change-password")]
        [Microsoft.AspNetCore.Authorization.Authorize]
        public async Task<IActionResult> ChangePassword(
            [FromBody] ChangePasswordRequestDto request)
        {
            var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "Bạn chưa đăng nhập." });
            }

            try
            {
                var success = await _authService.ChangePasswordAsync(userId, request);
                if (!success)
                {
                    return BadRequest(new { message = "Không tìm thấy người dùng." });
                }

                return Ok(new { message = "Đổi mật khẩu thành công." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("users")]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = "AdminOnly")]
        public async Task<IActionResult> GetUsers()
        {
            var users = await _authService.GetUsersAsync();
            return Ok(users);
        }

        [HttpPost("assign-role")]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = "AdminOnly")]
        public async Task<IActionResult> AssignRole([FromBody] AssignRoleDto dto)
        {
            var success = await _authService.AssignRoleAsync(dto);
            if (!success)
            {
                return BadRequest(new { message = "Phân quyền thất bại. Kiểm tra lại thông tin." });
            }

            return Ok(new { message = "Cập nhật vai trò thành công." });
        }

        [HttpPost("users/{userId}/toggle-status")]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = "AdminOnly")]
        public async Task<IActionResult> ToggleUserStatus(string userId)
        {
            var success = await _authService.ToggleUserStatusAsync(userId);
            if (!success)
            {
                return BadRequest(new { message = "Không tìm thấy người dùng." });
            }

            return Ok(new { message = "Cập nhật trạng thái tài khoản thành công." });
        }
    }
}
