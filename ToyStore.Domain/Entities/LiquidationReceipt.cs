namespace ToyStoreManagement.Domain.Entities
{
    public class LiquidationReceipt
    {
        public LiquidationReceipt()
        {
            Details = new HashSet<LiquidationReceiptDetail>();
        }

        public int LiquidationReceiptId { get; set; }
        public string ReceiptCode { get; set; } = string.Empty;
        public string CreatedByUserId { get; set; } = string.Empty;
        public string? Note { get; set; }
        public int Status { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
        public virtual ICollection<LiquidationReceiptDetail> Details { get; set; }
    }
}
