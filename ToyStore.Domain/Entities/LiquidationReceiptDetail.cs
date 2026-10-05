namespace ToyStoreManagement.Domain.Entities
{
    public class LiquidationReceiptDetail
    {
        public int LiquidationReceiptDetailId { get; set; }
        public int LiquidationReceiptId { get; set; }
        public int VariantId { get; set; }
        public int Quantity { get; set; }
        public virtual LiquidationReceipt LiquidationReceipt { get; set; } = null!;
        public virtual ProductVariant ProductVariant { get; set; } = null!;
    }
}
