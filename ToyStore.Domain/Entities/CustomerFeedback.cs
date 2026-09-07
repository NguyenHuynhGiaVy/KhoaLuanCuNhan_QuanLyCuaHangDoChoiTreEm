using System;

namespace ToyStoreManagement.Domain.Entities
{
    public class CustomerFeedback
    {
        public long CustomerFeedbackId { get; set; }

        public int CustomerId { get; set; }

        public int? OrderId { get; set; }

        public string Subject { get; set; }

        public string Content { get; set; }

        public int FeedbackType { get; set; }

        public int Status { get; set; }

        public string Response { get; set; }

        public DateTime CreatedAt { get; set; }

        public DateTime? RespondedAt { get; set; }

        // Navigation
        public virtual Customer Customer { get; set; }

        public virtual Order Order { get; set; }
    }
}