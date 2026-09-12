using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ToyStoreManagement.Application.DTOs.CustomerCare
{
    public class UpdateReturnRequestDto
    {
        public int Status { get; set; }

        public decimal RefundAmount { get; set; }

        public string StaffNote { get; set; }
    }
}
