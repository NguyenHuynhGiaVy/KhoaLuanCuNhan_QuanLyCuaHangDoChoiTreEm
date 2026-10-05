using System.Data;
using Microsoft.EntityFrameworkCore;
using ToyStoreManagement.Application.DTOs.Chat;
using ToyStoreManagement.Application.Interfaces.Services;
using ToyStoreManagement.Domain.Entities;
using ToyStoreManagement.Infrastructure.Data;

namespace ToyStoreManagement.Infrastructure.Services
{
    public class SupportChatService : ISupportChatService
    {
        private readonly ApplicationDbContext _context;

        public SupportChatService(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<SupportConversationDto> GetOrCreateAsync(int customerId)
        {
            await using var transaction = await _context.Database
                .BeginTransactionAsync(IsolationLevel.Serializable);
            var conversation = await _context.SupportConversations
                .Include(x => x.Customer)
                .Where(x => x.CustomerId == customerId && x.Status == 0)
                .OrderByDescending(x => x.UpdatedAt)
                .FirstOrDefaultAsync();
            if (conversation == null)
            {
                conversation = new SupportConversation
                {
                    CustomerId = customerId,
                    Status = 0,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.SupportConversations.Add(conversation);
                await _context.SaveChangesAsync();
                conversation.Customer = await _context.Customers.FindAsync(customerId)
                    ?? throw new InvalidOperationException("Không tìm thấy hồ sơ khách hàng.");
            }
            await transaction.CommitAsync();
            return MapConversation(conversation);
        }

        public async Task<IEnumerable<SupportConversationDto>> GetByCustomerIdAsync(int customerId)
        {
            var conversations = await _context.SupportConversations
                .Include(x => x.Customer)
                .Where(x => x.CustomerId == customerId)
                .OrderByDescending(x => x.LastMessageAt ?? x.CreatedAt)
                .ToListAsync();
            var unreadCounts = await _context.SupportMessages
                .Where(x => x.ReadAt == null && x.SenderRole != "Customer")
                .GroupBy(x => x.SupportConversationId)
                .Select(x => new { ConversationId = x.Key, Count = x.Count() })
                .ToDictionaryAsync(x => x.ConversationId, x => x.Count);
            var results = new List<SupportConversationDto>(conversations.Count);
            foreach (var conversation in conversations)
            {
                var dto = MapConversation(conversation);
                dto.UnreadCount = unreadCounts.GetValueOrDefault(conversation.SupportConversationId);
                results.Add(dto);
            }
            return results;
        }

        public async Task<IEnumerable<SupportConversationDto>> GetAllAsync()
        {
            var conversations = await _context.SupportConversations
                .Include(x => x.Customer)
                .OrderBy(x => x.Status)
                .ThenByDescending(x => x.LastMessageAt ?? x.CreatedAt)
                .ToListAsync();
            var unreadCounts = await _context.SupportMessages
                .Where(x => x.ReadAt == null && x.SenderRole == "Customer")
                .GroupBy(x => x.SupportConversationId)
                .Select(x => new { ConversationId = x.Key, Count = x.Count() })
                .ToDictionaryAsync(x => x.ConversationId, x => x.Count);
            var results = new List<SupportConversationDto>(conversations.Count);
            foreach (var conversation in conversations)
            {
                var dto = MapConversation(conversation);
                dto.UnreadCount = unreadCounts.GetValueOrDefault(conversation.SupportConversationId);
                results.Add(dto);
            }
            return results;
        }

        public async Task<SupportConversationDto?> GetByIdAsync(int conversationId, bool includeMessages)
        {
            var conversation = await _context.SupportConversations
                .Include(x => x.Customer)
                .FirstOrDefaultAsync(x => x.SupportConversationId == conversationId);
            if (conversation == null)
                return null;

            var dto = MapConversation(conversation);
            dto.UnreadCount = await UnreadMessages(conversationId, true).CountAsync();
            if (includeMessages)
            {
                var messages = await _context.SupportMessages
                    .Where(x => x.SupportConversationId == conversationId)
                    .OrderBy(x => x.SentAt)
                    .ToListAsync();
                dto.Messages = messages.Select(MapMessage).ToList();
            }
            return dto;
        }

        public async Task<SupportMessageDto> SendAsync(
            int conversationId,
            string senderUserId,
            string senderRole,
            string content)
        {
            if (string.IsNullOrWhiteSpace(content))
                throw new InvalidOperationException("Tin nhắn không được để trống.");
            var trimmedContent = content.Trim();
            if (trimmedContent.Length > 4000)
                throw new InvalidOperationException("Tin nhắn không được vượt quá 4000 ký tự.");

            await using var transaction = await _context.Database
                .BeginTransactionAsync(IsolationLevel.Serializable);
            var conversation = await _context.SupportConversations
                .FirstOrDefaultAsync(x => x.SupportConversationId == conversationId);
            if (conversation == null)
                throw new KeyNotFoundException("Cuộc trò chuyện không tồn tại.");
            if (conversation.Status != 0)
                throw new InvalidOperationException("Cuộc trò chuyện đã đóng.");

            var now = DateTime.UtcNow;
            var message = new SupportMessage
            {
                SupportConversationId = conversationId,
                SenderUserId = senderUserId,
                SenderRole = senderRole,
                Content = trimmedContent,
                SentAt = now
            };
            conversation.LastMessageAt = now;
            conversation.UpdatedAt = now;
            _context.SupportMessages.Add(message);
            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
            return MapMessage(message);
        }

        public async Task<bool> MarkReadAsync(int conversationId, string userId, bool isManager)
        {
            var conversationExists = await _context.SupportConversations
                .AnyAsync(x => x.SupportConversationId == conversationId);
            if (!conversationExists)
                throw new KeyNotFoundException("Cuộc trò chuyện không tồn tại.");

            var unread = await _context.SupportMessages
                .Where(x => x.SupportConversationId == conversationId
                    && x.ReadAt == null
                    && (isManager ? x.SenderRole == "Customer" : x.SenderUserId != userId))
                .ToListAsync();
            var now = DateTime.UtcNow;
            foreach (var message in unread)
                message.ReadAt = now;
            if (unread.Count == 0)
                return false;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<SupportConversationDto?> UpdateAsync(
            int conversationId,
            UpdateSupportConversationDto dto)
        {
            if (dto.Status is not 0 and not 1)
                throw new InvalidOperationException("Trạng thái hội thoại không hợp lệ.");
            var conversation = await _context.SupportConversations
                .Include(x => x.Customer)
                .FirstOrDefaultAsync(x => x.SupportConversationId == conversationId);
            if (conversation == null)
                return null;
            conversation.Status = dto.Status;
            if (dto.AssignedManagerUserId != null)
                conversation.AssignedManagerUserId = dto.AssignedManagerUserId;
            conversation.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return MapConversation(conversation);
        }

        private IQueryable<SupportMessage> UnreadMessages(int conversationId, bool forManager)
        {
            return _context.SupportMessages.Where(x =>
                x.SupportConversationId == conversationId
                && x.ReadAt == null
                && (forManager ? x.SenderRole == "Customer" : x.SenderRole != "Customer"));
        }

        private static SupportConversationDto MapConversation(SupportConversation conversation)
        {
            return new SupportConversationDto
            {
                SupportConversationId = conversation.SupportConversationId,
                CustomerId = conversation.CustomerId,
                CustomerName = conversation.Customer?.FullName ?? string.Empty,
                AssignedManagerUserId = conversation.AssignedManagerUserId,
                Status = conversation.Status,
                CreatedAt = conversation.CreatedAt,
                UpdatedAt = conversation.UpdatedAt,
                LastMessageAt = conversation.LastMessageAt
            };
        }

        private static SupportMessageDto MapMessage(SupportMessage message)
        {
            return new SupportMessageDto
            {
                SupportMessageId = message.SupportMessageId,
                SupportConversationId = message.SupportConversationId,
                SenderUserId = message.SenderUserId,
                SenderRole = message.SenderRole,
                Content = message.Content,
                SentAt = message.SentAt,
                ReadAt = message.ReadAt
            };
        }
    }
}
