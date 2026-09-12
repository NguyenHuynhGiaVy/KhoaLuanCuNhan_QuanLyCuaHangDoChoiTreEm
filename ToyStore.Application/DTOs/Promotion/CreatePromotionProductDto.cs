using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ToyStoreManagement.Application.DTOs.Promotion
{
    public class CreatePromotionProductDto
    {
        public int PromotionId { get; set; }

        public int VariantId { get; set; }
    }
}
