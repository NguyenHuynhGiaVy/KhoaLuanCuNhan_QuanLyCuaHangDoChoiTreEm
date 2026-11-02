using System.Collections.Generic;

namespace ToyStoreManagement.Application.DTOs.Import
{
    public class ReceiveImportReceiptDto
    {
        public List<ReceiveImportReceiptDetailDto> Details { get; set; }
            = new List<ReceiveImportReceiptDetailDto>();
    }

    public class ReceiveImportReceiptDetailDto
    {
        public int ImportReceiptDetailId { get; set; }
        public int VariantId { get; set; }

        public int Quantity { get; set; }
        public int ReceivedQuantity
        {
            get => Quantity;
            set { if (Quantity == 0 && value > 0) Quantity = value; }
        }

        public decimal? NewPrice { get; set; }
    }
}