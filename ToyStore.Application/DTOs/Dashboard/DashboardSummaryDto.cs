using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ToyStoreManagement.Application.DTOs.Dashboard
{
    public class DashboardSummaryDto
    {
        // 1. Doanh thu & Dòng tiền
        public decimal TotalRevenue { get; set; }           // Doanh thu đơn hoàn tất trong kỳ
        public decimal ExpectedRevenue { get; set; }        // Doanh thu dự kiến (tổng đơn hợp lệ phát sinh)
        public decimal PaidAmount { get; set; }             // Tổng thực thu = Online đã trả + COD đã nộp về shop
        public decimal OnlinePaidAmount { get; set; }       // Tiền thực thu từ cổng Online (ZaloPay, Chuyển khoản)
        public decimal CodSubmittedAmount { get; set; }     // Tiền COD Shipper đã đối soát nộp về quỹ
        public decimal CodPendingVerificationAmount { get; set; } // Shipper đã báo nộp, chờ cửa hàng kiểm tra
        public decimal UnpaidAmount { get; set; }           // Tổng tiền chưa thu / công nợ
        public decimal CodHoldingAmount { get; set; }       // Tiền mặt COD Shipper đang giữ ngoài thực địa
        public decimal PendingCollectionAmount { get; set; } // Tiền COD từ các đơn đang xử lý / đang giao

        // 2. Sản phẩm & Tồn kho
        public int TotalSoldQuantity { get; set; }          // Tổng số lượng sản phẩm bán ra trong kỳ
        public int CurrentInventoryQuantity { get; set; }   // Tổng tồn kho hiện tại các biến thể
        public int TotalProducts { get; set; }              // Tổng số mặt hàng đang kinh doanh
        public int LowStockCount { get; set; }              // Số mặt hàng sắp hết hàng (<= 10)

        // 3. Đơn hàng & Khách hàng
        public int TotalOrders { get; set; }                // Tổng số đơn phát sinh trong kỳ
        public int CompletedOrders { get; set; }            // Số đơn hoàn tất
        public int ShippingOrders { get; set; }             // Số đơn đang giao hàng
        public int ProcessingOrders { get; set; }           // Số đơn đang đóng gói / xác nhận
        public int FailedOrders { get; set; }               // Số đơn giao thất bại / hoàn hàng
        public int CancelledOrders { get; set; }            // Số đơn bị hủy
        public int TotalCustomers { get; set; }             // Tổng số khách hàng

        // 4. Chỉ số Logistics & Vận hành
        public double DeliverySuccessRate { get; set; }     // Tỷ lệ giao hàng thành công (%)
        public double ReturnRate { get; set; }              // Tỷ lệ hoàn hàng (%)
    }
}
