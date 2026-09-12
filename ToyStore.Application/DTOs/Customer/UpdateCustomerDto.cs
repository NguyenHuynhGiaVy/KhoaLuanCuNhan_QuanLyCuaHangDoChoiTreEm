using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ToyStoreManagement.Application.DTOs.Customer
{
    public class UpdateCustomerDto
    {
        public string FullName { get; set; }

        public string Phone { get; set; }

        public string Email { get; set; }

        public DateTime? DateOfBirth { get; set; }

        public int? Gender { get; set; }

        public string Address { get; set; }

        public int Status { get; set; }
    }
}
