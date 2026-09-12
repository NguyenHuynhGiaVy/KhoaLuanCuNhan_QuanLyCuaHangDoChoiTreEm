using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ToyStoreManagement.Application.DTOs.Import
{
    public class ImportReceiptDto
    {
        public int ImportReceiptId { get; set; }

        public int SupplierId { get; set; }

        public string SupplierName { get; set; }

        public int EmployeeId { get; set; }

        public string ReceiptCode { get; set; }

        public DateTime ImportDate { get; set; }

        public decimal TotalAmount { get; set; }

        public int Status { get; set; }

        public string Note { get; set; }

        public DateTime CreatedAt { get; set; }

        public List<ImportReceiptDetailDto> ImportReceiptDetails { get; set; }
            = new List<ImportReceiptDetailDto>();
    }
}
