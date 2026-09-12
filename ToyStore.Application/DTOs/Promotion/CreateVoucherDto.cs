using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;


namespace ToyStoreManagement.Application.DTOs.Promotion
{
    public class CreateVoucherDto
    {
        public string Code { get; set; }

        public string Name { get; set; }

        public int DiscountType { get; set; }

        public decimal DiscountValue { get; set; }

        public decimal? MaximumDiscount { get; set; }

        public decimal? MinimumOrderValue { get; set; }

        public int UsageLimit { get; set; }

        public int? UsageLimitPerCustomer { get; set; }

        public DateTime StartDate { get; set; }

        public DateTime EndDate { get; set; }

        public int Status { get; set; }
    }
}
