using System;
using System.Collections.Generic;

namespace ToyStoreManagement.Application.DTOs.Inventory
{
    public class InventoryAuditTicketDto
    {
        public int AuditTicketId { get; set; }
        public string TicketCode { get; set; } = string.Empty;
        public string CreatedByUserId { get; set; } = string.Empty;
        public string CreatedByName { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public int Status { get; set; } // 1: Chờ duyệt, 2: Đã phê duyệt, 3: Đã từ chối
        public string StatusName => Status switch
        {
            1 => "Chờ duyệt",
            2 => "Đã cân bằng kho",
            3 => "Đã từ chối",
            _ => "Khác"
        };
        public string? ApprovedByUserId { get; set; }
        public string? ApprovedByName { get; set; }
        public DateTime? ApprovedAt { get; set; }
        public string? Note { get; set; }
        public int TotalItems { get; set; }
        public int TotalDiscrepancyQty { get; set; }
        public decimal TotalDiscrepancyValue { get; set; }

        public List<InventoryAuditTicketDetailDto> Details { get; set; } = new();
    }

    public class InventoryAuditTicketDetailDto
    {
        public int DetailId { get; set; }
        public int AuditTicketId { get; set; }
        public int VariantId { get; set; }
        public string SKU { get; set; } = string.Empty;
        public string ProductName { get; set; } = string.Empty;
        public string? Color { get; set; }
        public int SystemQuantity { get; set; }
        public int ActualQuantity { get; set; }
        public int DiscrepancyQuantity { get; set; }
        public decimal CostPrice { get; set; }
        public decimal DiscrepancyValue { get; set; }
        public string? DiscrepancyReason { get; set; }
        public string? Note { get; set; }
    }

    public class CreateInventoryAuditTicketDto
    {
        public string? Note { get; set; }
        public List<CreateInventoryAuditTicketDetailDto> Details { get; set; } = new();
    }

    public class CreateInventoryAuditTicketDetailDto
    {
        public int VariantId { get; set; }
        public int ActualQuantity { get; set; }
        public string? DiscrepancyReason { get; set; }
        public string? Note { get; set; }
    }
}
