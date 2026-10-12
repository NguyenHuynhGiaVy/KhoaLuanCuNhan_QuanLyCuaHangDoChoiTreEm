using System.ComponentModel.DataAnnotations;

namespace ToyStoreManagement.Application.DTOs.Order
{
    public class CalculateDeliveryEstimateRequestDto
    {
        [Required(ErrorMessage = "Địa chỉ nhận hàng không được để trống")]
        public string CustomerAddress { get; set; } = string.Empty;

        public double? DestinationLat { get; set; }

        public double? DestinationLng { get; set; }
    }
}
