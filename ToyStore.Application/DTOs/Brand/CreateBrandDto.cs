using System.ComponentModel.DataAnnotations;

namespace ToyStore.Application.DTOs.Brand
{
    public class CreateBrandDto
    {
        [Required(ErrorMessage = "Tên thương hiệu không được để trống")]
        [StringLength(100, ErrorMessage = "Tên thương hiệu không được quá 100 ký tự")]
        public string Name { get; set; } = string.Empty;

        public string? Description { get; set; }
    }
}
