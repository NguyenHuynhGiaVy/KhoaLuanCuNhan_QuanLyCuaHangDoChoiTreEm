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
    }
}
