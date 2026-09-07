using System;
using System.Collections.Generic;

namespace ToyStoreManagement.Domain.Entities
{
    public class Brand
    {
        public Brand()
        {
            Products = new HashSet<Product>();
            PromotionConditions = new HashSet<PromotionCondition>();
        }

        public int BrandId { get; set; }

        public string Name { get; set; }

        public string Description { get; set; }

        public bool IsActive { get; set; }

        public DateTime CreatedAt { get; set; }

        public DateTime? UpdatedAt { get; set; }

        // Navigation
        public virtual ICollection<Product> Products { get; set; }
        public virtual ICollection<PromotionCondition> PromotionConditions { get; set; }
    }
}