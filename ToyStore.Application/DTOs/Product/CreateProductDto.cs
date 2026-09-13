using System.ComponentModel.DataAnnotations;

namespace ToyStoreManagement.Application.DTOs.Product
{
    public class CreateProductDto
    {
        [Required(ErrorMessage = "Vui lòng chọn danh mục")]
        public int CategoryId { get; set; }

        [Required(ErrorMessage = "Vui lòng chọn thương hiệu")]
        public int BrandId { get; set; }

        public int? SupplierId { get; set; }

        [Required(ErrorMessage = "Tên sản phẩm không được để trống")]
        [StringLength(200, ErrorMessage = "Tên sản phẩm không được quá 200 ký tự")]
        public string Name { get; set; } = string.Empty;

        [Required(ErrorMessage = "Mô tả sản phẩm không được để trống")]
        public string Description { get; set; } = string.Empty;

        public int? AgeFrom { get; set; }

        public int? AgeTo { get; set; }

        public int? Gender { get; set; }

        public int Status { get; set; } = 1;

        public bool IsFeatured { get; set; }

        [Required(ErrorMessage = "Giá bán không được để trống")]
        [Range(0, double.MaxValue, ErrorMessage = "Giá bán không được là số âm")]
        public decimal? BasePrice { get; set; }

        public bool IsNew { get; set; } = true;

        public string? ImageUrl { get; set; }
    }
}
