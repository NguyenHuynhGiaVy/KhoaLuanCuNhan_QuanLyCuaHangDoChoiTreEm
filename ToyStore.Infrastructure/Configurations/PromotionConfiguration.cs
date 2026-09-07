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
    public class PromotionConfiguration
        : IEntityTypeConfiguration<Promotion>
    {
        public void Configure(EntityTypeBuilder<Promotion> builder)
        {
            builder.HasKey(x => x.PromotionId);

            builder.Property(x => x.Name)
                .IsRequired()
                .HasMaxLength(200);

            builder.Property(x => x.Description)
                .HasMaxLength(2000);

            builder.Property(x => x.DiscountValue)
                .HasColumnType("decimal(18,2)");

            builder.Property(x => x.MaximumDiscount)
                .HasColumnType("decimal(18,2)");

            builder.HasIndex(x => new
            {
                x.StartDate,
                x.EndDate,
                x.Status
            });
        }
    }
}
