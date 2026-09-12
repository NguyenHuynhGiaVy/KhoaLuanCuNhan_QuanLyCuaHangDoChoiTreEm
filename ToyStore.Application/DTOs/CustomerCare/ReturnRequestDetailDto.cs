using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ToyStoreManagement.Application.DTOs.CustomerCare
{
    public class ReturnRequestDetailDto
    {
        public int ReturnRequestDetailId { get; set; }

        public int ReturnRequestId { get; set; }

        public int VariantId { get; set; }

        public string SKU { get; set; }

        public string ProductName { get; set; }

        public int Quantity { get; set; }

        public decimal UnitPrice { get; set; }

        public decimal RefundAmount { get; set; }

        public string Reason { get; set; }
    }
}
