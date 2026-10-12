using System;

namespace ToyStoreManagement.Application.DTOs.Order
{
    public class DeliveryEstimateResponseDto
    {
        public string WarehouseName { get; set; } = string.Empty;
        public string WarehouseAddress { get; set; } = string.Empty;
        public double DistanceInKm { get; set; }
        public string DistanceText { get; set; } = string.Empty;
        public int DurationInMinutes { get; set; }
        public string DurationText { get; set; } = string.Empty;
        public DateTime EstimatedDeliveryFromDate { get; set; }
        public DateTime EstimatedDeliveryToDate { get; set; }
        public bool IsSameDayEligible { get; set; }
    }
}
