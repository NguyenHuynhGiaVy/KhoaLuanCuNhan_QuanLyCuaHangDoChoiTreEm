using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;


namespace ToyStoreManagement.Application.DTOs.CustomerCare
{
    public class CustomerFeedbackDto
    {
        public long CustomerFeedbackId { get; set; }

        public int CustomerId { get; set; }
        public string CustomerName { get; set; }

        public int? OrderId { get; set; }
        public string OrderCode { get; set; }

        public string Subject { get; set; }
        public string Content { get; set; }

        public int FeedbackType { get; set; }
        public int Status { get; set; }

        public string Response { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime? RespondedAt { get; set; }
    }
}
