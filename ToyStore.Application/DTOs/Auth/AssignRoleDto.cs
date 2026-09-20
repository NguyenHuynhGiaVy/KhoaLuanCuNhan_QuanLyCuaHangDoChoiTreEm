using System.ComponentModel.DataAnnotations;

namespace ToyStore.Application.DTOs.Auth
{
    public class AssignRoleDto
    {
        [Required(ErrorMessage = "UserId là bắt buộc.")]
        public string UserId { get; set; } = string.Empty;

        [Required(ErrorMessage = "Tên vai trò là bắt buộc.")]
        public string Role { get; set; } = string.Empty;
    }
}
