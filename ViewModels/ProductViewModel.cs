using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace ToyStoreManagement.ViewModels
{
    public class ProductViewModel
    {
        public int Id { get; set; }

        public string Name { get; set; }

        public decimal Price { get; set; }

        public decimal? OldPrice { get; set; }

        public string ImageUrl { get; set; }

        public double Rating { get; set; }

        public int ReviewCount { get; set; }

        public bool IsNew { get; set; }

        public bool IsFeatured { get; set; }
    }
}