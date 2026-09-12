using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ToyStoreManagement.Application.DTOs.Customer
{
    public class CustomerDto
    {
        public int CustomerId { get; set; }

        public string FullName { get; set; }

        public string Phone { get; set; }

        public string Email { get; set; }

        public string UserId { get; set; }

        public DateTime? DateOfBirth { get; set; }

        public int? Gender { get; set; }

        public string Address { get; set; }

        public int LoyaltyPoint { get; set; }

        public int Status { get; set; }

        public DateTime CreatedAt { get; set; }

        public DateTime? UpdatedAt { get; set; }
    }
}