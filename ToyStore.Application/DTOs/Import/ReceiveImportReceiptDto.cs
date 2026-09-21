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

        public int Quantity { get; set; }
    }
}