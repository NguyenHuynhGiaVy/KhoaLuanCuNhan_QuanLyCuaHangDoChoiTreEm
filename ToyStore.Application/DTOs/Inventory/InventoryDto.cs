using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System;

namespace ToyStoreManagement.Application.DTOs.Inventory
{
    public class InventoryDto
    {
        public int InventoryId { get; set; }

        public int VariantId { get; set; }

        public string SKU { get; set; }

        public string ProductName { get; set; }

        public int Quantity { get; set; }

        public int ReservedQuantity { get; set; }

        public int AvailableQuantity { get; set; }

        public DateTime UpdatedAt { get; set; }
    }
}