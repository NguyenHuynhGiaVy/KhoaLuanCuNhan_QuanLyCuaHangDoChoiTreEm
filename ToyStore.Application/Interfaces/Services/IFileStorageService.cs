using System.IO;
using System.Threading.Tasks;

namespace ToyStoreManagement.Application.Interfaces.Services
{
    public interface IFileStorageService
    {
        /// <summary>
        /// Tải tệp tin lên bộ lưu trữ (Hỗ trợ MinIO S3 API & Fallback lưu trữ cục bộ)
        /// </summary>
        /// <param name="fileStream">Stream dữ liệu của tệp</param>
        /// <param name="fileName">Tên gốc của tệp</param>
        /// <param name="contentType">MIME type (image/jpeg, image/png, ...)</param>
        /// <param name="folder">Thư mục phân loại (products, variants, general)</param>
        /// <returns>Đường dẫn URL công khai của tệp đã lưu</returns>
        Task<string> UploadFileAsync(Stream fileStream, string fileName, string contentType, string folder = "products");

        /// <summary>
        /// Tải ảnh từ chuỗi Base64
        /// </summary>
        Task<string> UploadBase64Async(string base64Data, string folder = "products");

        /// <summary>
        /// Kiểm tra trạng thái kết nối tới MinIO Server
        /// </summary>
        Task<StorageStatusDto> GetStorageStatusAsync();
    }

    public class StorageStatusDto
    {
        public bool IsMinioAvailable { get; set; }
        public string StorageType { get; set; } = "Local";
        public string Endpoint { get; set; } = string.Empty;
        public string BucketName { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
    }
}
