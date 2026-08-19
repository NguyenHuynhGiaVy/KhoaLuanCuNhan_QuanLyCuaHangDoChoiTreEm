using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace ToyStoreManagement.ViewModels
{
    public class ProductReviewViewModel
    {
        public int Id { get; set; }

        public string CustomerName { get; set; }

        public int Rating { get; set; }

        public string Comment { get; set; }

        public string CreatedDate { get; set; }

        public bool IsVerifiedPurchase { get; set; }
    }
}