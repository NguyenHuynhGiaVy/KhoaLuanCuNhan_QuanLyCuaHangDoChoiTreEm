using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;

using ToyStoreManagement.ViewModels;

namespace ToyStoreManagement.Controllers
{
    public class HomeController : Controller
    {
        public ActionResult Index()
        {
            var model = new HomeViewModel
            {
                Categories = GetCategories(),
                FeaturedProducts = GetFeaturedProducts(),
                NewProducts = GetNewProducts(),
                Promotions = GetPromotions()
            };

            return View(model);
        }

        private List<CategoryViewModel> GetCategories()
        {
            return new List<CategoryViewModel>
            {
                new CategoryViewModel
                {
                    Id = 1,
                    Name = "LEGO",
                    ImageUrl = "https://placehold.co/300x300",
                    ProductCount = "120 sản phẩm"
                },

                new CategoryViewModel
                {
                    Id = 2,
                    Name = "Gấu bông",
                    ImageUrl = "https://placehold.co/300x300",
                    ProductCount = "85 sản phẩm"
                },

                new CategoryViewModel
                {
                    Id = 3,
                    Name = "Xe đồ chơi",
                    ImageUrl = "https://placehold.co/300x300",
                    ProductCount = "96 sản phẩm"
                },

                new CategoryViewModel
                {
                    Id = 4,
                    Name = "Puzzle",
                    ImageUrl = "https://placehold.co/300x300",
                    ProductCount = "65 sản phẩm"
                }
            };
        }

        private List<ProductViewModel> GetFeaturedProducts()
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
            ReviewCount = 86,
            IsFeatured = true
        },

        new ProductViewModel
        {
            Id = 3,
            Name = "Hot Wheels Racing",
            Price = 199000,
            OldPrice = null,
            ImageUrl = "https://placehold.co/500x500",
            Rating = 4.7,
            ReviewCount = 54,
            IsFeatured = true
        },

        new ProductViewModel
        {
            Id = 4,
            Name = "Puzzle Khám Phá Vũ Trụ",
            Price = 159000,
            OldPrice = 189000,
            ImageUrl = "https://placehold.co/500x500",
            Rating = 4.6,
            ReviewCount = 42,
            IsFeatured = true
        }
    };
        }

        private List<ProductViewModel> GetNewProducts()
        {
            return new List<ProductViewModel>
    {
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
            ReviewCount = 10,
            IsNew = true
        }
    };
        }

        private List<PromotionViewModel> GetPromotions()
        {
            return new List<PromotionViewModel>
    {
        new PromotionViewModel
        {
            Id = 1,
            Title = "Ưu đãi mùa hè",
            Description = "Giảm đến 30% cho nhiều sản phẩm đồ chơi",
            ImageUrl = "https://placehold.co/800x400",
            ButtonText = "Mua ngay",
            ButtonUrl = "#"
        },

        new PromotionViewModel
        {
            Id = 2,
            Title = "Voucher thành viên",
            Description = "Nhận voucher 100.000đ cho đơn hàng tiếp theo",
            ImageUrl = "https://placehold.co/800x400",
            ButtonText = "Xem voucher",
            ButtonUrl = "#"
        }
    };
        }
    }
}