using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ToyStoreManagement.Application.DTOs.Promotion
{
    public class CreatePromotionConditionDto
    {
        public int PromotionId { get; set; }

        public int ConditionType { get; set; }

        public decimal? MinimumOrderValue { get; set; }

        public int? MinimumQuantity { get; set; }

        public int? CategoryId { get; set; }

        public int? BrandId { get; set; }

        public int? CustomerLevel { get; set; }

        public string Description { get; set; }
    }
}
