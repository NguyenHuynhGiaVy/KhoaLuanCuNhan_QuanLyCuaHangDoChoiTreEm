using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ToyStoreManagement.Application.DTOs.Import
{
    public class ImportReceiptDetailDto
    {
        public int ImportReceiptDetailId { get; set; }

        public int ImportReceiptId { get; set; }

        public int VariantId { get; set; }

        public string SKU { get; set; }

        public string ProductName { get; set; }

        public int Quantity { get; set; }

        public decimal UnitCost { get; set; }

        public decimal TotalAmount { get; set; }
    }
}
