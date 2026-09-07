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
    public class ImportReceiptDetailConfiguration
        : IEntityTypeConfiguration<ImportReceiptDetail>
    {
        public void Configure(EntityTypeBuilder<ImportReceiptDetail> builder)
        {
            builder.HasKey(x => x.ImportReceiptDetailId);

            builder.Property(x => x.UnitCost)
                .HasColumnType("decimal(18,2)");

            builder.Property(x => x.TotalAmount)
                .HasColumnType("decimal(18,2)");

            builder.HasOne(x => x.ImportReceipt)
                .WithMany(x => x.ImportReceiptDetails)
                .HasForeignKey(x => x.ImportReceiptId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(x => x.ProductVariant)
                .WithMany(x => x.ImportReceiptDetails)
                .HasForeignKey(x => x.VariantId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
