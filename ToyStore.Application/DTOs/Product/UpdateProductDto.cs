using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ToyStoreManagement.Application.DTOs.Product
{
    public class UpdateProductDto
    {
        public int CategoryId { get; set; }

        public int BrandId { get; set; }

        public string Name { get; set; }

        public string Description { get; set; }

        public int? AgeFrom { get; set; }

        public int? AgeTo { get; set; }

        public int Status { get; set; }

        public bool IsFeatured { get; set; }

        public decimal? BasePrice { get; set; }

        public bool IsNew { get; set; }

        public string? ImageUrl { get; set; }
    }
}
