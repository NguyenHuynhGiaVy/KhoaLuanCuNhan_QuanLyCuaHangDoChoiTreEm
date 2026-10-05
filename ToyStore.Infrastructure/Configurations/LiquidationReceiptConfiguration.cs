using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ToyStoreManagement.Domain.Entities;

namespace ToyStoreManagement.Infrastructure.Configurations
{
    public class LiquidationReceiptConfiguration : IEntityTypeConfiguration<LiquidationReceipt>
    {
        public void Configure(EntityTypeBuilder<LiquidationReceipt> builder)
        {
            builder.HasKey(x => x.LiquidationReceiptId);
            builder.Property(x => x.ReceiptCode).IsRequired().HasMaxLength(50);
            builder.HasIndex(x => x.ReceiptCode).IsUnique();
            builder.Property(x => x.CreatedByUserId).IsRequired().HasMaxLength(450);
            builder.Property(x => x.Note).HasMaxLength(2000);
        }
    }
}
