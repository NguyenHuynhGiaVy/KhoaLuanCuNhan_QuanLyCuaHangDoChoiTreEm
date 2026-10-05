using System.ComponentModel.DataAnnotations;

namespace ToyStoreManagement.Application.DTOs.Chat
{
    public class SendSupportMessageDto
    {
        [Required]
        [StringLength(4000, MinimumLength = 1)]
        public string Content { get; set; } = string.Empty;
    }

    public class UpdateSupportConversationDto
    {
        public int Status { get; set; }
        public string? AssignedManagerUserId { get; set; }
    }
}
