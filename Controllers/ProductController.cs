using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using ToyStoreManagement.ViewModels;

namespace ToyStoreManagement.Controllers
{
    public class ProductController : Controller
    {
        public ActionResult Index(
            string search,
            int? categoryId,
            decimal? minPrice,
            decimal? maxPrice,
            string sortBy,
            int page = 1)
        {
            var products = GetProducts();

            // Search
            if (!string.IsNullOrWhiteSpace(search))
            {
                products = products
                    .Where(x => x.Name
                    .ToLower()
                    .Contains(search.ToLower()))
                    .ToList();
            }

            // Category
            if (categoryId.HasValue)
            {
                products = products
                    .Where(x => x.Id == categoryId.Value)
                    .ToList();
            }

            // Price
            if (minPrice.HasValue)
            {
                products = products
                    .Where(x => x.Price >= minPrice.Value)
                    .ToList();
            }

            if (maxPrice.HasValue)
            {
                products = products
                    .Where(x => x.Price <= maxPrice.Value)
                    .ToList();
            }

            // Sort
            switch (sortBy)
            {
                case "price-asc":
                    products = products
                        .OrderBy(x => x.Price)
                        .ToList();
                    break;

                case "price-desc":
                    products = products
                        .OrderByDescending(x => x.Price)
                        .ToList();
                    break;

                case "newest":
                    products = products
                        .Where(x => x.IsNew)
                        .ToList();
                    break;

                default:
                    products = products
                        .OrderByDescending(x => x.Rating)
                        .ToList();
                    break;
            }

            var categories = GetCategories();

            var pageSize = 8;

            var totalProducts = products.Count;

            var totalPages = (int)System.Math.Ceiling(
                (double)totalProducts / pageSize
            );

            var pagedProducts = products
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToList();

            var model = new ProductListViewModel
            {
                Products = pagedProducts,
                Categories = categories,
                SearchKeyword = search,
                CategoryId = categoryId,
                MinPrice = minPrice,
                MaxPrice = maxPrice,
                SortBy = sortBy,
                CurrentPage = page,
                PageSize = pageSize,
                TotalProducts = totalProducts,
                TotalPages = totalPages
            };

            return View(model);
        }

        public ActionResult Details(int id)
        {
            var product = GetProductDetail(id);

            if (product == null)
            {
                return HttpNotFound();
            }

            return View(product);
        }
        private List<ProductViewModel> GetProducts()
        {
            return new List<ProductViewModel>
    {
        new ProductViewModel
        {
            Id = 1,
            Name = "LEGO City Fire Station",
            Price = 1299000,
            OldPrice = 1499000,
            ImageUrl = "https://placehold.co/500x500",
            Rating = 4.8,
            ReviewCount = 125,
            IsFeatured = true
        },

        new ProductViewModel
        {
            Id = 2,
            Name = "Gấu Bông Capybara",
            Price = 299000,
            OldPrice = 349000,
            ImageUrl = "https://placehold.co/500x500",
            Rating = 4.9,
            ReviewCount = 86
        },

        new ProductViewModel
        {
            Id = 3,
            Name = "Hot Wheels Racing",
            Price = 199000,
            ImageUrl = "https://placehold.co/500x500",
            Rating = 4.7,
            ReviewCount = 54
        },

        new ProductViewModel
        {
            Id = 4,
            Name = "Puzzle Khám Phá Vũ Trụ",
            Price = 159000,
            OldPrice = 189000,
            ImageUrl = "https://placehold.co/500x500",
            Rating = 4.6,
            ReviewCount = 42
        },

        new ProductViewModel
        {
            Id = 5,
            Name = "LEGO Technic Super Car",
            Price = 2199000,
            ImageUrl = "https://placehold.co/500x500",
            Rating = 5.0,
            ReviewCount = 12,
            IsNew = true
        },

        new ProductViewModel
        {
            Id = 6,
            Name = "Bộ Đồ Chơi Nấu Ăn Mini",
            Price = 399000,
            ImageUrl = "https://placehold.co/500x500",
            Rating = 4.8,
            ReviewCount = 8,
            IsNew = true
        },

        new ProductViewModel
        {
            Id = 7,
            Name = "Robot Điều Khiển",
            Price = 599000,
            ImageUrl = "https://placehold.co/500x500",
            Rating = 4.9,
            ReviewCount = 15,
            IsNew = true
        },

        new ProductViewModel
        {
            Id = 8,
            Name = "Bộ Tranh Ghép Sáng Tạo",
            Price = 259000,
            ImageUrl = "https://placehold.co/500x500",
            Rating = 4.7,
            ReviewCount = 10
        },

        new ProductViewModel
        {
            Id = 9,
            Name = "Xe Đua Điều Khiển",
            Price = 799000,
            ImageUrl = "https://placehold.co/500x500",
            Rating = 4.5,
            ReviewCount = 34
        },

        new ProductViewModel
        {
            Id = 10,
            Name = "Bộ Xếp Hình Nam Châm",
            Price = 449000,
            ImageUrl = "https://placehold.co/500x500",
            Rating = 4.8,
            ReviewCount = 27
        }
    };
        }

        private List<CategoryViewModel> GetCategories()
        {
            return new List<CategoryViewModel>
    {
        new CategoryViewModel
        {
            Id = 1,
            Name = "LEGO",
            ProductCount = "120 sản phẩm"
        },

        new CategoryViewModel
        {
            Id = 2,
            Name = "Gấu bông",
            ProductCount = "85 sản phẩm"
        },

        new CategoryViewModel
        {
            Id = 3,
            Name = "Xe đồ chơi",
            ProductCount = "96 sản phẩm"
        },

        new CategoryViewModel
        {
            Id = 4,
            Name = "Puzzle",
            ProductCount = "65 sản phẩm"
        },

        new CategoryViewModel
        {
            Id = 5,
            Name = "Đồ chơi sáng tạo",
            ProductCount = "72 sản phẩm"
        }
    };
        }

        private ProductDetailViewModel GetProductDetail(int id)
        {
            var products = new List<ProductDetailViewModel>
    {
        new ProductDetailViewModel
        {
            Id = 1,
            Name = "LEGO City Fire Station",
            Brand = "LEGO",
            Category = "LEGO",

            Description =
                "Bộ đồ chơi LEGO City Fire Station " +
                "giúp bé thỏa sức sáng tạo và khám phá " +
                "thế giới cứu hỏa.",

            MainImage = "https://placehold.co/700x700",

            Images = new List<string>
            {
                "https://placehold.co/700x700",
                "https://placehold.co/700x700",
                "https://placehold.co/700x700",
                "https://placehold.co/700x700"
            },

            Price = 1299000,
            OldPrice = 1499000,

            Rating = 4.8,
            ReviewCount = 125,
            TotalSold = 350,

            AgeFrom = 6,
            AgeTo = 12,

            Material = "Nhựa ABS",
            Origin = "Đan Mạch",

            IsFeatured = true,
            IsNew = false,

            Variants = new List<ProductVariantViewModel>
            {
                new ProductVariantViewModel
                {
                    Id = 1,
                    SKU = "LEGO-FIRE-RED",
                    Color = "Đỏ",
                    Size = "Tiêu chuẩn",
                    Price = 1299000,
                    OldPrice = 1499000,
                    Stock = 25,
                    ImageUrl = "https://placehold.co/700x700"
                },

                new ProductVariantViewModel
                {
                    Id = 2,
                    SKU = "LEGO-FIRE-BLUE",
                    Color = "Xanh",
                    Size = "Tiêu chuẩn",
                    Price = 1299000,
                    OldPrice = 1499000,
                    Stock = 18,
                    ImageUrl = "https://placehold.co/700x700"
                },

                new ProductVariantViewModel
                {
                    Id = 3,
                    SKU = "LEGO-FIRE-YELLOW",
                    Color = "Vàng",
                    Size = "Tiêu chuẩn",
                    Price = 1399000,
                    OldPrice = 1599000,
                    Stock = 7,
                    ImageUrl = "https://placehold.co/700x700"
                }
            },

            Reviews = new List<ProductReviewViewModel>
            {
                new ProductReviewViewModel
                {
                    Id = 1,
                    CustomerName = "Nguyễn Minh Anh",
                    Rating = 5,
                    Comment = "Sản phẩm đẹp, bé nhà mình rất thích.",
                    CreatedDate = "12/08/2026",
                    IsVerifiedPurchase = true
                },

                new ProductReviewViewModel
                {
                    Id = 2,
                    CustomerName = "Trần Hoàng Nam",
                    Rating = 5,
                    Comment = "Đóng gói cẩn thận, giao hàng nhanh.",
                    CreatedDate = "09/08/2026",
                    IsVerifiedPurchase = true
                },

                new ProductReviewViewModel
                {
                    Id = 3,
                    CustomerName = "Lê Ngọc Hà",
                    Rating = 4,
                    Comment = "Sản phẩm khá tốt, đúng mô tả.",
                    CreatedDate = "05/08/2026",
                    IsVerifiedPurchase = false
                }
            }
        }
    };

            return products.FirstOrDefault(x => x.Id == id);
        }
    }
}