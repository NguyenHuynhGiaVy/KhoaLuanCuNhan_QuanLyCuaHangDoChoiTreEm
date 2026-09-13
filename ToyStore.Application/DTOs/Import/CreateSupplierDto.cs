using System.ComponentModel.DataAnnotations;

namespace ToyStoreManagement.Application.DTOs.Import
{
    public class CreateSupplierDto
    {
        [Required(ErrorMessage = "Tên nhà cung cấp không được để trống")]
        public string Name { get; set; } = string.Empty;

        [Required(ErrorMessage = "Số điện thoại không được để trống")]
        [Phone(ErrorMessage = "Số điện thoại không hợp lệ")]
        public string Phone { get; set; } = string.Empty;

        [Required(ErrorMessage = "Email không được để trống")]
        [EmailAddress(ErrorMessage = "Email không hợp lệ")]
        public string Email { get; set; } = string.Empty;

        [Required(ErrorMessage = "Địa chỉ không được để trống")]
        public string Address { get; set; } = string.Empty;

        [Required(ErrorMessage = "Mã số thuế không được để trống")]
        public string TaxCode { get; set; } = string.Empty;

        public bool IsActive { get; set; } = true;
    }
}
