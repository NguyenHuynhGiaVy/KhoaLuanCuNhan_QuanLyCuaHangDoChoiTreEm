namespace ToyStoreManagement.Domain.Entities
{
    public class PromotionCondition
    {
        public int PromotionConditionId { get; set; }

        public int PromotionId { get; set; }

        public int ConditionType { get; set; }

        public decimal? MinimumOrderValue { get; set; }

        public int? MinimumQuantity { get; set; }

        public int? CategoryId { get; set; }

        public int? BrandId { get; set; }

        public int? CustomerLevel { get; set; }

        public string Description { get; set; }

        // Navigation
        public virtual Promotion Promotion { get; set; }

        public virtual Category Category { get; set; }

        public virtual Brand Brand { get; set; }
    }
}