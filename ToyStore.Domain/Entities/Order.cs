using System;
using System.Collections.Generic;

namespace ToyStoreManagement.Domain.Entities
{
    public class Order
    {
        public Order()
        {
            OrderDetails = new HashSet<OrderDetail>();

            VoucherUsages = new HashSet<VoucherUsage>();

            ProductReviews = new HashSet<ProductReview>();

            ReturnRequests = new HashSet<ReturnRequest>();

            CustomerFeedbacks = new HashSet<CustomerFeedback>();
        }

        public int OrderId { get; set; }

        public int? CustomerId { get; set; }

        public string OrderCode { get; set; }

        public DateTime OrderDate { get; set; }

        public int Status { get; set; }

        public decimal Subtotal { get; set; }

        public decimal DiscountAmount { get; set; }

        public decimal ShippingFee { get; set; }

        public decimal TotalAmount { get; set; }

        public string Note { get; set; }

        public DateTime CreatedAt { get; set; }

        public DateTime? UpdatedAt { get; set; }

        // Navigation
        public virtual Customer Customer { get; set; }

        public virtual ICollection<OrderDetail> OrderDetails { get; set; }

        public virtual Payment Payment { get; set; }

        public virtual Shipping Shipping { get; set; }

        public virtual ICollection<VoucherUsage> VoucherUsages { get; set; }

        public virtual ICollection<ProductReview> ProductReviews { get; set; }

        public virtual ICollection<ReturnRequest> ReturnRequests { get; set; }

        public virtual ICollection<CustomerFeedback> CustomerFeedbacks { get; set; }
    }
}