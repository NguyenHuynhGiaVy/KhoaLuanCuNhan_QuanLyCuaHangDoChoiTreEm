using System.Threading.Tasks;

namespace ToyStoreManagement.Application.Interfaces.Services
{
    public class DistanceResult
    {
        public double DistanceInKm { get; set; }
        public int DurationInMinutes { get; set; }
        public bool IsSuccessful { get; set; }
        public string? ErrorMessage { get; set; }
    }

    public interface IDistanceMatrixService
    {
        Task<DistanceResult> CalculateDistanceToWarehouseAsync(
            string destinationAddress,
            double? destLat = null,
            double? destLng = null);

        Task<double> CalculateDistanceBetweenPointsAsync(
            string addressA,
            string addressB);
    }
}
