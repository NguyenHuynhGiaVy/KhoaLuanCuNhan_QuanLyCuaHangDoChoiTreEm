using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ToyStoreManagement.Application.DTOs.Import
{
    public class CreateImportReceiptDetailDto
    {
        public int VariantId { get; set; }

        public int Quantity { get; set; }

        public decimal UnitCost { get; set; }
    }
}
