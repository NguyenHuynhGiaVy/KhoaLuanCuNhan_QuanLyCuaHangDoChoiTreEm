using System;
using System.Collections.Generic;

namespace ToyStoreManagement.Domain.Entities
{
    public class Shipper
    {
        public Shipper()
        {
            Shippings = new HashSet<Shipping>();
        }

        public int ShipperId { get; set; }

        public string? UserId { get; set; } // Liên kết AspNetUsers nếu shipper có tài khoản đăng nhập

        public string FullName { get; set; } = string.Empty;

        public string PhoneNumber { get; set; } = string.Empty;

        public string? VehicleNumber { get; set; } // Biển số xe

        public string? AssignedArea { get; set; } // Khu vực / Tuyến phụ trách chính (VD: Quận 1, Quận 3, Bình Thạnh...)

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        public virtual ICollection<Shipping> Shippings { get; set; }
    }
}
