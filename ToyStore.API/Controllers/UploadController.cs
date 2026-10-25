using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace ToyStoreManagement.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UploadController : ControllerBase
    {
        private readonly IWebHostEnvironment _env;
        private static readonly string[] AllowedImageExtensions = { ".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg" };
        private const long MaxFileSize = 10 * 1024 * 1024; // 10MB

        public UploadController(IWebHostEnvironment env)
        {
            _env = env;
        }

        /// <summary>
        /// Tải ảnh lên từ máy tính (Multipart Form File)
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
                var subFolder = string.IsNullOrWhiteSpace(folder) ? "general" : folder.Trim().ToLowerInvariant();
                // Bảo vệ đường dẫn không bị Directory Traversal
                subFolder = string.Join("_", subFolder.Split(Path.GetInvalidFileNameChars()));

                var uploadsRoot = Path.Combine(_env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"), "uploads", subFolder);
                if (!Directory.Exists(uploadsRoot))
                {
                    Directory.CreateDirectory(uploadsRoot);
                }

                var uniqueFileName = $"{DateTime.UtcNow:yyyyMMdd_HHmmss}_{Guid.NewGuid():N}{extension}";
                var filePath = Path.Combine(uploadsRoot, uniqueFileName);

                await using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                var relativeUrl = $"/uploads/{subFolder}/{uniqueFileName}";
                return Ok(new
                {
                    url = relativeUrl,
                    fileName = uniqueFileName,
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
        /// Tải ảnh trực tiếp từ Base64 Data URL (hỗ trợ preview & fallback)
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
                var data = dto.Base64Data;
                var extension = ".jpg";

                if (data.Contains(","))
                {
                    var header = data.Substring(0, data.IndexOf(","));
                    if (header.Contains("image/png")) extension = ".png";
                    else if (header.Contains("image/webp")) extension = ".webp";
                    else if (header.Contains("image/gif")) extension = ".gif";
                    data = data.Substring(data.IndexOf(",") + 1);
                }

                var bytes = Convert.FromBase64String(data);
                if (bytes.Length > MaxFileSize)
                {
                    return BadRequest(new { message = "Kích thước ảnh vượt quá 10MB." });
                }

                var subFolder = string.IsNullOrWhiteSpace(dto.Folder) ? "general" : dto.Folder.Trim().ToLowerInvariant();
                var uploadsRoot = Path.Combine(_env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"), "uploads", subFolder);
                if (!Directory.Exists(uploadsRoot))
                {
                    Directory.CreateDirectory(uploadsRoot);
                }

                var uniqueFileName = $"{DateTime.UtcNow:yyyyMMdd_HHmmss}_{Guid.NewGuid():N}{extension}";
                var filePath = Path.Combine(uploadsRoot, uniqueFileName);

                await System.IO.File.WriteAllBytesAsync(filePath, bytes);

                var relativeUrl = $"/uploads/{subFolder}/{uniqueFileName}";
                return Ok(new
                {
                    url = relativeUrl,
                    fileName = uniqueFileName,
                    size = bytes.Length,
                    message = "Lưu ảnh thành công!"
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Lỗi xử lý Base64: {ex.Message}" });
            }
        }
    }

    public class Base64UploadDto
    {
        public string Base64Data { get; set; } = string.Empty;
        public string? Folder { get; set; }
    }
}
