using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ToyStoreManagement.Domain.Entities;

namespace ToyStoreManagement.Infrastructure.Configurations
{
    public class InventoryTransactionConfiguration : IEntityTypeConfiguration<InventoryTransaction>
    {
        public void Configure(EntityTypeBuilder<InventoryTransaction> builder)
        {
            builder.HasKey(x => x.Id);

            builder.Property(x => x.Note)
                .HasMaxLength(500);

            builder.Property(x => x.ReferenceType)
                .HasMaxLength(50);

            // Định nghĩa rõ ràng mối quan hệ với ProductVariant
            builder.HasOne(x => x.ProductVariant)
                .WithMany(x => x.InventoryTransactions)
                .HasForeignKey(x => x.VariantId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
