using System.Collections.Generic;

namespace ToyStoreManagement.Application.DTOs.Order
{
    public class BatchSuggestionDto
    {
        public string Reason { get; set; } = string.Empty;
        public string? TargetBatchCode { get; set; }
        public string? ReceiverPhone { get; set; }
        public string? CommonAddressArea { get; set; }
        public List<int> OrderIds { get; set; } = new List<int>();
        public List<string> OrderCodes { get; set; } = new List<string>();
        public int TotalOrders => OrderIds.Count;
    }

    public class MergeBatchRequestDto
    {
        public List<int> OrderIds { get; set; } = new List<int>();
        public string? BatchCode { get; set; }
    }
}
