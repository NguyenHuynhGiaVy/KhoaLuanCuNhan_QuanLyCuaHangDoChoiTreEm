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
    public class ShippingConfiguration
        : IEntityTypeConfiguration<Shipping>
    {
        public void Configure(EntityTypeBuilder<Shipping> builder)
        {
            builder.HasKey(x => x.ShippingId);

            builder.Property(x => x.ReceiverName)
                .IsRequired()
                .HasMaxLength(150);

            builder.Property(x => x.ReceiverPhone)
                .IsRequired()
                .HasMaxLength(20);

            builder.Property(x => x.Address)
                .IsRequired()
                .HasMaxLength(500);

            builder.Property(x => x.TrackingCode)
                .HasMaxLength(100);

            builder.Property(x => x.ShippingFee)
                .HasColumnType("decimal(18,2)");

            builder.HasIndex(x => x.TrackingCode);

            builder.HasOne(x => x.Order)
                .WithOne(x => x.Shipping)
                .HasForeignKey<Shipping>(x => x.OrderId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
