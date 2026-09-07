using System;

namespace ToyStoreManagement.Domain.Entities
{
    public class ProductReview
    {
        public long ProductReviewId { get; set; }

        public int ProductId { get; set; }

        public int VariantId { get; set; }

        public int CustomerId { get; set; }

        public int OrderId { get; set; }

        public int Rating { get; set; }

        public string Comment { get; set; }

        public bool IsApproved { get; set; }

        public DateTime CreatedAt { get; set; }

        public DateTime? UpdatedAt { get; set; }

        // Navigation
        public virtual Product Product { get; set; }

        public virtual ProductVariant ProductVariant { get; set; }

        public virtual Customer Customer { get; set; }

        public virtual Order Order { get; set; }
    }
}