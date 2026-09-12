using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ToyStoreManagement.Application.DTOs.CustomerCare
{
    public class CreateReturnRequestDetailDto
    {
        public int VariantId { get; set; }

        public int Quantity { get; set; }

        public decimal UnitPrice { get; set; }

        public decimal RefundAmount { get; set; }

        public string Reason { get; set; }
    }
}
