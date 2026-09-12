using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ToyStoreManagement.Application.DTOs.Import
{
    public class CreateImportReceiptDto
    {
        public int SupplierId { get; set; }

        public int EmployeeId { get; set; }

        public string ReceiptCode { get; set; }

        public DateTime ImportDate { get; set; }

        public int Status { get; set; } = 1;

        public string Note { get; set; }

        public List<CreateImportReceiptDetailDto> Details { get; set; }
            = new List<CreateImportReceiptDetailDto>();
    }
}
