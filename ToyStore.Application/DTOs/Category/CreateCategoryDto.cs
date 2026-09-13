using System.ComponentModel.DataAnnotations;

namespace ToyStore.Application.DTOs.Category
{
    public class CreateCategoryDto
    {
        [Required(ErrorMessage = "Tên danh mục không được để trống")]
        [StringLength(100, ErrorMessage = "Tên danh mục không được quá 100 ký tự")]
        public string Name { get; set; } = string.Empty;

        public string? Description { get; set; }
    }
}
