using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using ToyStoreManagement.Application.DTOs.Chat;
using ToyStoreManagement.Application.Interfaces.Services;
using ToyStoreManagement.Infrastructure.Data;
using ToyStoreManagement.API.Hubs;

namespace ToyStoreManagement.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class SupportChatController : ControllerBase
    {
        private readonly ISupportChatService _chatService;
        private readonly ApplicationDbContext _context;
        private readonly IHubContext<SupportChatHub> _hub;

        public SupportChatController(
            ISupportChatService chatService,
            ApplicationDbContext context,
            IHubContext<SupportChatHub> hub)
        {
            _chatService = chatService;
            _context = context;
            _hub = hub;
        }

        [HttpPost("mine")]
        [Authorize(Policy = "CustomerAccess")]
        public async Task<IActionResult> GetOrCreateMine()
        {
            var customerId = await GetCurrentCustomerId();
            if (!customerId.HasValue)
                return NotFound(new { message = "Bạn cần tạo hồ sơ khách hàng trước khi sử dụng chat." });
            return Ok(await _chatService.GetOrCreateAsync(customerId.Value));
        }

        [HttpGet("mine")]
        [Authorize(Policy = "CustomerAccess")]
        public async Task<IActionResult> GetMyConversations()
        {
            var customerId = await GetCurrentCustomerId();
            if (!customerId.HasValue)
                return NotFound(new { message = "Bạn cần tạo hồ sơ khách hàng trước khi sử dụng chat." });
            return Ok(await _chatService.GetByCustomerIdAsync(customerId.Value));
        }

        [HttpGet]
        [Authorize(Policy = "StaffAccess")]
        public async Task<IActionResult> GetAll()
        {
            return Ok(await _chatService.GetAllAsync());
        }

        [HttpGet("{conversationId:int}")]
        [Authorize(Policy = "StaffAccess")]
        public async Task<IActionResult> GetById(int conversationId)
        {
            var result = await _chatService.GetByIdAsync(conversationId, true);
            return result == null ? NotFound() : Ok(result);
        }

        [HttpGet("{conversationId:int}/messages")]
        public async Task<IActionResult> GetMessages(int conversationId)
        {
            if (!await CanAccessConversation(conversationId))
                return Forbid();
            var result = await _chatService.GetByIdAsync(conversationId, true);
            return result == null ? NotFound() : Ok(result.Messages);
        }

        [HttpPost("{conversationId:int}/messages")]
        public async Task<IActionResult> SendMessage(
            int conversationId,
            [FromBody] SendSupportMessageDto dto)
        {
            if (!await CanAccessConversation(conversationId))
                return Forbid();
            var userId = GetCurrentUserId();
            if (string.IsNullOrWhiteSpace(userId))
                return Unauthorized();
            var role = IsManager ? (User.FindFirstValue(ClaimTypes.Role) ?? "Manager") : "Customer";
            try
            {
                var message = await _chatService.SendAsync(
                    conversationId, userId, role, dto.Content);
                await _hub.Clients.Group(SupportChatHub.ConversationGroup(conversationId))
                    .SendAsync("SupportMessageReceived", message);
                await _hub.Clients.Group(SupportChatHub.ManagerGroup)
                    .SendAsync("SupportMessageReceived", message);
                return Ok(message);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("{conversationId:int}/read")]
        public async Task<IActionResult> MarkRead(int conversationId)
        {
            if (!await CanAccessConversation(conversationId))
                return Forbid();
            var userId = GetCurrentUserId();
            if (string.IsNullOrWhiteSpace(userId))
                return Unauthorized();
            try
            {
                var changed = await _chatService.MarkReadAsync(conversationId, userId, IsManager);
                if (changed)
                {
                    await _hub.Clients.Group(SupportChatHub.ConversationGroup(conversationId))
                        .SendAsync("SupportMessagesRead", new
                        {
                            conversationId,
                            readerRole = IsManager ? "Manager" : "Customer",
                            readAt = DateTime.UtcNow
                        });
                }
                return NoContent();
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
        }

        [HttpPut("{conversationId:int}")]
        [Authorize(Policy = "StaffAccess")]
        public async Task<IActionResult> Update(
            int conversationId,
            [FromBody] UpdateSupportConversationDto dto)
        {
            try
            {
                var currentUserId = GetCurrentUserId();
                if (!User.IsInRole("Admin"))
                    dto.AssignedManagerUserId = currentUserId;
                else if (dto.AssignedManagerUserId != null
                    && !await _context.Users.AnyAsync(x => x.Id == dto.AssignedManagerUserId))
                    return BadRequest(new { message = "Tài khoản quản lý được gán không tồn tại." });
                var result = await _chatService.UpdateAsync(conversationId, dto);
                if (result == null)
                    return NotFound();
                await PublishConversationUpdate(conversationId, result);
                return Ok(result);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("{conversationId:int}/accept")]
        [Authorize(Policy = "StaffAccess")]
        public async Task<IActionResult> Accept(int conversationId)
        {
            var userId = GetCurrentUserId();
            if (string.IsNullOrWhiteSpace(userId))
                return Unauthorized();
            var result = await _chatService.UpdateAsync(conversationId,
                new UpdateSupportConversationDto { Status = 0, AssignedManagerUserId = userId });
            if (result == null)
                return NotFound();
            await PublishConversationUpdate(conversationId, result);
            return Ok(result);
        }

        private async Task PublishConversationUpdate(int conversationId, SupportConversationDto conversation)
        {
            await _hub.Clients.Group(SupportChatHub.ConversationGroup(conversationId))
                .SendAsync("SupportConversationUpdated", conversation);
            await _hub.Clients.Group(SupportChatHub.ManagerGroup)
                .SendAsync("SupportConversationUpdated", conversation);
        }

        private async Task<int?> GetCurrentCustomerId()
        {
            var userId = GetCurrentUserId();
            if (string.IsNullOrWhiteSpace(userId))
                return null;
            return await _context.Customers
                .Where(x => x.UserId == userId)
                .Select(x => (int?)x.CustomerId)
                .FirstOrDefaultAsync();
        }

        private async Task<bool> CanAccessConversation(int conversationId)
        {
            if (IsManager)
                return true;
            var customerId = await GetCurrentCustomerId();
            return customerId.HasValue && await _context.SupportConversations
                .AnyAsync(x => x.SupportConversationId == conversationId && x.CustomerId == customerId.Value);
        }

        private bool IsManager =>
            User.IsInRole("Admin") || User.IsInRole("Manager") || User.IsInRole("Staff");

        private string? GetCurrentUserId()
        {
            return User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? User.FindFirstValue("sub");
        }
    }
}
