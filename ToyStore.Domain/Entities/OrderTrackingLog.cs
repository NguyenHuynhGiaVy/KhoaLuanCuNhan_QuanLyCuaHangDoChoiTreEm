using System;
using System.ComponentModel.DataAnnotations;

namespace ToyStoreManagement.Domain.Entities
{
    public class OrderTrackingLog
    {
        [Key]
        public int TrackingLogId { get; set; }

        public int OrderId { get; set; }

        public int? ShippingId { get; set; }

        public string Action { get; set; } = string.Empty;

        public string? PreviousStatus { get; set; }

        public string NewStatus { get; set; } = string.Empty;

        public string? PerformedByUserId { get; set; }

        public string PerformedByName { get; set; } = string.Empty;

        public string PerformedByRole { get; set; } = string.Empty;

        public string? Note { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        public virtual Order? Order { get; set; }

        public virtual Shipping? Shipping { get; set; }
    }
}
