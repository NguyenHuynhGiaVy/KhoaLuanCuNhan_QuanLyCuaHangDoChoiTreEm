using System;

namespace ToyStoreManagement.Domain.Entities
{
    public class VoucherUsage
    {
        public long VoucherUsageId { get; set; }

        public int VoucherId { get; set; }

        public int OrderId { get; set; }

        public int? CustomerId { get; set; }

        public decimal DiscountAmount { get; set; }

        public DateTime UsedAt { get; set; }

        // Navigation
        public virtual Voucher Voucher { get; set; }

        public virtual Order Order { get; set; }

        public virtual Customer Customer { get; set; }
    }
}