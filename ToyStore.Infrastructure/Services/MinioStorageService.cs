using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Minio;
using Minio.DataModel.Args;
using ToyStoreManagement.Application.Interfaces.Services;

namespace ToyStoreManagement.Infrastructure.Services
{
    public class MinioStorageService : IFileStorageService
    {
        private readonly IConfiguration _config;
        private readonly IWebHostEnvironment _env;
        private readonly ILogger<MinioStorageService> _logger;

        private readonly string _endpoint;
        private readonly string _accessKey;
        private readonly string _secretKey;
        private readonly string _bucketName;
        private readonly bool _useSSL;
        private readonly string _publicUrl;
        private readonly bool _enabled;

        private IMinioClient? _minioClient;
        private bool _bucketInitialized = false;

        public MinioStorageService(
            IConfiguration config,
            IWebHostEnvironment env,
            ILogger<MinioStorageService> logger)
        {
            _config = config;
            _env = env;
            _logger = logger;

            var section = _config.GetSection("Minio");
            _endpoint = section["Endpoint"] ?? "localhost:9000";
            _accessKey = section["AccessKey"] ?? "minioadmin";
            _secretKey = section["SecretKey"] ?? "minioadmin";
            _bucketName = (section["BucketName"] ?? "toystore-media").ToLowerInvariant();
            _useSSL = bool.TryParse(section["UseSSL"], out var ssl) && ssl;
            _publicUrl = section["PublicUrl"] ?? $"http://{_endpoint}/{_bucketName}";
            _enabled = !bool.TryParse(section["Enabled"], out var enabled) || enabled;

            InitClient();
        }

        private void InitClient()
        {
            try
            {
                if (!_enabled) return;

                var endpointClean = _endpoint.Replace("http://", "").Replace("https://", "").TrimEnd('/');
                _minioClient = new MinioClient()
                    .WithEndpoint(endpointClean)
                    .WithCredentials(_accessKey, _secretKey)
                    .WithSSL(_useSSL)
                    .Build();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[MinIO] Không thể khởi tạo MinioClient: {Message}", ex.Message);
                _minioClient = null;
            }
        }

        private async Task EnsureBucketExistsAsync()
        {
            if (_minioClient == null || _bucketInitialized) return;

            try
            {
                var beArgs = new BucketExistsArgs().WithBucket(_bucketName);
                bool found = await _minioClient.BucketExistsAsync(beArgs);
                if (!found)
                {
                    var mbArgs = new MakeBucketArgs().WithBucket(_bucketName);
                    await _minioClient.MakeBucketAsync(mbArgs);
                    _logger.LogInformation("[MinIO] Đã tạo thành công bucket '{BucketName}'", _bucketName);

                    // Thiết lập public read policy để có thể xem ảnh trực tiếp
                    try
                    {
                        string policyJson = $@"{{
                            ""Version"": ""2012-10-17"",
                            ""Statement"": [
                                {{
                                    ""Effect"": ""Allow"",
                                    ""Principal"": {{""AWS"": [""*""]}},
                                    ""Action"": [""s3:GetBucketLocation"", ""s3:ListBucket""],
                                    ""Resource"": [""arn:aws:s3:::{_bucketName}""]
                                }},
                                {{
                                    ""Effect"": ""Allow"",
                                    ""Principal"": {{""AWS"": [""*""]}},
                                    ""Action"": [""s3:GetObject""],
                                    ""Resource"": [""arn:aws:s3:::{_bucketName}/*""]
                                }}
                            ]
                        }}";
                        var spArgs = new SetPolicyArgs().WithBucket(_bucketName).WithPolicy(policyJson);
                        await _minioClient.SetPolicyAsync(spArgs);
                    }
                    catch (Exception polEx)
                    {
                        _logger.LogWarning(polEx, "[MinIO] Không thể set policy cho bucket: {Message}", polEx.Message);
                    }
                }
                _bucketInitialized = true;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[MinIO] Lỗi kiểm tra bucket '{BucketName}': {Message}", _bucketName, ex.Message);
            }
        }

        public async Task<string> UploadFileAsync(Stream fileStream, string fileName, string contentType, string folder = "products")
        {
            var ext = Path.GetExtension(fileName).ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(ext)) ext = ".jpg";

            var cleanFolder = string.IsNullOrWhiteSpace(folder) ? "general" : folder.Trim().ToLowerInvariant();
            cleanFolder = string.Join("_", cleanFolder.Split(Path.GetInvalidFileNameChars()));

            var uniqueFileName = $"{DateTime.UtcNow:yyyyMMdd_HHmmss}_{Guid.NewGuid():N}{ext}";
            var objectPath = $"{cleanFolder}/{uniqueFileName}";

            // Luôn lưu bản sao cục bộ vào wwwroot/uploads/ để dự phòng offline
            string localFallbackUrl = await SaveLocalFallbackAsync(fileStream, cleanFolder, uniqueFileName);

            if (!_enabled || _minioClient == null)
            {
                return localFallbackUrl;
            }

            try
            {
                await EnsureBucketExistsAsync();

                if (fileStream.CanSeek)
                {
                    fileStream.Position = 0;
                }

                var putArgs = new PutObjectArgs()
                    .WithBucket(_bucketName)
                    .WithObject(objectPath)
                    .WithStreamData(fileStream)
                    .WithObjectSize(fileStream.Length)
                    .WithContentType(string.IsNullOrWhiteSpace(contentType) ? "application/octet-stream" : contentType);

                await _minioClient.PutObjectAsync(putArgs);
                _logger.LogInformation("[MinIO] Tải tệp lên thành công: {ObjectPath}", objectPath);

                var publicBase = _publicUrl.TrimEnd('/');
                return $"{publicBase}/{objectPath}";
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[MinIO] MinIO không khả dụng hoặc lỗi tải lên ({Message}), tự động dùng Local Storage: {LocalUrl}", ex.Message, localFallbackUrl);
                return localFallbackUrl;
            }
        }

        public async Task<string> UploadBase64Async(string base64Data, string folder = "products")
        {
            if (string.IsNullOrWhiteSpace(base64Data))
                throw new ArgumentException("Dữ liệu Base64 không hợp lệ.", nameof(base64Data));

            var ext = ".jpg";
            var contentType = "image/jpeg";
            var data = base64Data;

            if (data.Contains(","))
            {
                var header = data.Substring(0, data.IndexOf(","));
                if (header.Contains("image/png")) { ext = ".png"; contentType = "image/png"; }
                else if (header.Contains("image/webp")) { ext = ".webp"; contentType = "image/webp"; }
                else if (header.Contains("image/gif")) { ext = ".gif"; contentType = "image/gif"; }
                data = data.Substring(data.IndexOf(",") + 1);
            }

            var bytes = Convert.FromBase64String(data);
            using var ms = new MemoryStream(bytes);
            return await UploadFileAsync(ms, $"upload{ext}", contentType, folder);
        }

        public async Task<StorageStatusDto> GetStorageStatusAsync()
        {
            var status = new StorageStatusDto
            {
                Endpoint = _endpoint,
                BucketName = _bucketName,
                IsMinioAvailable = false,
                StorageType = "Local (Fallback)",
                Message = "Chưa kết nối MinIO"
            };

            if (!_enabled || _minioClient == null)
            {
                status.Message = "MinIO đã bị tắt trong cấu hình appsettings.json. Đang dùng lưu trữ cục bộ.";
                return status;
            }

            try
            {
                var beArgs = new BucketExistsArgs().WithBucket(_bucketName);
                bool exists = await _minioClient.BucketExistsAsync(beArgs);
                status.IsMinioAvailable = true;
                status.StorageType = "MinIO S3 Object Storage";
                status.Message = exists ? $"Đã kết nối thành công tới MinIO! Bucket '{_bucketName}' sẵn sàng." : $"Đã kết nối tới MinIO, bucket '{_bucketName}' sẽ được tự động tạo.";
            }
            catch (Exception ex)
            {
                status.IsMinioAvailable = false;
                status.StorageType = "Local (Fallback)";
                status.Message = $"Không thể kết nối MinIO tại '{_endpoint}' ({ex.Message}). Hệ thống tự động lưu trữ dự phòng tại thư mục wwwroot/uploads.";
            }

            return status;
        }

        private async Task<string> SaveLocalFallbackAsync(Stream fileStream, string folder, string fileName)
        {
            try
            {
                var webRoot = _env.WebRootPath;
                if (string.IsNullOrEmpty(webRoot))
                {
                    webRoot = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
                }

                var uploadsDir = Path.Combine(webRoot, "uploads", folder);
                if (!Directory.Exists(uploadsDir))
                {
                    Directory.CreateDirectory(uploadsDir);
                }

                var localPath = Path.Combine(uploadsDir, fileName);

                if (fileStream.CanSeek)
                {
                    fileStream.Position = 0;
                }

                await using var fs = new FileStream(localPath, FileMode.Create, FileAccess.Write, FileShare.ReadWrite);
                await fileStream.CopyToAsync(fs);

                if (fileStream.CanSeek)
                {
                    fileStream.Position = 0;
                }

                return $"/uploads/{folder}/{fileName}";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[LocalFallback] Lỗi khi lưu bản sao cục bộ: {Message}", ex.Message);
                return $"/uploads/{folder}/{fileName}";
            }
        }
    }
}
