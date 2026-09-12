using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ToyStoreManagement.Application.DTOs.Dashboard
{
    public class PromotionStatisticsDto
    {
        public int TotalVouchersUsed { get; set; }
        public decimal TotalDiscountAmount { get; set; }
    }
}