using System;

namespace ToyStoreManagement.Domain.Entities
{
    public class InventoryAuditTicketDetail
    {
        public int DetailId { get; set; }
        public int AuditTicketId { get; set; }
        public int VariantId { get; set; }
        public int SystemQuantity { get; set; }
        public int ActualQuantity { get; set; }
        public int DiscrepancyQuantity { get; set; }
        public decimal CostPrice { get; set; }
        public decimal DiscrepancyValue { get; set; }
        public string? DiscrepancyReason { get; set; }
        public string? Note { get; set; }

        public virtual InventoryAuditTicket AuditTicket { get; set; } = null!;
        public virtual ProductVariant ProductVariant { get; set; } = null!;
    }
}
