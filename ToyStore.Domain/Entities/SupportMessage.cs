namespace ToyStoreManagement.Domain.Entities
{
    public class SupportMessage
    {
        public long SupportMessageId { get; set; }
        public int SupportConversationId { get; set; }
        public string SenderUserId { get; set; } = string.Empty;
        public string SenderRole { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public DateTime SentAt { get; set; }
        public DateTime? ReadAt { get; set; }
        public virtual SupportConversation Conversation { get; set; } = null!;
    }
}
