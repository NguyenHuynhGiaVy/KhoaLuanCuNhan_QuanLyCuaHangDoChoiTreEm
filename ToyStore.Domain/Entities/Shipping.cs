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

        // Navigation
        public virtual Order Order { get; set; }
    }
}
