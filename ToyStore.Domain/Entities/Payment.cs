using System;

namespace ToyStoreManagement.Domain.Entities
{
    public class Payment
    {
        public int PaymentId { get; set; }

        public int OrderId { get; set; }

        public int PaymentMethod { get; set; }

        public string TransactionCode { get; set; }

        // Mã giao dịch do cổng thanh toán trả về (ví dụ: zp_trans_id của ZaloPay).
        public string? GatewayTransactionCode { get; set; }

        public decimal Amount { get; set; }

        public int Status { get; set; }

        public DateTime? PaidAt { get; set; }

        // Trạng thái đối soát COD: 0 = Chưa thu / Online, 1 = Shipper đang giữ tiền, 2 = Đã nộp tiền về cửa hàng
        public int CodStatus { get; set; } = 0;

        public DateTime? CodCollectedAt { get; set; }

        public DateTime? CodSubmittedAt { get; set; }

        public string? CodNote { get; set; }

        public DateTime CreatedAt { get; set; }

        // Navigation
        public virtual Order Order { get; set; }
    }
}
