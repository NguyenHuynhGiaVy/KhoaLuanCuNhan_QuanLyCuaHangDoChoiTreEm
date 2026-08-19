using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

using System.Collections.Generic;

namespace ToyStoreManagement.ViewModels
{
    public class ProductDetailViewModel
    {
        public int Id { get; set; }

        public string Name { get; set; }

        public string Brand { get; set; }

        public string Category { get; set; }

        public string Description { get; set; }

        public string MainImage { get; set; }

        public List<string> Images { get; set; }

        public decimal Price { get; set; }

        public decimal? OldPrice { get; set; }

        public double Rating { get; set; }

        public int ReviewCount { get; set; }

        public int TotalSold { get; set; }

        public int AgeFrom { get; set; }

        public int AgeTo { get; set; }

        public string Material { get; set; }

        public string Origin { get; set; }

        public List<ProductVariantViewModel> Variants { get; set; }

        public List<ProductReviewViewModel> Reviews { get; set; }

        public bool IsFeatured { get; set; }

        public bool IsNew { get; set; }
    }
}