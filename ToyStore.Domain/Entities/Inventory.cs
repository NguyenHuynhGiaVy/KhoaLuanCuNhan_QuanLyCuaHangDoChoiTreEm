using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ToyStoreManagement.Domain.Entities
{
    public class Inventory
    {
        public int InventoryId { get; set; }

        public int VariantId { get; set; }

        public int Quantity { get; set; }

        public int ReservedQuantity { get; set; }

        public DateTime UpdatedAt { get; set; }

        // Navigation
        public virtual ProductVariant ProductVariant { get; set; }
    }
}
