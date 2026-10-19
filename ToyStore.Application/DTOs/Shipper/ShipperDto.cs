using System;

namespace ToyStoreManagement.Application.DTOs.Shipper
{
    public class ShipperDto
    {
        public int ShipperId { get; set; }
        public string? UserId { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string PhoneNumber { get; set; } = string.Empty;
        public string? VehicleNumber { get; set; }
        public string? AssignedArea { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }

        // Thống kê nhanh
        public int ActiveOrdersCount { get; set; }
        public int CompletedOrdersCount { get; set; }
        public decimal PendingCodAmount { get; set; }
    }

    public class CreateShipperDto
    {
        public string FullName { get; set; } = string.Empty;
        public string PhoneNumber { get; set; } = string.Empty;
        public string? VehicleNumber { get; set; }
        public string? AssignedArea { get; set; }
        public string? Email { get; set; } // Nếu tạo kèm tài khoản
        public string? Password { get; set; }
    }

    public class UpdateShipperDto
    {
        public string FullName { get; set; } = string.Empty;
        public string PhoneNumber { get; set; } = string.Empty;
        public string? VehicleNumber { get; set; }
        public string? AssignedArea { get; set; }
        public bool IsActive { get; set; } = true;
    }

    public class AssignOrderShipperDto
    {
        public int ShipperId { get; set; }
        public int? OrderId { get; set; }
        public string? DeliveryBatchCode { get; set; }
    }

    public class FailDeliveryDto
    {
        public string FailReason { get; set; } = string.Empty;
        public string? Note { get; set; }
    }

    public class CodReconciliationDto
    {
        public int PaymentId { get; set; }
        public int OrderId { get; set; }
        public string OrderCode { get; set; } = string.Empty;
        public string ReceiverName { get; set; } = string.Empty;
        public string ReceiverPhone { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public int? ShipperId { get; set; }
        public string? ShipperName { get; set; }
        public string? ShipperPhone { get; set; }
        public string? DeliveryBatchCode { get; set; }
        public int CodStatus { get; set; } // 1: Shipper giữ tiền, 2: Đã nộp
        public DateTime? CodCollectedAt { get; set; }
        public DateTime? CodSubmittedAt { get; set; }
        public string? CodNote { get; set; }
    }

    public class ConfirmCodSubmissionDto
    {
        public System.Collections.Generic.List<int> PaymentIds { get; set; } = new();
        public int? ShipperId { get; set; }
        public string? Note { get; set; }
    }
}
