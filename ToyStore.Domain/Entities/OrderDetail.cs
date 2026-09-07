namespace ToyStoreManagement.Domain.Entities
{
    public class OrderDetail
    {
        public int OrderDetailId { get; set; }

        public int OrderId { get; set; }

        public int VariantId { get; set; }

        public int Quantity { get; set; }

        public decimal UnitPrice { get; set; }

        public decimal DiscountAmount { get; set; }

        public decimal TotalAmount { get; set; }

        // Navigation
        public virtual Order Order { get; set; }

        public virtual ProductVariant ProductVariant { get; set; }
    }
}