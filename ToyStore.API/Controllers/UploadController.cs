using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ToyStoreManagement.Application.Interfaces.Services;

namespace ToyStoreManagement.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UploadController : ControllerBase
    {
        private readonly IFileStorageService _storageService;
        private static readonly string[] AllowedImageExtensions = { ".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg" };
        private const long MaxFileSize = 10 * 1024 * 1024; // 10MB

        public UploadController(IFileStorageService storageService)
        {
            _storageService = storageService;
        }

        /// <summary>
        /// Tải ảnh lên từ máy tính (Multipart Form File) sử dụng MinIO S3 API với fallback lưu trữ dự phòng
        /// </summary>
        [HttpPost("image")]
        [AllowAnonymous]
        [RequestSizeLimit(10 * 1024 * 1024)]
        public async Task<IActionResult> UploadImage([FromForm] IFormFile? file, [FromForm] string? folder)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(new { message = "Vui lòng chọn tệp tin ảnh từ máy tính." });
            }

            if (file.Length > MaxFileSize)
            {
                return BadRequest(new { message = "Kích thước ảnh không được vượt quá 10MB." });
            }

            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!AllowedImageExtensions.Contains(extension))
            {
                return BadRequest(new { message = $"Định dạng ảnh không được hỗ trợ ({extension}). Vui lòng chọn .jpg, .png, .webp hoặc .gif." });
            }

            try
            {
                var subFolder = string.IsNullOrWhiteSpace(folder) ? "products" : folder.Trim().ToLowerInvariant();
                await using var stream = file.OpenReadStream();
                var publicUrl = await _storageService.UploadFileAsync(stream, file.FileName, file.ContentType, subFolder);

                return Ok(new
                {
                    url = publicUrl,
                    fileName = Path.GetFileName(publicUrl),
                    size = file.Length,
                    message = "Tải ảnh lên thành công!"
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Lỗi khi lưu ảnh: {ex.Message}" });
            }
        }

        /// <summary>
        /// Tải ảnh trực tiếp từ Base64 Data URL
        /// </summary>
        [HttpPost("base64")]
        [AllowAnonymous]
        public async Task<IActionResult> UploadBase64([FromBody] Base64UploadDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Base64Data))
            {
                return BadRequest(new { message = "Dữ liệu Base64 không hợp lệ." });
            }

            try
            {
                var subFolder = string.IsNullOrWhiteSpace(dto.Folder) ? "products" : dto.Folder.Trim().ToLowerInvariant();
                var publicUrl = await _storageService.UploadBase64Async(dto.Base64Data, subFolder);

                return Ok(new
                {
                    url = publicUrl,
                    fileName = Path.GetFileName(publicUrl),
                    message = "Lưu ảnh thành công!"
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Lỗi xử lý Base64: {ex.Message}" });
            }
        }

        /// <summary>
        /// Kiểm tra trạng thái kết nối MinIO Object Storage
        /// </summary>
        [HttpGet("storage-status")]
        [AllowAnonymous]
        public async Task<IActionResult> GetStorageStatus()
        {
            var status = await _storageService.GetStorageStatusAsync();
            return Ok(status);
        }
    }

    public class Base64UploadDto
    {
        public string Base64Data { get; set; } = string.Empty;
        public string? Folder { get; set; }
    }
}
