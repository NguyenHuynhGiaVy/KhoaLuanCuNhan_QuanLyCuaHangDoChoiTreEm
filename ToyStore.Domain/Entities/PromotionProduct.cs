namespace ToyStoreManagement.Domain.Entities
{
    public class PromotionProduct
    {
        public int PromotionProductId { get; set; }

        public int PromotionId { get; set; }

        public int VariantId { get; set; }

        // Navigation
        public virtual Promotion Promotion { get; set; }

        public virtual ProductVariant ProductVariant { get; set; }
    }
}