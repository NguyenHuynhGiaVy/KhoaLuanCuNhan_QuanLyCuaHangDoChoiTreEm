using System;
using System.Collections.Generic;

namespace ToyStoreManagement.Domain.Entities
{
    public class Promotion
    {
        public Promotion()
        {
            PromotionConditions = new HashSet<PromotionCondition>();
            PromotionProducts = new HashSet<PromotionProduct>();
        }

        public int PromotionId { get; set; }

        public string Name { get; set; }

        public string Description { get; set; }

        public int PromotionType { get; set; }

        public decimal DiscountValue { get; set; }

        public decimal? MaximumDiscount { get; set; }

        public DateTime StartDate { get; set; }

        public DateTime EndDate { get; set; }

        public int Priority { get; set; }

        public bool CanCombine { get; set; }

        public int Status { get; set; }

        public DateTime CreatedAt { get; set; }

        public DateTime? UpdatedAt { get; set; }

        // Navigation
        public virtual ICollection<PromotionCondition> PromotionConditions { get; set; }

        public virtual ICollection<PromotionProduct> PromotionProducts { get; set; }
    }
}