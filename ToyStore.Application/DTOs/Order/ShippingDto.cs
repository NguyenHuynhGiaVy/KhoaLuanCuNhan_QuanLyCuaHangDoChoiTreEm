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
        public int Status { get; set; }
        public DateTime? ShippedAt { get; set; }
        public DateTime? DeliveredAt { get; set; }
    }
}
