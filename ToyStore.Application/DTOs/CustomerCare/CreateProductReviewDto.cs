using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ToyStoreManagement.Application.DTOs.CustomerCare
{
    public class CreateProductReviewDto
    {
        public int ProductId { get; set; }

        public int VariantId { get; set; }

        public int CustomerId { get; set; }

        public int OrderId { get; set; }

        public int Rating { get; set; }

        public string Comment { get; set; }
    }
}
