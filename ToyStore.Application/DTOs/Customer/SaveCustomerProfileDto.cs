using System;

namespace ToyStoreManagement.Application.DTOs.Customer
{
    // Thông tin khách hàng tự quản lý sau khi đăng ký tài khoản.
    // Không nhận UserId, điểm hay trạng thái từ trình duyệt.
    public class SaveCustomerProfileDto
    {
        public string FullName { get; set; } = string.Empty;

        public string Phone { get; set; } = string.Empty;

        public DateTime? DateOfBirth { get; set; }

        public int? Gender { get; set; }

        public string Address { get; set; } = string.Empty;
    }
}
