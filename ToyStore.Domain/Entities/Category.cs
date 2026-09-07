using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System;
using System.Collections.Generic;

namespace ToyStoreManagement.Domain.Entities
{
    public class Category
    {
        public Category()
        {
            Products = new HashSet<Product>();
            PromotionConditions = new HashSet<PromotionCondition>();
        }

        public int CategoryId { get; set; }

        public string Name { get; set; }

        public string Description { get; set; }

        public bool IsActive { get; set; }

        public DateTime CreatedAt { get; set; }

        public DateTime? UpdatedAt { get; set; }

        public virtual ICollection<Product> Products { get; set; }

        public virtual ICollection<PromotionCondition> PromotionConditions { get; set; }
    }
}
