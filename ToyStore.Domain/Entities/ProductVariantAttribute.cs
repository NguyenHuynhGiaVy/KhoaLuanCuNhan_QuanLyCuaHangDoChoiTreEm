using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;


namespace ToyStoreManagement.Domain.Entities
{
    public class ProductVariantAttribute
    {
        public int VariantAttributeId { get; set; }

        public int VariantId { get; set; }

        public string AttributeName { get; set; }

        public string AttributeValue { get; set; }

        public int DisplayOrder { get; set; }

        // Navigation
        public virtual ProductVariant ProductVariant { get; set; }
    }
}
