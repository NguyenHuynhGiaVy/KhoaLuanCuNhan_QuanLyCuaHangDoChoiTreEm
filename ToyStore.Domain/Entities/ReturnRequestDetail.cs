namespace ToyStoreManagement.Domain.Entities
{
    public class ReturnRequestDetail
    {
        public int ReturnRequestDetailId { get; set; }

        public int ReturnRequestId { get; set; }

        public int VariantId { get; set; }

        public int Quantity { get; set; }

        public decimal UnitPrice { get; set; }

        public decimal RefundAmount { get; set; }

        public string Reason { get; set; }

        // Navigation
        public virtual ReturnRequest ReturnRequest { get; set; }

        public virtual ProductVariant ProductVariant { get; set; }
    }
}