using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ToyStoreManagement.Application.DTOs.Order
{
    public class CreateOrderDetailDto
    {
        public int VariantId { get; set; }
        public int Quantity { get; set; }
    }
}
