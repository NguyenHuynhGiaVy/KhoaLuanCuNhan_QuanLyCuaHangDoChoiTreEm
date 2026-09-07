using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ToyStoreManagement.Domain.Entities
{
    public class ImportReceiptDetail
    {
        public int ImportReceiptDetailId { get; set; }

        public int ImportReceiptId { get; set; }

        public int VariantId { get; set; }

        public int Quantity { get; set; }

        public decimal UnitCost { get; set; }

        public decimal TotalAmount { get; set; }

        // Navigation
        public virtual ImportReceipt ImportReceipt { get; set; }

        public virtual ProductVariant ProductVariant { get; set; }
    }
}
