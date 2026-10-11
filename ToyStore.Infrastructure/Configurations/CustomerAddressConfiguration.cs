using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ToyStoreManagement.Domain.Entities;

namespace ToyStoreManagement.Infrastructure.Configurations
{
    public class CustomerAddressConfiguration : IEntityTypeConfiguration<CustomerAddress>
    {
        public void Configure(EntityTypeBuilder<CustomerAddress> builder)
        {
            builder.HasKey(x => x.CustomerAddressId);
            builder.Property(x => x.ReceiverName).IsRequired().HasMaxLength(150);
            builder.Property(x => x.ReceiverPhone).IsRequired().HasMaxLength(20);
            builder.Property(x => x.AddressDetail).IsRequired().HasMaxLength(300);
            builder.Property(x => x.ProvinceCode).IsRequired().HasMaxLength(20);
            builder.Property(x => x.ProvinceName).IsRequired().HasMaxLength(150);
            builder.Property(x => x.WardCode).IsRequired().HasMaxLength(20);
            builder.Property(x => x.WardName).IsRequired().HasMaxLength(150);
            builder.HasIndex(x => new { x.CustomerId, x.IsDefault });
            builder.HasOne(x => x.Customer)
                .WithMany(x => x.CustomerAddresses)
                .HasForeignKey(x => x.CustomerId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
