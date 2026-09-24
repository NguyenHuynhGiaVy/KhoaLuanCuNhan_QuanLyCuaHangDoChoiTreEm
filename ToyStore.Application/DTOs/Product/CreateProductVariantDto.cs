using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace ToyStoreManagement.Application.DTOs.Product
{
    public class CreateProductVariantDto
    {
        [Required(ErrorMessage = "SKU không được để trống")]
        public string SKU { get; set; } = string.Empty;

        [Range(0, double.MaxValue, ErrorMessage = "Giá bán không được là số âm")]
        public decimal? Price { get; set; }

        [Range(0, double.MaxValue, ErrorMessage = "Giá vốn không được là số âm")]
        public decimal? CostPrice { get; set; }

        public decimal? Weight { get; set; }

        public string? ImageUrl { get; set; }

        public int Status { get; set; } = 1;

        public List<CreateProductVariantAttributeDto> Attributes { get; set; }
            = new List<CreateProductVariantAttributeDto>();
    }
}
