namespace ToyStoreManagement.Domain.Entities
{
    public class SupportConversation
    {
        public SupportConversation()
        {
            Messages = new HashSet<SupportMessage>();
        }

        public int SupportConversationId { get; set; }
        public int CustomerId { get; set; }
        public string? AssignedManagerUserId { get; set; }
        public int Status { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public DateTime? LastMessageAt { get; set; }
        public virtual Customer Customer { get; set; } = null!;
        public virtual ICollection<SupportMessage> Messages { get; set; }
    }
}
