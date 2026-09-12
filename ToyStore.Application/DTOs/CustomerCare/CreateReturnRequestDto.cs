using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ToyStoreManagement.Application.DTOs.CustomerCare
{
    public class CreateReturnRequestDto
    {
        public int OrderId { get; set; }

        public int CustomerId { get; set; }

        public int ReturnType { get; set; }

        public int Reason { get; set; }

        public string Description { get; set; }

        public string EvidenceImageUrl { get; set; }

        public List<CreateReturnRequestDetailDto> Details { get; set; }
    }
}
