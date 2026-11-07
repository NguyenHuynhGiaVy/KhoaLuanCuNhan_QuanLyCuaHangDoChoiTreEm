using System;
using System.Collections.Generic;

namespace ToyStoreManagement.Domain.Entities
{
    public class InventoryAuditTicket
    {
        public InventoryAuditTicket()
        {
            Details = new HashSet<InventoryAuditTicketDetail>();
        }

        public int AuditTicketId { get; set; }
        public string TicketCode { get; set; } = string.Empty;
        public string CreatedByUserId { get; set; } = string.Empty;
        public string CreatedByName { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        // 1: Chờ duyệt, 2: Đã phê duyệt cân bằng kho, 3: Đã từ chối
        public int Status { get; set; } = 1;
        public string? ApprovedByUserId { get; set; }
        public string? ApprovedByName { get; set; }
        public DateTime? ApprovedAt { get; set; }
        public string? Note { get; set; }
        public int TotalItems { get; set; }
        public int TotalDiscrepancyQty { get; set; }
        public decimal TotalDiscrepancyValue { get; set; }

        public virtual ICollection<InventoryAuditTicketDetail> Details { get; set; }
    }
}
