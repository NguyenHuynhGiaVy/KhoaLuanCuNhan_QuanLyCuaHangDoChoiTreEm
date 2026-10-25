using System;

namespace ToyStoreManagement.Application.DTOs.Product
{
    public class CungUngDto
    {
        public int Id { get; set; }

        public int ProductId { get; set; }

        public int SupplierId { get; set; }

        public string? SupplierName { get; set; }

        public string? SupplierPhone { get; set; }

        public decimal? GiaNhapThamKhao { get; set; }

        public string? MaHangNCC { get; set; }

        public bool IsDefault { get; set; }

        public DateTime CreatedAt { get; set; }

        public DateTime? UpdatedAt { get; set; }
    }

    public class CreateUpdateCungUngItemDto
    {
        public int SupplierId { get; set; }

        public decimal? GiaNhapThamKhao { get; set; }

        public string? MaHangNCC { get; set; }

        public bool IsDefault { get; set; }
    }
}
