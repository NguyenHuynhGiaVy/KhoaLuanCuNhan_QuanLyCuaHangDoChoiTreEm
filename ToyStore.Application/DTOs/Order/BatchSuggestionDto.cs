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
        public List<BatchDeliveryStopDto> DeliveryStops { get; set; } = new List<BatchDeliveryStopDto>();
        public int TotalOrders => OrderIds.Count;
    }

    public class BatchDeliveryStopDto
    {
        public int OrderId { get; set; }
        public string OrderCode { get; set; } = string.Empty;
        public string ReceiverName { get; set; } = string.Empty;
        public string ReceiverPhone { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
    }

    public class MergeBatchRequestDto
    {
        public List<int> OrderIds { get; set; } = new List<int>();
        public string? BatchCode { get; set; }
    }
}
