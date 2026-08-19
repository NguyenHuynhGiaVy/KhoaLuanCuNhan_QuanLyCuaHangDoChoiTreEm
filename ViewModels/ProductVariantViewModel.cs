using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace ToyStoreManagement.ViewModels
{
    public class ProductVariantViewModel
    {
        public int Id { get; set; }

        public string SKU { get; set; }

        public string Color { get; set; }

        public string Size { get; set; }

        public decimal Price { get; set; }

        public decimal? OldPrice { get; set; }

        public int Stock { get; set; }

        public string ImageUrl { get; set; }

        public bool IsAvailable
        {
            get
            {
                return Stock > 0;
            }
        }
    }
}