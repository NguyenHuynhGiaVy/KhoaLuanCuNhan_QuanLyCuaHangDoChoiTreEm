namespace ToyStoreManagement.Application.DTOs.Liquidation
{
    public class CreateLiquidationReceiptDto
    {
        public string? Note { get; set; }
        public List<CreateLiquidationReceiptDetailDto> Details { get; set; } = new();
    }

    public class CreateLiquidationReceiptDetailDto
    {
        public int VariantId { get; set; }
        public int Quantity { get; set; }
    }
}
