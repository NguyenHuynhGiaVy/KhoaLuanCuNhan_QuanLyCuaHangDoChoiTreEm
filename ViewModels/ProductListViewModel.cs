using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace ToyStoreManagement.ViewModels
{
    public class ProductListViewModel
    {
        public List<ProductViewModel> Products { get; set; }

        public List<CategoryViewModel> Categories { get; set; }

        public string SearchKeyword { get; set; }

        public int? CategoryId { get; set; }

        public decimal? MinPrice { get; set; }

        public decimal? MaxPrice { get; set; }

        public string SortBy { get; set; }

        public int CurrentPage { get; set; }

        public int PageSize { get; set; }

        public int TotalProducts { get; set; }

        public int TotalPages { get; set; }
    }
}