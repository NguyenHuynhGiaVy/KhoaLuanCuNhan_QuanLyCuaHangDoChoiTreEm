namespace ToyStoreManagement.Application.DTOs.Chat
{
    public class SupportConversationDto
    {
        public int SupportConversationId { get; set; }
        public int CustomerId { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public string? AssignedManagerUserId { get; set; }
        public int Status { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public DateTime? LastMessageAt { get; set; }
        public int UnreadCount { get; set; }
        public List<SupportMessageDto> Messages { get; set; } = new();
    }

    public class SupportMessageDto
    {
        public long SupportMessageId { get; set; }
        public int SupportConversationId { get; set; }
        public string SenderUserId { get; set; } = string.Empty;
        public string SenderRole { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public DateTime SentAt { get; set; }
        public DateTime? ReadAt { get; set; }
    }
}
