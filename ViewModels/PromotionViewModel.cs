using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace ToyStoreManagement.ViewModels
{
    public class PromotionViewModel
    {
        public int Id { get; set; }

        public string Title { get; set; }

        public string Description { get; set; }

        public string ImageUrl { get; set; }

        public string ButtonText { get; set; }

        public string ButtonUrl { get; set; }
    }
}