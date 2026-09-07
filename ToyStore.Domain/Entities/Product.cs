using System;
using System.Collections.Generic;

namespace ToyStoreManagement.Domain.Entities
{
    public class Product
    {
        public Product()
        {
            ProductVariants = new HashSet<ProductVariant>();
            ProductReviews = new HashSet<ProductReview>();
        }

        public int ProductId { get; set; }

        public int CategoryId { get; set; }

        public int BrandId { get; set; }

        public string Name { get; set; }

        public string Description { get; set; }

        public int? AgeFrom { get; set; }

        public int? AgeTo { get; set; }

        public int Status { get; set; }

        public bool IsFeatured { get; set; }

        public decimal ? BasePrice { get; set; }

        public bool IsNew { get; set; }

        public DateTime CreatedAt { get; set; }

        public DateTime? UpdatedAt { get; set; }

        // Navigation
        public virtual Category Category { get; set; }

        public virtual Brand Brand { get; set; }

        public virtual ICollection<ProductVariant> ProductVariants { get; set; }

        public virtual ICollection<ProductReview> ProductReviews { get; set; }
    }
}