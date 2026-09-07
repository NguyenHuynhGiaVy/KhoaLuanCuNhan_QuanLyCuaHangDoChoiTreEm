using System;
using System.Collections.Generic;

namespace ToyStoreManagement.Domain.Entities
{
    public class ReturnRequest
    {
        public ReturnRequest()
        {
            ReturnRequestDetails = new HashSet<ReturnRequestDetail>();
        }

        public int ReturnRequestId { get; set; }

        public int OrderId { get; set; }

        public int CustomerId { get; set; }

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

        // Navigation
        public virtual Order Order { get; set; }

        public virtual Customer Customer { get; set; }

        public virtual ICollection<ReturnRequestDetail> ReturnRequestDetails { get; set; }
    }
}