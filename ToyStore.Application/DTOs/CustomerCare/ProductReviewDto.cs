using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ToyStoreManagement.Application.DTOs.CustomerCare
{
    public class ProductReviewDto
    {
        public long ProductReviewId { get; set; }

        public int ProductId { get; set; }
        public string ProductName { get; set; }

        public int VariantId { get; set; }
        public string SKU { get; set; }

        public int CustomerId { get; set; }
        public string CustomerName { get; set; }

        public int OrderId { get; set; }
        public string OrderCode { get; set; }

        public int Rating { get; set; }
        public string Comment { get; set; }

        public bool IsApproved { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }
}
