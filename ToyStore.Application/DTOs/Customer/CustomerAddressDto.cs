using System;

namespace ToyStoreManagement.Application.DTOs.Customer
{
    public class CustomerAddressDto
    {
        public int CustomerAddressId { get; set; }
        public string ReceiverName { get; set; } = string.Empty;
        public string ReceiverPhone { get; set; } = string.Empty;
        public string AddressDetail { get; set; } = string.Empty;
        public string ProvinceCode { get; set; } = string.Empty;
        public string ProvinceName { get; set; } = string.Empty;
        public string WardCode { get; set; } = string.Empty;
        public string WardName { get; set; } = string.Empty;
        public string FullAddress { get; set; } = string.Empty;
        public bool IsDefault { get; set; }
        public DateTime EstimatedDeliveryFromDate { get; set; }
        public DateTime EstimatedDeliveryToDate { get; set; }
    }
}
