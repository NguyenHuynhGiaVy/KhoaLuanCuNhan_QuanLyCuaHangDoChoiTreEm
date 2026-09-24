using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ToyStoreManagement.Application.DTOs.Promotion
{
    public class CreatePromotionDto
    {
        public string Name { get; set; }

        public string Description { get; set; }

        public int PromotionType { get; set; }

        public decimal DiscountValue { get; set; }

        public decimal? MaximumDiscount { get; set; }

        public DateTime StartDate { get; set; }

        public DateTime EndDate { get; set; }

        public int Priority { get; set; }

        public bool CanCombine { get; set; }

        // Mặc định chương trình mới được kích hoạt.
        public int Status { get; set; } = 1;
    }
}
