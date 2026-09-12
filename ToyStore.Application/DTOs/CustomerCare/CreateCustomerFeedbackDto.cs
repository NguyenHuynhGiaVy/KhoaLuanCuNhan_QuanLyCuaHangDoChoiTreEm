using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ToyStoreManagement.Application.DTOs.CustomerCare
{
    public class CreateCustomerFeedbackDto
    {
        public int CustomerId { get; set; }

        public int? OrderId { get; set; }

        public string Subject { get; set; }

        public string Content { get; set; }

        public int FeedbackType { get; set; }
    }
}
