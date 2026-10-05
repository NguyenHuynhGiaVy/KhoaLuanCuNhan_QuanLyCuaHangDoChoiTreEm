using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ToyStoreManagement.Domain.Entities;

namespace ToyStoreManagement.Infrastructure.Configurations
{
    public class SupportMessageConfiguration : IEntityTypeConfiguration<SupportMessage>
    {
        public void Configure(EntityTypeBuilder<SupportMessage> builder)
        {
            builder.HasKey(x => x.SupportMessageId);
            builder.Property(x => x.SenderUserId).IsRequired().HasMaxLength(450);
            builder.Property(x => x.SenderRole).IsRequired().HasMaxLength(32);
            builder.Property(x => x.Content).IsRequired().HasMaxLength(4000);
            builder.HasIndex(x => new { x.SupportConversationId, x.SentAt });
            builder.HasOne(x => x.Conversation)
                .WithMany(x => x.Messages)
                .HasForeignKey(x => x.SupportConversationId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
