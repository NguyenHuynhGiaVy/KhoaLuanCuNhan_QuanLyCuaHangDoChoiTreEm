using System;
using System.Collections.Generic;

namespace ToyStoreManagement.Application.DTOs.Customer
{
    public class LoyaltySummaryDto
    {
        public int CustomerId { get; set; }

        public string CustomerName { get; set; } = string.Empty;

        public int LoyaltyPoint { get; set; }

        public List<LoyaltyRewardVoucherDto> RedeemableVouchers { get; set; }
            = new List<LoyaltyRewardVoucherDto>();

        public List<LoyaltyTransactionDto> Transactions { get; set; }
            = new List<LoyaltyTransactionDto>();
    }

    public class LoyaltyRewardVoucherDto
    {
        public int VoucherId { get; set; }

        public string Code { get; set; } = string.Empty;

        public string Name { get; set; } = string.Empty;

        public int DiscountType { get; set; }

        public decimal DiscountValue { get; set; }

        public decimal? MaximumDiscount { get; set; }

        public decimal? MinimumOrderValue { get; set; }

        public int RequiredPoints { get; set; }

        public bool IsRedeemed { get; set; }

        public DateTime EndDate { get; set; }
    }

    public class RedeemVoucherDto
    {
        public int VoucherId { get; set; }

        public string Code { get; set; } = string.Empty;

        public string Name { get; set; } = string.Empty;

        public int PointsSpent { get; set; }

        public int RemainingPoints { get; set; }
    }
}
