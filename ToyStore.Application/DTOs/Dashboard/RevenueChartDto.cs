using System;
using System.Collections.Generic;

namespace ToyStoreManagement.Application.DTOs.Dashboard
{
    public class RevenueChartDto
    {
        public List<string> Labels { get; set; } = new List<string>();
        public List<decimal> Data { get; set; } = new List<decimal>();
    }
}
