using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ToyStoreManagement.Application.DTOs.Order
{
    public class ShippingDto
    {
        public int ShippingId { get; set; }
        public int OrderId { get; set; }
        public string ReceiverName { get; set; }
        public string ReceiverPhone { get; set; }
        public string Address { get; set; }
        public int ShippingMethod { get; set; }
        public string TrackingCode { get; set; }
        public decimal ShippingFee { get; set; }
        public string? DeliveryBatchCode { get; set; }
        public DateTime? EstimatedDeliveryAt { get; set; }
        public DateTime? EstimatedDeliveryFromDate { get; set; }
        public DateTime? EstimatedDeliveryToDate { get; set; }
        public int Status { get; set; }
        public DateTime? ShippedAt { get; set; }
        public DateTime? DeliveryStartedAt { get; set; }
        public DateTime? DeliveredAt { get; set; }
        public int? ShipperId { get; set; }
        public string? ShipperName { get; set; }
        public string? ShipperPhone { get; set; }
        public string? FailReason { get; set; }
        public int AttemptCount { get; set; }
        public DateTime? FailedAt { get; set; }
    }
}
