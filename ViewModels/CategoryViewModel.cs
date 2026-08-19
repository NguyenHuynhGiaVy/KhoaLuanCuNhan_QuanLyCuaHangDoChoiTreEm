using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace ToyStoreManagement.ViewModels
{
    public class CategoryViewModel
    {
        public int Id { get; set; }

        public string Name { get; set; }

        public string ImageUrl { get; set; }

        public string ProductCount { get; set; }
    }
}