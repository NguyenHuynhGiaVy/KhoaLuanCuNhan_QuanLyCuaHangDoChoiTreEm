using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;


namespace ToyStoreManagement.Application.DTOs.CustomerCare
{
    public class ReturnRequestDto
    {
        public int ReturnRequestId { get; set; }

        public int OrderId { get; set; }
        public string OrderCode { get; set; }

        public int CustomerId { get; set; }
        public string CustomerName { get; set; }

        public string ReturnCode { get; set; }

        public int ReturnType { get; set; }
        public int Reason { get; set; }

        public string Description { get; set; }
        public string EvidenceImageUrl { get; set; }

        public int Status { get; set; }

        public decimal RefundAmount { get; set; }

        public DateTime RequestedAt { get; set; }
        public DateTime? ProcessedAt { get; set; }

        public string StaffNote { get; set; }

        public List<ReturnRequestDetailDto> Details { get; set; }
    }
}
