using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ToyStoreManagement.Domain.Entities;

namespace ToyStoreManagement.Infrastructure.Configurations
{
    public class LiquidationReceiptDetailConfiguration : IEntityTypeConfiguration<LiquidationReceiptDetail>
    {
        public void Configure(EntityTypeBuilder<LiquidationReceiptDetail> builder)
        {
            builder.HasKey(x => x.LiquidationReceiptDetailId);
            builder.HasIndex(x => new { x.LiquidationReceiptId, x.VariantId }).IsUnique();
            builder.HasOne(x => x.LiquidationReceipt)
                .WithMany(x => x.Details)
                .HasForeignKey(x => x.LiquidationReceiptId)
                .OnDelete(DeleteBehavior.Cascade);
            builder.HasOne(x => x.ProductVariant)
                .WithMany(x => x.LiquidationReceiptDetails)
                .HasForeignKey(x => x.VariantId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
