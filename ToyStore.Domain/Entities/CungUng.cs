using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ToyStoreManagement.Domain.Entities
{
    [Table("CungUng")]
    public class CungUng
    {
        [Key]
        public int Id { get; set; }

        public int ProductId { get; set; }

        public int SupplierId { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? GiaNhapThamKhao { get; set; }

        [MaxLength(50)]
        public string? MaHangNCC { get; set; }

        public bool IsDefault { get; set; } = false;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? UpdatedAt { get; set; }

        // Navigation properties
        public virtual Product Product { get; set; } = null!;

        public virtual Supplier Supplier { get; set; } = null!;
    }
}
