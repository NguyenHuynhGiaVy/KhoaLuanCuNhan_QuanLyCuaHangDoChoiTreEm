namespace ToyStoreManagement.Application.DTOs.Liquidation
{
    public class LiquidationReceiptDto
    {
        public int LiquidationReceiptId { get; set; }
        public string ReceiptCode { get; set; } = string.Empty;
        public string CreatedByUserId { get; set; } = string.Empty;
        public string? Note { get; set; }
        public int Status { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
        public List<LiquidationReceiptDetailDto> Details { get; set; } = new();
    }

    public class LiquidationReceiptDetailDto
    {
        public int VariantId { get; set; }
        public string SKU { get; set; } = string.Empty;
        public string ProductName { get; set; } = string.Empty;
        public int Quantity { get; set; }
    }
}
