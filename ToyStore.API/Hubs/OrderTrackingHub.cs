using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;

namespace ToyStoreManagement.API.Hubs
{
    public class OrderTrackingHub : Hub
    {
        public const string AdminGroup = "admin-orders-group";

        public static string OrderGroup(int orderId) => $"order-tracking-{orderId}";

        public static string ShipperGroup(int shipperId) => $"shipper-channel-{shipperId}";

        public async Task JoinOrder(int orderId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, OrderGroup(orderId));
        }

        public async Task LeaveOrder(int orderId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, OrderGroup(orderId));
        }

        public async Task JoinAdmin()
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, AdminGroup);
        }

        public async Task LeaveAdmin()
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, AdminGroup);
        }

        public async Task JoinShipper(int shipperId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, ShipperGroup(shipperId));
        }

        public async Task LeaveShipper(int shipperId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, ShipperGroup(shipperId));
        }
    }
}
