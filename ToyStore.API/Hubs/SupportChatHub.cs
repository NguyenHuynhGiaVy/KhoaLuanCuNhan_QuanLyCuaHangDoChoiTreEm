using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using ToyStoreManagement.Infrastructure.Data;

namespace ToyStoreManagement.API.Hubs
{
    [Authorize]
    public class SupportChatHub : Hub
    {
        public const string ManagerGroup = "support-chat-managers";
        private readonly ApplicationDbContext _context;

        public SupportChatHub(ApplicationDbContext context)
        {
            _context = context;
        }

        public static string ConversationGroup(int id) => $"support-chat-{id}";

        public override async Task OnConnectedAsync()
        {
            if (IsManager)
                await Groups.AddToGroupAsync(Context.ConnectionId, ManagerGroup);
            else if (!Context.User?.IsInRole("Customer") ?? true)
            {
                Context.Abort();
                return;
            }
            await base.OnConnectedAsync();
        }

        public async Task JoinConversation(int conversationId)
        {
            var conversation = await _context.SupportConversations
                .Where(x => x.SupportConversationId == conversationId)
                .Select(x => new { x.CustomerId })
                .FirstOrDefaultAsync();
            if (conversation == null)
                throw new HubException("Cuộc trò chuyện không tồn tại.");
            if (IsManager)
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, ConversationGroup(conversationId));
                return;
            }

            var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? Context.User?.FindFirstValue("sub");
            var ownsConversation = !string.IsNullOrWhiteSpace(userId)
                && await _context.Customers.AnyAsync(x =>
                    x.CustomerId == conversation.CustomerId && x.UserId == userId);
            if (!ownsConversation)
                throw new HubException("Bạn không có quyền truy cập cuộc trò chuyện này.");
            await Groups.AddToGroupAsync(Context.ConnectionId, ConversationGroup(conversationId));
        }

        private bool IsManager =>
            Context.User?.IsInRole("Admin") == true
            || Context.User?.IsInRole("Manager") == true
            || Context.User?.IsInRole("Staff") == true;
    }
}
