using System;
using System.Collections.Concurrent;
using System.Net.Http;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ToyStoreManagement.Application.Interfaces.Services;

namespace ToyStoreManagement.Infrastructure.Services
{
    public class GoogleDistanceMatrixService : IDistanceMatrixService
    {
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly ILogger<GoogleDistanceMatrixService> _logger;

        // In-memory thread-safe cache with expiration
        private static readonly ConcurrentDictionary<string, (DistanceResult Result, DateTime Expiry)> _cache
            = new ConcurrentDictionary<string, (DistanceResult, DateTime)>(StringComparer.OrdinalIgnoreCase);

        public GoogleDistanceMatrixService(
            HttpClient httpClient,
            IConfiguration configuration,
            ILogger<GoogleDistanceMatrixService> logger)
        {
            _httpClient = httpClient;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<DistanceResult> CalculateDistanceToWarehouseAsync(
            string destinationAddress,
            double? destLat = null,
            double? destLng = null)
        {
            if (string.IsNullOrWhiteSpace(destinationAddress) && (!destLat.HasValue || !destLng.HasValue))
            {
                return new DistanceResult
                {
                    DistanceInKm = 0,
                    DurationInMinutes = 0,
                    IsSuccessful = false,
                    ErrorMessage = "Địa chỉ nhận hàng không hợp lệ."
                };
            }

            var warehouseAddress = _configuration["Warehouse:Address"] ?? "123 Nguyễn Thị Minh Khai, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh";
            var warehouseLat = _configuration.GetValue<double?>("Warehouse:Latitude") ?? 10.7731;
            var warehouseLng = _configuration.GetValue<double?>("Warehouse:Longitude") ?? 106.6908;

            string origin = $"{warehouseLat},{warehouseLng}";
            string destination = destLat.HasValue && destLng.HasValue
                ? $"{destLat.Value},{destLng.Value}"
                : destinationAddress;

            return await QueryDistanceMatrixAsync(origin, destination);
        }

        public async Task<double> CalculateDistanceBetweenPointsAsync(string addressA, string addressB)
        {
            if (string.IsNullOrWhiteSpace(addressA) || string.IsNullOrWhiteSpace(addressB))
                return 999.0;

            if (string.Equals(addressA.Trim(), addressB.Trim(), StringComparison.OrdinalIgnoreCase))
                return 0.0;

            var apiKey = _configuration["DistanceMatrix:ApiKey"];
            if (string.IsNullOrWhiteSpace(apiKey) || apiKey.Contains("YOUR_API_KEY", StringComparison.OrdinalIgnoreCase))
            {
                return FallbackHeuristicBetweenPoints(addressA, addressB);
            }

            var result = await QueryDistanceMatrixAsync(addressA, addressB);
            return result.IsSuccessful ? result.DistanceInKm : FallbackHeuristicBetweenPoints(addressA, addressB);
        }

        private static double FallbackHeuristicBetweenPoints(string addressA, string addressB)
        {
            var normA = NormalizeAddressText(addressA);
            var normB = NormalizeAddressText(addressB);

            if (normA == normB) return 0.0;

            var partsA = addressA.Split(new[] { ',', '-' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(NormalizeAddressText)
                .Where(p => p.Length >= 4)
                .ToList();

            var partsB = addressB.Split(new[] { ',', '-' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(NormalizeAddressText)
                .Where(p => p.Length >= 4)
                .ToList();

            // Nếu cùng hẻm hoặc cùng tên đường
            bool sameAlleyOrStreet = partsA.Any(p => (p.Contains("hem") || p.Contains("duong") || p.Contains("ngo") || p.Length >= 6) && normB.Contains(p));
            if (sameAlleyOrStreet)
            {
                return 0.2; // Cách nhau khoảng 200m, cùng tuyến
            }

            // Trùng từ 2 thành phần địa lý (ví dụ cùng Phường, Quận)
            int commonCount = partsA.Intersect(partsB).Count();
            if (commonCount >= 2)
            {
                return 1.2;
            }
            if (commonCount >= 1)
            {
                return 2.5;
            }

            return 15.0;
        }

        private static string NormalizeAddressText(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return string.Empty;
            var normalized = value.Trim().ToLowerInvariant().Replace('đ', 'd').Normalize(System.Text.NormalizationForm.FormD);
            return string.Concat(normalized.Where(c => char.IsLetterOrDigit(c)));
        }

        private async Task<DistanceResult> QueryDistanceMatrixAsync(string origin, string destination)
        {
            string cacheKey = $"{origin.Trim()}|{destination.Trim()}";
            if (_cache.TryGetValue(cacheKey, out var cachedItem))
            {
                if (cachedItem.Expiry > DateTime.UtcNow)
                {
                    return cachedItem.Result;
                }
                _cache.TryRemove(cacheKey, out _);
            }

            var apiKey = _configuration["DistanceMatrix:ApiKey"];
            var endpoint = _configuration["DistanceMatrix:Endpoint"] ?? "https://maps.googleapis.com/maps/api/distancematrix/json";

            // Fallback chế độ offline / Mock thông minh khi chưa có API Key
            if (string.IsNullOrWhiteSpace(apiKey) || apiKey.Contains("YOUR_API_KEY", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogInformation("DistanceMatrix API key chưa cấu hình. Kích hoạt tính toán cự ly mô phỏng thông minh.");
                var fallback = FallbackHeuristicCalculation(origin, destination);
                _cache[cacheKey] = (fallback, DateTime.UtcNow.AddHours(24));
                return fallback;
            }

            try
            {
                var requestUrl = $"{endpoint}?origins={Uri.EscapeDataString(origin)}&destinations={Uri.EscapeDataString(destination)}&mode=driving&language=vi&key={apiKey}";
                var response = await _httpClient.GetAsync(requestUrl);
                response.EnsureSuccessStatusCode();

                var json = await response.Content.ReadAsStringAsync();
                var parsed = JsonSerializer.Deserialize<GoogleDistanceResponse>(json);

                if (parsed?.Status == "OK" && parsed.Rows?.Length > 0 && parsed.Rows[0].Elements?.Length > 0)
                {
                    var elem = parsed.Rows[0].Elements[0];
                    if (elem.Status == "OK" && elem.Distance != null && elem.Duration != null)
                    {
                        var result = new DistanceResult
                        {
                            DistanceInKm = Math.Round(elem.Distance.Value / 1000.0, 2),
                            DurationInMinutes = (int)Math.Ceiling(elem.Duration.Value / 60.0),
                            IsSuccessful = true
                        };

                        _cache[cacheKey] = (result, DateTime.UtcNow.AddHours(24));
                        return result;
                    }
                }

                var fallbackResult = FallbackHeuristicCalculation(origin, destination);
                _cache[cacheKey] = (fallbackResult, DateTime.UtcNow.AddHours(24));
                return fallbackResult;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Không thể kết nối đến Distance Matrix API. Chuyển sang tính toán dự phòng.");
                var fallback = FallbackHeuristicCalculation(origin, destination);
                return fallback;
            }
        }

        private static DistanceResult FallbackHeuristicCalculation(string origin, string destination)
        {
            var destLower = destination.ToLowerInvariant();
            
            // Heuristic khoảng cách dựa trên các quận huyện phổ biến
            bool isCoreDistrict = destLower.Contains("quận 1")
                               || destLower.Contains("quận 3")
                               || destLower.Contains("quận 4")
                               || destLower.Contains("quận 5")
                               || destLower.Contains("quận 10")
                               || destLower.Contains("bến thành");

            bool isInnerDistrict = destLower.Contains("quận 2")
                                || destLower.Contains("quận 7")
                                || destLower.Contains("quận 8")
                                || destLower.Contains("bình thạnh")
                                || destLower.Contains("phú nhuận")
                                || destLower.Contains("tân bình")
                                || destLower.Contains("tân phú")
                                || destLower.Contains("thủ đức");

            double distance = isCoreDistrict ? 3.5 : (isInnerDistrict ? 8.5 : 18.0);
            int duration = isCoreDistrict ? 15 : (isInnerDistrict ? 30 : 55);

            return new DistanceResult
            {
                DistanceInKm = distance,
                DurationInMinutes = duration,
                IsSuccessful = true
            };
        }

        private class GoogleDistanceResponse
        {
            [JsonPropertyName("status")] public string? Status { get; set; }
            [JsonPropertyName("rows")] public GoogleRow[]? Rows { get; set; }
        }

        private class GoogleRow
        {
            [JsonPropertyName("elements")] public GoogleElement[]? Elements { get; set; }
        }

        private class GoogleElement
        {
            [JsonPropertyName("status")] public string? Status { get; set; }
            [JsonPropertyName("distance")] public GoogleValue? Distance { get; set; }
            [JsonPropertyName("duration")] public GoogleValue? Duration { get; set; }
        }

        private class GoogleValue
        {
            [JsonPropertyName("value")] public long Value { get; set; }
            [JsonPropertyName("text")] public string? Text { get; set; }
        }
    }
}
