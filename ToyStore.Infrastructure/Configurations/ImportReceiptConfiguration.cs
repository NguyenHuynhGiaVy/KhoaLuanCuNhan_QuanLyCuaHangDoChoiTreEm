using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ToyStoreManagement.Domain.Entities;

namespace ToyStoreManagement.Infrastructure.Configurations
{
    public class ImportReceiptConfiguration
        : IEntityTypeConfiguration<ImportReceipt>
    {
        public void Configure(EntityTypeBuilder<ImportReceipt> builder)
        {
            builder.HasKey(x => x.ImportReceiptId);

            builder.Property(x => x.ReceiptCode)
                .IsRequired()
                .HasMaxLength(50);

            builder.HasIndex(x => x.ReceiptCode)
                .IsUnique();

            builder.Property(x => x.TotalAmount)
                .HasColumnType("decimal(18,2)");

            builder.HasOne(x => x.Supplier)
                .WithMany(x => x.ImportReceipts)
                .HasForeignKey(x => x.SupplierId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}