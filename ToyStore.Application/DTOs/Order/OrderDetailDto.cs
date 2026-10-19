using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ToyStoreManagement.Application.DTOs.Order
{
    public class OrderDetailDto
    {
        public int OrderDetailId { get; set; }
        public int OrderId { get; set; }
        public int VariantId { get; set; }
        public int Quantity { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal DiscountAmount { get; set; }
        public decimal TotalAmount { get; set; }
        public string? ProductName { get; set; }
        public string? Sku { get; set; }
        public string? ImageUrl { get; set; }
        public string? VariantAttributes { get; set; }
    }
}
