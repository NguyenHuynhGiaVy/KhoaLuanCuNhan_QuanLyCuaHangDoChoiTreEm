using System;
using System.Collections.Generic;
using ToyStore.Domain.Identity;
using ToyStoreManagement.Domain.Identity;

namespace ToyStoreManagement.Domain.Entities
{
    public class Customer
    {
        public Customer()
        {
            LoyaltyTransactions = new HashSet<LoyaltyTransaction>();
            Orders = new HashSet<Order>();
            VoucherUsages = new HashSet<VoucherUsage>();
            ProductReviews = new HashSet<ProductReview>();

            CustomerFeedbacks = new HashSet<CustomerFeedback>();

            ReturnRequests = new HashSet<ReturnRequest>();
        }

        public int CustomerId { get; set; }

        public string FullName { get; set; }

        public string Phone { get; set; }

        public string Email { get; set; }

        public string UserId { get; set; }

        public DateTime? DateOfBirth { get; set; }

        public int? Gender { get; set; }

        public string Address { get; set; }

        public int LoyaltyPoint { get; set; }

        public int Status { get; set; }

        public DateTime CreatedAt { get; set; }

        public DateTime? UpdatedAt { get; set; }

        // Navigation
        public virtual ICollection<LoyaltyTransaction> LoyaltyTransactions { get; set; }

        public virtual ICollection<Order> Orders { get; set; }

        public virtual ICollection<VoucherUsage> VoucherUsages { get; set; }

        public virtual ICollection<ProductReview> ProductReviews { get; set; }

        public virtual ICollection<CustomerFeedback> CustomerFeedbacks { get; set; }

        public virtual ICollection<ReturnRequest> ReturnRequests { get; set; }

        public virtual ApplicationUser User { get; set; }
    }
}