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
    public class ReturnRequestConfiguration
        : IEntityTypeConfiguration<ReturnRequest>
    {
        public void Configure(EntityTypeBuilder<ReturnRequest> builder)
        {
            builder.HasKey(x => x.ReturnRequestId);

            builder.Property(x => x.ReturnCode)
                .IsRequired()
                .HasMaxLength(50);

            builder.HasIndex(x => x.ReturnCode)
                .IsUnique();

            builder.Property(x => x.Description)
                .HasMaxLength(2000);

            builder.Property(x => x.EvidenceImageUrl)
                .HasMaxLength(500);

            builder.Property(x => x.RefundAmount)
                .HasColumnType("decimal(18,2)");

            builder.Property(x => x.StaffNote)
                .HasMaxLength(2000);

            builder.HasOne(x => x.Order)
                .WithMany(x => x.ReturnRequests)
                .HasForeignKey(x => x.OrderId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(x => x.Customer)
                .WithMany(x => x.ReturnRequests)
                .HasForeignKey(x => x.CustomerId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
