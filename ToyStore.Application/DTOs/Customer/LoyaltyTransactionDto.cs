using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ToyStoreManagement.Application.DTOs.Customer
{
    public class LoyaltyTransactionDto
    {
        public long LoyaltyTransactionId { get; set; }

        public int CustomerId { get; set; }

        public int? OrderId { get; set; }

        public int Points { get; set; }

        public int TransactionType { get; set; }

        public string Description { get; set; }

        public DateTime CreatedAt { get; set; }
    }
}
