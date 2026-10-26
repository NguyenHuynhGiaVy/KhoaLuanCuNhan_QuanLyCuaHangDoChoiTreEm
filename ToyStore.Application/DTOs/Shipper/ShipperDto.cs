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
        // Total cash collected from the customer, including delivery fee.
        public decimal Amount { get; set; }
        public decimal ShippingFee { get; set; }
        public decimal StoreAmount { get; set; }
        public List<CodReconciliationItemDto> Products { get; set; } = new();
        public int? ShipperId { get; set; }
        public string? ShipperName { get; set; }
        public string? ShipperPhone { get; set; }
        public string? DeliveryBatchCode { get; set; }
        public int CodStatus { get; set; } // 1: shipper giữ, 2: chờ admin xác nhận, 3: đã xác nhận
        public DateTime? CodCollectedAt { get; set; }
        public DateTime? CodSubmittedAt { get; set; }
        public DateTime? CodConfirmedAt { get; set; }
        public string? CodNote { get; set; }
    }

    public class CodReconciliationItemDto
    {
        public string ProductName { get; set; } = string.Empty;
        public string? Sku { get; set; }
        public int Quantity { get; set; }
    }

    public class ConfirmCodSubmissionDto
    {
        public System.Collections.Generic.List<int> PaymentIds { get; set; } = new();
        public int? ShipperId { get; set; }
        public decimal ReceivedAmount { get; set; }
        public string? Note { get; set; }
    }
}
