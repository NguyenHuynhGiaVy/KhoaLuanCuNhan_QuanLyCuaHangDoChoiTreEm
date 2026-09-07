using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ToyStoreManagement.Domain.Entities
{
    public class InventoryTransaction
    {
        public int Id { get; set; }
        
        public long TransactionId { get; set; }

        public int VariantId { get; set; }

        public int TransactionType { get; set; }

        public int Quantity { get; set; }

        public string ReferenceType { get; set; }

        public int? ReferenceId { get; set; }

        public DateTime CreatedAt { get; set; }

        public string Note { get; set; }

        // Navigation
        public virtual ProductVariant ProductVariant { get; set; }
    }
}
