using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace ToyStoreManagement.ViewModels
{
    public class HomeViewModel
    {
        public List<ProductViewModel> FeaturedProducts { get; set; }

        public List<ProductViewModel> NewProducts { get; set; }

        public List<CategoryViewModel> Categories { get; set; }

        public List<PromotionViewModel> Promotions { get; set; }
    }
}