using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ToyStoreManagement.Domain.Entities;

namespace ToyStoreManagement.Infrastructure.Configurations
{
    public class ProductVariantAttributeConfiguration
        : IEntityTypeConfiguration<ProductVariantAttribute>
    {
        public void Configure(EntityTypeBuilder<ProductVariantAttribute> builder)
        {
            builder.HasKey(x => x.VariantAttributeId);

            builder.Property(x => x.AttributeName)
                .IsRequired()
                .HasMaxLength(100);

            builder.Property(x => x.AttributeValue)
                .IsRequired()
                .HasMaxLength(200);

            builder.HasOne(x => x.ProductVariant)
                .WithMany(x => x.VariantAttributes)
                .HasForeignKey(x => x.VariantId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}