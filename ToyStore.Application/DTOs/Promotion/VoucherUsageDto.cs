using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ToyStoreManagement.Application.DTOs.Promotion
{
    public class VoucherUsageDto
    {
        public long VoucherUsageId { get; set; }

        public int VoucherId { get; set; }

        public int OrderId { get; set; }

        public int? CustomerId { get; set; }

        public decimal DiscountAmount { get; set; }

        public DateTime UsedAt { get; set; }
    }
}