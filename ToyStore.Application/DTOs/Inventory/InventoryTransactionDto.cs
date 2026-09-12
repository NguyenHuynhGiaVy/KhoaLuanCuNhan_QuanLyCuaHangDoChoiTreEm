using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System;

namespace ToyStoreManagement.Application.DTOs.Inventory
{
    public class InventoryTransactionDto
    {
        public int Id { get; set; }

        public long TransactionId { get; set; }

        public int VariantId { get; set; }

        public string SKU { get; set; }

        public string ProductName { get; set; }

        public int TransactionType { get; set; }

        public int Quantity { get; set; }

        public string ReferenceType { get; set; }

        public int? ReferenceId { get; set; }

        public DateTime CreatedAt { get; set; }

        public string Note { get; set; }
    }
}
