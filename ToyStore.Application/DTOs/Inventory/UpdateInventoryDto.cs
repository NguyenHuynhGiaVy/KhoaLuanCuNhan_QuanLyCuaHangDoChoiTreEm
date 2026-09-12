using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ToyStoreManagement.Application.DTOs.Inventory
{
    public class UpdateInventoryDto
    {
        public int Quantity { get; set; }

        public int ReservedQuantity { get; set; }
    }
}
