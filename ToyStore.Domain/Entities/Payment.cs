using System;

namespace ToyStoreManagement.Domain.Entities
{
    public class Payment
    {
        public int PaymentId { get; set; }

        public int OrderId { get; set; }

        public int PaymentMethod { get; set; }

        public string TransactionCode { get; set; }

        public decimal Amount { get; set; }

        public int Status { get; set; }

        public DateTime? PaidAt { get; set; }

        public DateTime CreatedAt { get; set; }

        // Navigation
        public virtual Order Order { get; set; }
    }
}