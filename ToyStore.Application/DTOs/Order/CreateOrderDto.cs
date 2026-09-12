using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ToyStoreManagement.Application.DTOs.Order
{
    public class CreateOrderDto
    {
        public int? CustomerId { get; set; }
        public string Note { get; set; }

        public List<CreateOrderDetailDto> OrderDetails { get; set; }
    }
}
