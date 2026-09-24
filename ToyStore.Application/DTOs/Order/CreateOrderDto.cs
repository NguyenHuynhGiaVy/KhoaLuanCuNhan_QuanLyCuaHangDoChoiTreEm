using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ToyStoreManagement.Application.DTOs.Order
{
    public class CreateOrderDto
    {
        public int? CustomerId { get; set; }
        public string Note { get; set; }
        // 0: COD, 1: Chuyển khoản. Thanh toán được đánh dấu hoàn tất
        // khi đơn chuyển sang trạng thái Hoàn tất.
        public int PaymentMethod { get; set; }
        // Thông tin nhận hàng được lưu trong bảng Shipping, không ghép vào ghi chú.
        public CreateShippingDto Shipping { get; set; }

        public List<CreateOrderDetailDto> OrderDetails { get; set; }
    }
}
