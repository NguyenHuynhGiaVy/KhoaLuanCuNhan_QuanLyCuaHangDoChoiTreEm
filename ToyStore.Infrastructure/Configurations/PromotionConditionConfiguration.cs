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
    public class PromotionConditionConfiguration
        : IEntityTypeConfiguration<PromotionCondition>
    {
        public void Configure(EntityTypeBuilder<PromotionCondition> builder)
        {
            builder.HasKey(x => x.PromotionConditionId);

            builder.Property(x => x.Description)
                .HasMaxLength(500);

            builder.Property(x => x.MinimumOrderValue)
                .HasColumnType("decimal(18,2)");

            builder.HasOne(x => x.Promotion)
                .WithMany(x => x.PromotionConditions)
                .HasForeignKey(x => x.PromotionId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(x => x.Category)
                .WithMany(x => x.PromotionConditions)
                .HasForeignKey(x => x.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(x => x.Brand)
                .WithMany(x => x.PromotionConditions)
                .HasForeignKey(x => x.BrandId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
