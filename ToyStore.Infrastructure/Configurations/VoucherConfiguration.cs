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
    public class VoucherConfiguration
        : IEntityTypeConfiguration<Voucher>
    {
        public void Configure(EntityTypeBuilder<Voucher> builder)
        {
            builder.HasKey(x => x.VoucherId);

            builder.Property(x => x.Code)
                .IsRequired()
                .HasMaxLength(50);

            builder.Property(x => x.Name)
                .IsRequired()
                .HasMaxLength(200);

            builder.Property(x => x.DiscountValue)
                .HasColumnType("decimal(18,2)");

            builder.Property(x => x.MaximumDiscount)
                .HasColumnType("decimal(18,2)");

            builder.Property(x => x.MinimumOrderValue)
                .HasColumnType("decimal(18,2)");

            builder.HasIndex(x => x.Code)
                .IsUnique();
        }
    }
}
