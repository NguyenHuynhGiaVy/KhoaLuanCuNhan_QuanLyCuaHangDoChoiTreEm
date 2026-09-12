using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStoreManagement.Application.DTOs.Product;

namespace ToyStoreManagement.Application.DTOs.Product
{
    public class ProductDto
    {
        public int ProductId { get; set; }

        public int CategoryId { get; set; }

        public string? CategoryName { get; set; }

        public int BrandId { get; set; }

        public string? BrandName { get; set; }

        public string Name { get; set; }

        public string Description { get; set; }

        public int? AgeFrom { get; set; }

        public int? AgeTo { get; set; }

        public int Status { get; set; }

        public bool IsFeatured { get; set; }

        public decimal? BasePrice { get; set; }

        public bool IsNew { get; set; }

        public string? ImageUrl { get; set; }

        public DateTime CreatedAt { get; set; }

        public DateTime? UpdatedAt { get; set; }

        public List<ProductVariantDto> ProductVariants { get; set; }
            = new List<ProductVariantDto>();
    }
}