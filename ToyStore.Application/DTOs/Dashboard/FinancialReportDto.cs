using System;
using System.Collections.Generic;

namespace ToyStoreManagement.Application.DTOs.Dashboard
{
    public class FinancialReportDto
    {
        public DateTime? FromDate { get; set; }
        public DateTime? ToDate { get; set; }
        public string GroupBy { get; set; } = "day";

        // Tổng quan tài chính
        public decimal TotalGrossRevenue { get; set; }
        public decimal TotalPaidAmount { get; set; }
        public decimal TotalOnlineAmount { get; set; }
        public decimal TotalCodSubmittedAmount { get; set; }
        public decimal TotalCodPendingVerificationAmount { get; set; }
        public decimal TotalCodHoldingAmount { get; set; }
        public decimal TotalPendingAmount { get; set; }

        // Dữ liệu theo chu kỳ (ngày / tháng / năm)
        public List<FinancialPeriodItemDto> Items { get; set; } = new();

        // Cơ cấu doanh thu theo danh mục
        public List<CategoryRevenueDto> CategoryRevenues { get; set; } = new();

        // Hiệu suất đội ngũ Shipper
        public List<ShipperPerformanceDto> ShipperPerformances { get; set; } = new();
    }

    public class FinancialPeriodItemDto
    {
        public string PeriodLabel { get; set; } = string.Empty;
        public DateTime PeriodDate { get; set; }
        public int OrderCount { get; set; }
        public int CompletedOrderCount { get; set; }
        public decimal GrossRevenue { get; set; }
        public decimal PaidAmount { get; set; }
        public decimal OnlineAmount { get; set; }
        public decimal CodSubmittedAmount { get; set; }
        public decimal CodPendingVerificationAmount { get; set; }
        public decimal CodHoldingAmount { get; set; }
        public decimal PendingAmount { get; set; }
        public double CollectionRate { get; set; }
    }

    public class CategoryRevenueDto
    {
        public int CategoryId { get; set; }
        public string CategoryName { get; set; } = string.Empty;
        public int SoldQuantity { get; set; }
        public decimal Revenue { get; set; }
        public double Percentage { get; set; }
    }

    public class ShipperPerformanceDto
    {
        public int ShipperId { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string PhoneNumber { get; set; } = string.Empty;
        public string VehicleNumber { get; set; } = string.Empty;
        public int TotalAssigned { get; set; }
        public int CompletedDeliveries { get; set; }
        public int FailedDeliveries { get; set; }
        public int InTransitCount { get; set; }
        public decimal CodHoldingAmount { get; set; }
        public decimal CodPendingVerificationAmount { get; set; }
        public decimal CodSubmittedAmount { get; set; }
        public double SuccessRate { get; set; }
    }
}
