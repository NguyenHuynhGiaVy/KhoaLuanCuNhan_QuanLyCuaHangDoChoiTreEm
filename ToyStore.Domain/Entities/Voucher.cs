using System;
using System.Collections.Generic;

namespace ToyStoreManagement.Domain.Entities
{
    public class Voucher
    {
        public Voucher()
        {
            VoucherUsages = new HashSet<VoucherUsage>();
        }

        public int VoucherId { get; set; }

        public string Code { get; set; }

        public string Name { get; set; }

        public int DiscountType { get; set; }

        public decimal DiscountValue { get; set; }

        public decimal? MaximumDiscount { get; set; }

        public decimal? MinimumOrderValue { get; set; }

        public int UsageLimit { get; set; }

        public int UsedCount { get; set; }

        public int? UsageLimitPerCustomer { get; set; }

        public DateTime StartDate { get; set; }

        public DateTime EndDate { get; set; }

        public int Status { get; set; }

        public DateTime CreatedAt { get; set; }

        public DateTime? UpdatedAt { get; set; }

        // Navigation
        public virtual ICollection<VoucherUsage> VoucherUsages { get; set; }
    }
}