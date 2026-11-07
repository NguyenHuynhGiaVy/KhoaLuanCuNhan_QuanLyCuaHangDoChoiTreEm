using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System;

namespace ToyStoreManagement.Application.DTOs.Inventory
{
    public class InventoryDto
    {
        public int InventoryId { get; set; }

        public int VariantId { get; set; }

        public string SKU { get; set; }

        public string ProductName { get; set; }

        public int Quantity { get; set; }

        public int ReservedQuantity { get; set; }

        public int AvailableQuantity { get; set; }

        public string? Color { get; set; }
        public string? Size { get; set; }
        public string? AgeRange { get; set; }
        public decimal Price { get; set; }
        public decimal CostPrice { get; set; }
        public bool IsLowStock { get; set; }
        public bool IsSlowMoving { get; set; }

        public DateTime UpdatedAt { get; set; }
    }

    public class InventoryAuditDto
    {
        public int VariantId { get; set; }
        public int ActualQuantity { get; set; }
        public string? Reason { get; set; }
    }

    public class StockMovementSummaryDto
    {
        public int VariantId { get; set; }
        public string SKU { get; set; } = string.Empty;
        public string ProductName { get; set; } = string.Empty;
        public string? Attributes { get; set; }
        public int OpeningStock { get; set; }
        public int InStock { get; set; }
        public int OutStock { get; set; }
        public int ClosingStock { get; set; }
        public decimal UnitCost { get; set; }
        public decimal TotalCostValue { get; set; }
    }

    public class StockMovementFilterDto
    {
        public DateTime? FromDate { get; set; }
        public DateTime? ToDate { get; set; }
        public int? VariantId { get; set; }
        public int? ProductId { get; set; }
        public string? TransactionType { get; set; }
    }
}