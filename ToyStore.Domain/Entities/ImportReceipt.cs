using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ToyStoreManagement.Domain.Entities
{
    public class ImportReceipt
    {
        public ImportReceipt()
        {
            ImportReceiptDetails = new HashSet<ImportReceiptDetail>();
        }

        public int ImportReceiptId { get; set; }

        public int SupplierId { get; set; }

        public int EmployeeId { get; set; }

        public string ReceiptCode { get; set; }

        public DateTime ImportDate { get; set; }

        public decimal TotalAmount { get; set; }

        public int Status { get; set; }

        public string Note { get; set; }

        public DateTime CreatedAt { get; set; }

        // Navigation
        public virtual Supplier Supplier { get; set; }

        public virtual ICollection<ImportReceiptDetail> ImportReceiptDetails { get; set; }
    }
}
