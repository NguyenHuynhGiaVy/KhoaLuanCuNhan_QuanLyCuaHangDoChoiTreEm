using ToyStoreManagement.Application.DTOs.Chat;

namespace ToyStoreManagement.Application.Interfaces.Services
{
    public interface ISupportChatService
    {
        Task<SupportConversationDto> GetOrCreateAsync(int customerId);
        Task<IEnumerable<SupportConversationDto>> GetByCustomerIdAsync(int customerId);
        Task<IEnumerable<SupportConversationDto>> GetAllAsync();
        Task<SupportConversationDto?> GetByIdAsync(int conversationId, bool includeMessages);
        Task<SupportMessageDto> SendAsync(int conversationId, string senderUserId, string senderRole, string content);
        Task<bool> MarkReadAsync(int conversationId, string userId, bool isManager);
        Task<SupportConversationDto?> UpdateAsync(int conversationId, UpdateSupportConversationDto dto);
    }
}
