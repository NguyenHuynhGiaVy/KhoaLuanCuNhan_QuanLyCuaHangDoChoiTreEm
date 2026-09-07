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
    public class ReturnRequestDetailConfiguration
        : IEntityTypeConfiguration<ReturnRequestDetail>
    {
        public void Configure(EntityTypeBuilder<ReturnRequestDetail> builder)
        {
            builder.HasKey(x => x.ReturnRequestDetailId);

            builder.Property(x => x.UnitPrice)
                .HasColumnType("decimal(18,2)");

            builder.Property(x => x.RefundAmount)
                .HasColumnType("decimal(18,2)");

            builder.Property(x => x.Reason)
                .HasMaxLength(500);

            builder.HasOne(x => x.ReturnRequest)
                .WithMany(x => x.ReturnRequestDetails)
                .HasForeignKey(x => x.ReturnRequestId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(x => x.ProductVariant)
                .WithMany(x => x.ReturnRequestDetails)
                .HasForeignKey(x => x.VariantId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
