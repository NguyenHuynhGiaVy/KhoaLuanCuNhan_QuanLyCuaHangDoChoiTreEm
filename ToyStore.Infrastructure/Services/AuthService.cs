using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using ToyStore.Application.DTOs.Auth;
using ToyStore.Application.Interfaces.Services;
using ToyStoreManagement.Domain.Identity;
using ToyStore.Domain.Identity;

namespace ToyStore.Infrastructure.Services
{
    public class AuthService : IAuthService
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IConfiguration _configuration;

        public AuthService(
            UserManager<ApplicationUser> userManager,
            IConfiguration configuration)
        {
            _userManager = userManager;
            _configuration = configuration;
        }

        public async Task<AuthResponseDto?> RegisterAsync(
            RegisterRequestDto request)
        {
            var existingUser = await _userManager.FindByEmailAsync(
                request.Email);

            if (existingUser != null)
            {
                return null;
            }

            var user = new ApplicationUser
            {
                UserName = request.Email,
                Email = request.Email,
                FullName = request.FullName,
                PhoneNumber = request.PhoneNumber,
                IsActive = true
            };

            var result = await _userManager.CreateAsync(
                user,
                request.Password);

            if (!result.Succeeded)
            {
                throw new Exception(
                    string.Join(
                        "; ",
                        result.Errors.Select(x => x.Description)));
            }

            await _userManager.AddToRoleAsync(
                user,
                "Customer");

            return await GenerateAuthResponseAsync(user);
        }

        public async Task<AuthResponseDto?> LoginAsync(
            LoginRequestDto request)
        {
            var user = await _userManager.FindByEmailAsync(
                request.Email);

            if (user == null || !user.IsActive)
            {
                return null;
            }

            var validPassword =
                await _userManager.CheckPasswordAsync(
                    user,
                    request.Password);

            if (!validPassword)
            {
                return null;
            }

            return await GenerateAuthResponseAsync(user);
        }

        public async Task<bool> ChangePasswordAsync(
            string userId,
            ChangePasswordRequestDto request)
        {
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null)
            {
                return false;
            }

            var result = await _userManager.ChangePasswordAsync(
                user,
                request.CurrentPassword,
                request.NewPassword);

            if (!result.Succeeded)
            {
                throw new Exception(
                    string.Join("; ", result.Errors.Select(e => e.Description)));
            }

            return true;
        }

        public async Task<IEnumerable<UserDto>> GetUsersAsync()
        {
            var users = _userManager.Users.ToList();
            var userDtos = new List<UserDto>();

            foreach (var user in users)
            {
                var roles = await _userManager.GetRolesAsync(user);
                userDtos.Add(new UserDto
                {
                    UserId = user.Id,
                    Email = user.Email ?? string.Empty,
                    FullName = user.FullName ?? string.Empty,
                    PhoneNumber = user.PhoneNumber,
                    IsActive = user.IsActive,
                    Role = roles.FirstOrDefault() ?? "Customer"
                });
            }

            return userDtos;
        }

        public async Task<bool> AssignRoleAsync(AssignRoleDto dto)
        {
            var user = await _userManager.FindByIdAsync(dto.UserId);
            if (user == null)
            {
                return false;
            }

            var currentRoles = await _userManager.GetRolesAsync(user);
            await _userManager.RemoveFromRolesAsync(user, currentRoles);
            var result = await _userManager.AddToRoleAsync(user, dto.Role);

            return result.Succeeded;
        }

        public async Task<bool> ToggleUserStatusAsync(string userId)
        {
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null)
            {
                return false;
            }

            user.IsActive = !user.IsActive;
            var result = await _userManager.UpdateAsync(user);
            return result.Succeeded;
        }

        private async Task<AuthResponseDto> GenerateAuthResponseAsync(
            ApplicationUser user)
        {
            var roles = await _userManager.GetRolesAsync(user);

            var role = roles.FirstOrDefault() ?? "Customer";

            var jwtSettings = _configuration.GetSection("Jwt");

            var key = jwtSettings["Key"]
                ?? throw new InvalidOperationException(
                    "JWT Key is not configured.");

            var issuer = jwtSettings["Issuer"];

            var audience = jwtSettings["Audience"];

            var expireMinutes =
                int.TryParse(
                    jwtSettings["ExpireMinutes"],
                    out var minutes)
                    ? minutes
                    : 60;

            var claims = new List<Claim>
            {
                new Claim(
                    JwtRegisteredClaimNames.Sub,
                    user.Id),

                new Claim(
                    JwtRegisteredClaimNames.Email,
                    user.Email ?? string.Empty),

                new Claim(
                    ClaimTypes.Name,
                    user.UserName ?? string.Empty),

                new Claim(
                    "FullName",
                    user.FullName ?? string.Empty),

                new Claim(
                    ClaimTypes.Role,
                    role)
            };

            var securityKey =
                new SymmetricSecurityKey(
                    Encoding.UTF8.GetBytes(key));

            var credentials =
                new SigningCredentials(
                    securityKey,
                    SecurityAlgorithms.HmacSha256);

            var expiration =
                DateTime.UtcNow.AddMinutes(expireMinutes);

            var token = new JwtSecurityToken(
                issuer: issuer,
                audience: audience,
                claims: claims,
                expires: expiration,
                signingCredentials: credentials);

            return new AuthResponseDto
            {
                Token = new JwtSecurityTokenHandler()
                    .WriteToken(token),

                Expiration = expiration,

                UserId = user.Id,

                FullName = user.FullName ?? string.Empty,

                Email = user.Email ?? string.Empty,

                Role = role
            };
        }
    }
}