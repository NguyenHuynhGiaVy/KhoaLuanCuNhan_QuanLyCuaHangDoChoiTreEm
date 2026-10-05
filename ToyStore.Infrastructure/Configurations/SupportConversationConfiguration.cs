using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ToyStoreManagement.Domain.Entities;

namespace ToyStoreManagement.Infrastructure.Configurations
{
    public class SupportConversationConfiguration : IEntityTypeConfiguration<SupportConversation>
    {
        public void Configure(EntityTypeBuilder<SupportConversation> builder)
        {
            builder.HasKey(x => x.SupportConversationId);
            builder.Property(x => x.AssignedManagerUserId).HasMaxLength(450);
            builder.HasIndex(x => new { x.CustomerId, x.Status });
            builder.HasOne(x => x.Customer)
                .WithMany(x => x.SupportConversations)
                .HasForeignKey(x => x.CustomerId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
