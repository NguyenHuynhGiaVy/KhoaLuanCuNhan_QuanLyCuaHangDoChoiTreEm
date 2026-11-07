namespace ToyStoreManagement.Domain.Entities
{
    public class PromotionProduct
    {
        public int PromotionProductId { get; set; }

        public int PromotionId { get; set; }

        public int? VariantId { get; set; }

        public int? ProductId { get; set; }

        public int? DiscountType { get; set; }

        public decimal? DiscountValue { get; set; }

        public decimal? MaximumDiscount { get; set; }

        // Navigation
        public virtual Promotion Promotion { get; set; }

        public virtual ProductVariant? ProductVariant { get; set; }

        public virtual Product? Product { get; set; }
    }
}