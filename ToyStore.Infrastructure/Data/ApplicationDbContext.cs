using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using ToyStoreManagement.Domain.Entities;
using ToyStoreManagement.Domain.Identity;
using ToyStore.Domain.Identity;

namespace ToyStoreManagement.Infrastructure.Data
{
    public class ApplicationDbContext : IdentityDbContext<ApplicationUser, ApplicationRole, string>
    {
        public ApplicationDbContext(
            DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        public DbSet<Category> Categories { get; set; }

        public DbSet<Brand> Brands { get; set; }

        public DbSet<Product> Products { get; set; }

        public DbSet<ProductVariant> ProductVariants { get; set; }

        public DbSet<Supplier> Suppliers { get; set; }

        public DbSet<ImportReceipt> ImportReceipts { get; set; }

        public DbSet<ImportReceiptDetail> ImportReceiptDetails { get; set; }

        public DbSet<Inventory> Inventories { get; set; }

        public DbSet<InventoryTransaction> InventoryTransactions { get; set; }

        public DbSet<Customer> Customers { get; set; }

        public DbSet<LoyaltyTransaction> LoyaltyTransactions { get; set; }

        public DbSet<Order> Orders { get; set; }

        public DbSet<OrderDetail> OrderDetails { get; set; }

        public DbSet<Payment> Payments { get; set; }

        public DbSet<Shipping> Shippings { get; set; }

        public DbSet<Promotion> Promotions { get; set; }

        public DbSet<PromotionCondition> PromotionConditions { get; set; }

        public DbSet<PromotionProduct> PromotionProducts { get; set; }

        public DbSet<Voucher> Vouchers { get; set; }

        public DbSet<VoucherUsage> VoucherUsages { get; set; }

        public DbSet<ProductReview> ProductReviews { get; set; }

        public DbSet<CustomerFeedback> CustomerFeedbacks { get; set; }

        public DbSet<ReturnRequest> ReturnRequests { get; set; }

        public DbSet<ReturnRequestDetail> ReturnRequestDetails { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.ApplyConfigurationsFromAssembly(
                typeof(ApplicationDbContext).Assembly);
        }
    }
}
