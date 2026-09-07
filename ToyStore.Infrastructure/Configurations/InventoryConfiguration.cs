using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ToyStoreManagement.Domain.Entities;

namespace ToyStoreManagement.Infrastructure.Configurations
{
    public class InventoryConfiguration
        : IEntityTypeConfiguration<Inventory>
    {
        public void Configure(EntityTypeBuilder<Inventory> builder)
        {
            builder.HasKey(x => x.InventoryId);

            builder.Property(x => x.Quantity)
                .IsRequired();

            builder.Property(x => x.ReservedQuantity)
                .IsRequired();

            builder.HasIndex(x => x.VariantId)
                .IsUnique();

            builder.HasOne(x => x.ProductVariant)
                .WithOne(x => x.Inventory)
                .HasForeignKey<Inventory>(x => x.VariantId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
