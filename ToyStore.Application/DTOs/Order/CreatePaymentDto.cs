using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ToyStoreManagement.Application.DTOs.Order
{
    public class CreatePaymentDto
    {
        public int PaymentMethod { get; set; }
        public string TransactionCode { get; set; }
        public decimal Amount { get; set; }
    }
}