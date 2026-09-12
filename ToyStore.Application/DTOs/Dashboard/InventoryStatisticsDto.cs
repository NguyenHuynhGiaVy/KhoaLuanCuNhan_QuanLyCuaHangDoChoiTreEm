using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ToyStoreManagement.Application.DTOs.Dashboard
{
    public class InventoryStatisticsDto
    {
        public int TotalVariants { get; set; }
        public int TotalQuantity { get; set; }
        public int LowStockVariants { get; set; }
        public decimal TotalInventoryValue { get; set; }
    }
}
