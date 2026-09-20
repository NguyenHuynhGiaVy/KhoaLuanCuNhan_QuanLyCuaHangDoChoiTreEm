using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStore.Application.DTOs.Auth;

namespace ToyStore.Application.Interfaces.Services
{
    public interface IAuthService
    {
        Task<AuthResponseDto?> RegisterAsync(
            RegisterRequestDto request);

        Task<AuthResponseDto?> LoginAsync(
            LoginRequestDto request);

        Task<bool> ChangePasswordAsync(
            string userId,
            ChangePasswordRequestDto request);

        Task<IEnumerable<UserDto>> GetUsersAsync();

        Task<bool> AssignRoleAsync(
            AssignRoleDto dto);

        Task<bool> ToggleUserStatusAsync(
            string userId);
    }
}
