using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ToyStoreManagement.Application.DTOs.Product
{
    public class CreateProductVariantDto
    {
        public int ProductId { get; set; }

        public string SKU { get; set; }

        public string Color { get; set; }

        public string Size { get; set; }

        public decimal Price { get; set; }

        public decimal CostPrice { get; set; }

        public decimal? Weight { get; set; }

        public string ImageUrl { get; set; }

        public int Status { get; set; } = 1;
    }
}