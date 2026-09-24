using System;

namespace ToyStoreManagement.Domain.Entities
{
    public class LoyaltyTransaction
    {
        public long LoyaltyTransactionId { get; set; }

        public int CustomerId { get; set; }

        public int? OrderId { get; set; }

        // Có giá trị khi khách hàng dùng điểm để đổi voucher.
        public int? VoucherId { get; set; }

        public int Points { get; set; }

        public int TransactionType { get; set; }

        public string Description { get; set; }

        public DateTime CreatedAt { get; set; }

        // Navigation
        public virtual Customer Customer { get; set; }
    }
}
