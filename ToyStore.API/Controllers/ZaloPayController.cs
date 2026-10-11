using System;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ToyStoreManagement.Infrastructure.Data;

namespace ToyStoreManagement.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ZaloPayController : ControllerBase
    {
        private const int ZaloPayPaymentMethod = 2;
        private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

        private readonly ApplicationDbContext _context;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _configuration;

        public ZaloPayController(
            ApplicationDbContext context,
            IHttpClientFactory httpClientFactory,
            IConfiguration configuration)
        {
            _context = context;
            _httpClientFactory = httpClientFactory;
            _configuration = configuration;
        }

        // Tạo giao dịch Sandbox sau khi đơn hàng đã được tạo thành công.
        [HttpPost("orders/{orderId:int}/create")]
        [Authorize(Policy = "CustomerAccess")]
        public async Task<IActionResult> CreatePayment(int orderId)
        {
            try
            {
                var customerId = await GetCurrentCustomerIdAsync();
                if (!customerId.HasValue)
                    return Forbid();

                var order = await _context.Orders
                    .Include(item => item.Payment)
                    .FirstOrDefaultAsync(item => item.OrderId == orderId);

                if (order == null)
                    return NotFound(new { message = "Không tìm thấy đơn hàng." });
                if (order.CustomerId != customerId.Value)
                    return Forbid();
                if (order.Payment == null || order.Payment.PaymentMethod != ZaloPayPaymentMethod)
                    return BadRequest(new { message = "Đơn hàng không sử dụng phương thức ZaloPay." });
                if (order.Payment.Status == 1)
                    return Ok(new { isPaid = true, orderId, message = "Đơn hàng này đã được thanh toán." });
                if (order.TotalAmount <= 0)
                    return BadRequest(new { message = "Số tiền thanh toán ZaloPay phải lớn hơn 0." });

                var options = GetRequiredOptions();
                if (!string.IsNullOrWhiteSpace(order.Payment.TransactionCode)
                    && !order.Payment.TransactionCode.StartsWith("PENDING-", StringComparison.OrdinalIgnoreCase))
                {
                    // Một đơn chỉ có một yêu cầu thanh toán đang chờ để không thể
                    // tạo nhiều link ZaloPay rồi vô tình thanh toán lặp.
                    var existingPayment = await QueryOrderAsync(options, order.Payment.TransactionCode);
                    if (existingPayment.ReturnCode == 1)
                    {
                        var expectedAmount = (long)Math.Round(order.Payment.Amount, 0, MidpointRounding.AwayFromZero);
                        if (existingPayment.Amount != expectedAmount)
                            return BadRequest(new { message = "Số tiền ZaloPay không khớp đơn hàng." });

                        order.Payment.Status = 1;
                        order.Payment.PaidAt = DateTime.UtcNow;
                        order.Payment.GatewayTransactionCode = existingPayment.ZpTransId?.ToString();
                        await _context.SaveChangesAsync();
                        return Ok(new { isPaid = true, orderId, message = "ZaloPay đã xác nhận thanh toán." });
                    }

                    // Giao dịch Sandbox hết hạn sau 15 phút. Khi đã hết hạn mà chưa
                    // thanh toán, cho phép khách lấy một liên kết mới thay vì bị kẹt ở link cũ.
                    if (order.Payment.CreatedAt.AddSeconds(900) > DateTime.UtcNow)
                        return Conflict(new { message = "Đơn hàng đã có yêu cầu thanh toán ZaloPay đang chờ. Vui lòng kiểm tra lại trạng thái thanh toán." });

                    order.Payment.TransactionCode = $"PENDING-{order.OrderCode}";
                    await _context.SaveChangesAsync();
                }

                var vietnamNow = DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(7));
                var appTransId = $"{vietnamNow:yyMMdd}_{order.OrderId}_{Guid.NewGuid():N}";
                appTransId = appTransId[..Math.Min(40, appTransId.Length)];
                var appTime = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                var returnUrl = $"{options.PublicBaseUrl.TrimEnd('/')}/order-review.html?zalopay=return&orderId={order.OrderId}";
                // ZaloPay không thể gọi callback trực tiếp vào localhost. Với Sandbox
                // local, trang trả về sẽ dùng API query để kiểm tra kết quả thanh toán.
                var callbackUrl = IsPublicHttpsUrl(options.PublicBaseUrl)
                    ? $"{options.PublicBaseUrl.TrimEnd('/')}/api/ZaloPay/callback"
                    : null;
                var embedData = JsonSerializer.Serialize(new
                {
                    redirecturl = returnUrl,
                    merchantinfo = order.OrderCode
                }, JsonOptions);
                var item = JsonSerializer.Serialize(new[]
                {
                    new
                    {
                        itemid = order.OrderCode,
                        itemname = $"Đơn hàng {order.OrderCode}",
                        itemprice = Math.Round(order.TotalAmount, 0, MidpointRounding.AwayFromZero),
                        itemquantity = 1
                    }
                }, JsonOptions);
                var amount = (long)Math.Round(order.TotalAmount, 0, MidpointRounding.AwayFromZero);
                var appUser = $"customer-{customerId.Value}";
                var macData = string.Join("|", options.AppId, appTransId, appUser, amount, appTime, embedData, item);
                var payload = new ZaloPayCreateOrderRequest
                {
                    AppId = options.AppId,
                    AppUser = appUser,
                    AppTransId = appTransId,
                    AppTime = appTime,
                    ExpireDurationSeconds = 900,
                    Amount = amount,
                    Description = $"Thanh toán đơn hàng {order.OrderCode}",
                    CallbackUrl = callbackUrl,
                    EmbedData = embedData,
                    Item = item,
                    Mac = ComputeHmac(macData, options.Key1),
                    BankCode = string.Empty
                };

                var client = _httpClientFactory.CreateClient();
                using var response = await client.PostAsJsonAsync(
                    $"{options.ApiBaseUrl.TrimEnd('/')}/v2/create",
                    payload,
                    JsonOptions,
                    HttpContext.RequestAborted);
                var zaloResponse = await response.Content.ReadFromJsonAsync<ZaloPayCreateOrderResponse>(JsonOptions, HttpContext.RequestAborted);
                var paymentUrl = zaloResponse == null ? null : ResolvePaymentUrl(zaloResponse, options);
                if (!response.IsSuccessStatusCode || zaloResponse?.ReturnCode != 1 || string.IsNullOrWhiteSpace(paymentUrl))
                {
                    var detail = zaloResponse?.SubReturnMessage ?? zaloResponse?.ReturnMessage ?? "ZaloPay chưa thể khởi tạo giao dịch.";
                    return BadRequest(new { message = detail });
                }

                order.Payment.TransactionCode = appTransId;
                order.Payment.GatewayTransactionCode = null;
                order.Payment.Amount = order.TotalAmount;
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    orderId = order.OrderId,
                    orderCode = order.OrderCode,
                    appTransId,
                    orderUrl = paymentUrl,
                    qrCode = zaloResponse.QrCode
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        // Trang quay về có thể gọi API này để chủ động kiểm tra khi callback bị chậm.
        [HttpGet("orders/{orderId:int}/status")]
        [Authorize(Policy = "CustomerAccess")]
        public async Task<IActionResult> GetPaymentStatus(int orderId)
        {
            try
            {
                var customerId = await GetCurrentCustomerIdAsync();
                if (!customerId.HasValue)
                    return Forbid();

                var order = await _context.Orders
                    .Include(item => item.Payment)
                    .FirstOrDefaultAsync(item => item.OrderId == orderId);
                if (order == null)
                    return NotFound(new { message = "Không tìm thấy đơn hàng." });
                if (order.CustomerId != customerId.Value)
                    return Forbid();
                if (order.Payment == null || order.Payment.PaymentMethod != ZaloPayPaymentMethod)
                    return BadRequest(new { message = "Đơn hàng không sử dụng ZaloPay." });

                if (order.Payment.Status != 1 && !order.Payment.TransactionCode.StartsWith("PENDING-", StringComparison.OrdinalIgnoreCase))
                {
                    var options = GetRequiredOptions();
                    var queryResult = await QueryOrderAsync(options, order.Payment.TransactionCode);
                    if (queryResult.ReturnCode == 1)
                    {
                        if (queryResult.Amount > 0 && queryResult.Amount != (long)Math.Round(order.Payment.Amount, 0, MidpointRounding.AwayFromZero))
                            return BadRequest(new { message = "Số tiền ZaloPay không khớp đơn hàng." });

                        order.Payment.Status = 1;
                        order.Payment.PaidAt = DateTime.UtcNow;
                        order.Payment.GatewayTransactionCode = queryResult.ZpTransId?.ToString();
                        await _context.SaveChangesAsync();
                    }
                }

                return Ok(new
                {
                    orderId = order.OrderId,
                    orderCode = order.OrderCode,
                    isPaid = order.Payment.Status == 1,
                    paymentStatus = order.Payment.Status,
                    amount = order.Payment.Amount,
                    message = order.Payment.Status == 1
                        ? "ZaloPay đã xác nhận thanh toán."
                        : "Đang chờ ZaloPay xác nhận thanh toán."
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        // ZaloPay gọi server-to-server sau khi thu tiền thành công.
        [HttpPost("callback")]
        [AllowAnonymous]
        public async Task<IActionResult> Callback([FromBody] ZaloPayCallbackRequest request)
        {
            try
            {
                var options = GetRequiredOptions();
                if (string.IsNullOrWhiteSpace(request.Data) || !IsValidMac(request.Data, request.Mac, options.Key2))
                    return Ok(new { return_code = 2, return_message = "Dữ liệu callback không hợp lệ." });

                var data = JsonSerializer.Deserialize<ZaloPayCallbackData>(request.Data, JsonOptions);
                if (data == null || string.IsNullOrWhiteSpace(data.AppTransId))
                    return Ok(new { return_code = 2, return_message = "Không đọc được dữ liệu callback." });

                var payment = await _context.Payments
                    .FirstOrDefaultAsync(item => item.TransactionCode == data.AppTransId);
                if (payment == null || payment.PaymentMethod != ZaloPayPaymentMethod)
                    return Ok(new { return_code = 2, return_message = "Không tìm thấy giao dịch ZaloPay." });

                var expectedAmount = (long)Math.Round(payment.Amount, 0, MidpointRounding.AwayFromZero);
                if (data.Amount != expectedAmount)
                    return Ok(new { return_code = 2, return_message = "Số tiền callback không khớp." });

                if (payment.Status != 1)
                {
                    payment.Status = 1;
                    payment.PaidAt = DateTime.UtcNow;
                    payment.GatewayTransactionCode = data.ZpTransId?.ToString();
                    await _context.SaveChangesAsync();
                }

                return Ok(new { return_code = 1, return_message = "Thành công" });
            }
            catch
            {
                // Callback phải trả phản hồi có cấu trúc để ZaloPay có thể gửi lại khi cần.
                return Ok(new { return_code = 2, return_message = "Thất bại" });
            }
        }

        private async Task<int?> GetCurrentCustomerIdAsync()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
            if (string.IsNullOrWhiteSpace(userId))
                return null;

            return await _context.Customers
                .Where(customer => customer.UserId == userId)
                .Select(customer => (int?)customer.CustomerId)
                .FirstOrDefaultAsync();
        }

        private ZaloPayOptions GetRequiredOptions()
        {
            var options = _configuration.GetSection("ZaloPay").Get<ZaloPayOptions>() ?? new ZaloPayOptions();
            if (!options.Enabled || options.AppId <= 0 || string.IsNullOrWhiteSpace(options.Key1) || string.IsNullOrWhiteSpace(options.Key2))
                throw new InvalidOperationException("ZaloPay Sandbox chưa được cấu hình. Hãy thiết lập AppId, Key1 và Key2 trong cấu hình bí mật.");
            if (!Uri.TryCreate(options.ApiBaseUrl, UriKind.Absolute, out var apiUri)
                || apiUri.Scheme != Uri.UriSchemeHttps)
                throw new InvalidOperationException("ZaloPay ApiBaseUrl phải là URL HTTPS hợp lệ.");
            if (!Uri.TryCreate(options.PublicBaseUrl, UriKind.Absolute, out var publicUri))
                throw new InvalidOperationException("ZaloPay PublicBaseUrl phải là URL hợp lệ để trả khách về trang kết quả.");

            var isLocalSandbox = options.Sandbox
                && publicUri.Scheme == Uri.UriSchemeHttp
                && (publicUri.IsLoopback || string.Equals(publicUri.Host, "localhost", StringComparison.OrdinalIgnoreCase));
            if (publicUri.Scheme != Uri.UriSchemeHttps && !isLocalSandbox)
                throw new InvalidOperationException("ZaloPay PublicBaseUrl phải là URL HTTPS công khai. Chỉ Sandbox mới cho phép localhost HTTP.");

            return options;
        }

        private static bool IsPublicHttpsUrl(string url) =>
            Uri.TryCreate(url, UriKind.Absolute, out var uri)
            && uri.Scheme == Uri.UriSchemeHttps
            && !uri.IsLoopback;

        private static string? ResolvePaymentUrl(ZaloPayCreateOrderResponse response, ZaloPayOptions options)
        {
            // Thông thường order_url là URL cổng thanh toán. Tuy nhiên bộ Sandbox
            // công khai đôi lúc trả payload QR EMV ở cả order_url và qr_code.
            if (Uri.TryCreate(response.OrderUrl, UriKind.Absolute, out var orderUri)
                && orderUri.Scheme == Uri.UriSchemeHttps)
            {
                return orderUri.AbsoluteUri;
            }

            if (string.IsNullOrWhiteSpace(response.ZpTransToken))
                return null;

            var orderPayload = JsonSerializer.Serialize(new
            {
                zptranstoken = response.ZpTransToken,
                appid = options.AppId
            });
            var encodedOrder = Convert.ToBase64String(Encoding.UTF8.GetBytes(orderPayload))
                .TrimEnd('=');
            var gatewayBaseUrl = options.Sandbox
                ? "https://sbgateway.zalopay.vn/openinapp?order="
                : "https://gateway.zalopay.vn/openinapp?order=";
            return gatewayBaseUrl + Uri.EscapeDataString(encodedOrder);
        }

        private async Task<ZaloPayQueryOrderResponse> QueryOrderAsync(ZaloPayOptions options, string appTransId)
        {
            var mac = ComputeHmac($"{options.AppId}|{appTransId}|{options.Key1}", options.Key1);
            var client = _httpClientFactory.CreateClient();
            using var response = await client.PostAsJsonAsync(
                $"{options.ApiBaseUrl.TrimEnd('/')}/v2/query",
                new ZaloPayQueryOrderRequest { AppId = options.AppId, AppTransId = appTransId, Mac = mac },
                JsonOptions,
                HttpContext.RequestAborted);
            if (!response.IsSuccessStatusCode)
                throw new InvalidOperationException("Không thể truy vấn trạng thái ZaloPay.");

            return await response.Content.ReadFromJsonAsync<ZaloPayQueryOrderResponse>(JsonOptions, HttpContext.RequestAborted)
                ?? throw new InvalidOperationException("ZaloPay không trả về trạng thái giao dịch.");
        }

        private static string ComputeHmac(string data, string key)
        {
            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(key));
            return Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(data))).ToLowerInvariant();
        }

        private static bool IsValidMac(string data, string? receivedMac, string key)
        {
            if (string.IsNullOrWhiteSpace(receivedMac))
                return false;

            var expected = Encoding.UTF8.GetBytes(ComputeHmac(data, key));
            var actual = Encoding.UTF8.GetBytes(receivedMac.Trim().ToLowerInvariant());
            return CryptographicOperations.FixedTimeEquals(expected, actual);
        }
    }

    public class ZaloPayOptions
    {
        public bool Enabled { get; set; }
        public bool Sandbox { get; set; } = true;
        public int AppId { get; set; }
        public string Key1 { get; set; } = string.Empty;
        public string Key2 { get; set; } = string.Empty;
        public string ApiBaseUrl { get; set; } = "https://sb-openapi.zalopay.vn";
        public string PublicBaseUrl { get; set; } = string.Empty;
    }

    public class ZaloPayCreateOrderRequest
    {
        [JsonPropertyName("app_id")] public int AppId { get; set; }
        [JsonPropertyName("app_user")] public string AppUser { get; set; } = string.Empty;
        [JsonPropertyName("app_trans_id")] public string AppTransId { get; set; } = string.Empty;
        [JsonPropertyName("app_time")] public long AppTime { get; set; }
        [JsonPropertyName("expire_duration_seconds")] public int ExpireDurationSeconds { get; set; }
        [JsonPropertyName("amount")] public long Amount { get; set; }
        [JsonPropertyName("description")] public string Description { get; set; } = string.Empty;
        [JsonPropertyName("callback_url")]
        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public string? CallbackUrl { get; set; }
        [JsonPropertyName("embed_data")] public string EmbedData { get; set; } = "{}";
        [JsonPropertyName("item")] public string Item { get; set; } = "[]";
        [JsonPropertyName("mac")] public string Mac { get; set; } = string.Empty;
        [JsonPropertyName("bank_code")] public string BankCode { get; set; } = string.Empty;
    }

    public class ZaloPayCreateOrderResponse
    {
        [JsonPropertyName("return_code")] public int ReturnCode { get; set; }
        [JsonPropertyName("return_message")] public string? ReturnMessage { get; set; }
        [JsonPropertyName("sub_return_message")] public string? SubReturnMessage { get; set; }
        [JsonPropertyName("zp_trans_token")] public string? ZpTransToken { get; set; }
        [JsonPropertyName("order_url")] public string? OrderUrl { get; set; }
        [JsonPropertyName("qr_code")] public string? QrCode { get; set; }
    }

    public class ZaloPayQueryOrderRequest
    {
        [JsonPropertyName("app_id")] public int AppId { get; set; }
        [JsonPropertyName("app_trans_id")] public string AppTransId { get; set; } = string.Empty;
        [JsonPropertyName("mac")] public string Mac { get; set; } = string.Empty;
    }

    public class ZaloPayQueryOrderResponse
    {
        [JsonPropertyName("return_code")] public int ReturnCode { get; set; }
        [JsonPropertyName("amount")] public long Amount { get; set; }
        [JsonPropertyName("zp_trans_id")] public long? ZpTransId { get; set; }
    }

    public class ZaloPayCallbackRequest
    {
        [JsonPropertyName("data")] public string Data { get; set; } = string.Empty;
        [JsonPropertyName("mac")] public string? Mac { get; set; }
        [JsonPropertyName("type")] public int Type { get; set; }
    }

    public class ZaloPayCallbackData
    {
        [JsonPropertyName("app_trans_id")] public string? AppTransId { get; set; }
        [JsonPropertyName("amount")] public long Amount { get; set; }
        [JsonPropertyName("zp_trans_id")] public long? ZpTransId { get; set; }
    }
}
