using System;

namespace ToyStoreManagement.Domain.Entities
{
    public class Shipping
    {
        public int ShippingId { get; set; }

        public int OrderId { get; set; }

        public string ReceiverName { get; set; }

        public string ReceiverPhone { get; set; }

        public string Address { get; set; }

        public int ShippingMethod { get; set; }

        public string TrackingCode { get; set; }

        public decimal ShippingFee { get; set; }

        // Mã lô giúp nhân viên gom các đơn cùng tuyến giao hàng.
        public string? DeliveryBatchCode { get; set; }

        // Giữ lại cho dữ liệu cũ; giao diện mới dùng khoảng ngày bên dưới.
        public DateTime? EstimatedDeliveryAt { get; set; }

        public DateTime? EstimatedDeliveryFromDate { get; set; }

        public DateTime? EstimatedDeliveryToDate { get; set; }

        public int Status { get; set; }

        public DateTime? ShippedAt { get; set; }

        public DateTime? DeliveredAt { get; set; }

        // Shipper phụ trách đơn hàng
        public int? ShipperId { get; set; }

        // Lý do giao hàng thất bại (nếu có)
        public string? FailReason { get; set; }

        // Số lần shipper đã thử giao hàng (tối đa 3 lần trước khi hoàn hàng về kho)
        public int AttemptCount { get; set; } = 0;

        public DateTime? FailedAt { get; set; }

        // Navigation
        public virtual Order Order { get; set; }

        public virtual Shipper? Shipper { get; set; }
    }
}
