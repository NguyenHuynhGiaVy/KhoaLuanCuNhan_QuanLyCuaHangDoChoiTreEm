using System;

namespace ToyStore.Application.DTOs.Auth
{
    public class UserDto
    {
        public string UserId { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string? PhoneNumber { get; set; }
        public bool IsActive { get; set; }
        public string Role { get; set; } = string.Empty;
    }
}
