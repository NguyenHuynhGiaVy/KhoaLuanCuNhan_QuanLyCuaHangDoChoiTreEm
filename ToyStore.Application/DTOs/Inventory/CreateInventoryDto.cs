using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ToyStoreManagement.Application.DTOs.Inventory
{
    public class CreateInventoryDto
    {
        public int VariantId { get; set; }

        public int Quantity { get; set; }

        public int ReservedQuantity { get; set; }
    }
}