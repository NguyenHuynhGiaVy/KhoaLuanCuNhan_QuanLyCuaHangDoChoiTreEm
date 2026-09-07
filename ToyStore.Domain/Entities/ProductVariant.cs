using System;
using System.Collections.Generic;

namespace ToyStoreManagement.Domain.Entities
{
    public class ProductVariant
    {
        public ProductVariant()
        {
            ImportReceiptDetails = new HashSet<ImportReceiptDetail>();

            InventoryTransactions = new HashSet<InventoryTransaction>();

            OrderDetails = new HashSet<OrderDetail>();

            PromotionProducts = new HashSet<PromotionProduct>();

            ProductReviews = new HashSet<ProductReview>();

            ReturnRequestDetails = new HashSet<ReturnRequestDetail>();
        }

        public int VariantId { get; set; }

        public int ProductId { get; set; }

        public string SKU { get; set; }

        public string Color { get; set; }

        public string Size { get; set; }

        public decimal Price { get; set; }

        public decimal CostPrice { get; set; }

        public decimal? Weight { get; set; }

        public string ImageUrl { get; set; }

        public int Status { get; set; }

        public DateTime CreatedAt { get; set; }

        public DateTime? UpdatedAt { get; set; }

        // Navigation
        public virtual Product Product { get; set; }

        public virtual ICollection<ImportReceiptDetail> ImportReceiptDetails { get; set; }

        public virtual Inventory Inventory { get; set; }

        public virtual ICollection<InventoryTransaction> InventoryTransactions { get; set; }

        public virtual ICollection<OrderDetail> OrderDetails { get; set; }

        public virtual ICollection<PromotionProduct> PromotionProducts { get; set; }

        public virtual ICollection<ProductReview> ProductReviews { get; set; }

        public virtual ICollection<ReturnRequestDetail> ReturnRequestDetails { get; set; }
    }
}