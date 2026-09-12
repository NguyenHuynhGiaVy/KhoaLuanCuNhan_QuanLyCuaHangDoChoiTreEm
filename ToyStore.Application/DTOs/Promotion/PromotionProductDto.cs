using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ToyStoreManagement.Application.DTOs.Promotion
{
    public class PromotionProductDto
    {
        public int PromotionProductId { get; set; }

        public int PromotionId { get; set; }

        public int VariantId { get; set; }

        public string SKU { get; set; }

        public string ProductName { get; set; }
    }
}