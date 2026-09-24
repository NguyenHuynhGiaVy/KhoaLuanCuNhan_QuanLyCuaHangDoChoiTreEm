using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ToyStoreManagement.Application.DTOs.Customer;
using ToyStoreManagement.Application.Interfaces.Repositories;
using ToyStoreManagement.Application.Interfaces.Services;
using ToyStoreManagement.Domain.Entities;
using ToyStoreManagement.Infrastructure.Data;

namespace ToyStoreManagement.Infrastructure.Services
{
    public class LoyaltyTransactionService
        : ILoyaltyTransactionService
    {
        private readonly ILoyaltyTransactionRepository
            _loyaltyTransactionRepository;
        private readonly ApplicationDbContext _context;

        public LoyaltyTransactionService(
            ILoyaltyTransactionRepository loyaltyTransactionRepository,
            ApplicationDbContext context)
        {
            _loyaltyTransactionRepository =
                loyaltyTransactionRepository;
            _context = context;
        }

        public async Task<IEnumerable<LoyaltyTransactionDto>>
            GetAllAsync()
        {
            var transactions =
                await _loyaltyTransactionRepository
                    .GetAllWithDetailsAsync();

            return transactions.Select(MapToDto);
        }

        public async Task<LoyaltySummaryDto?> GetSummaryByUserIdAsync(
            string userId)
        {
            var customer = await _context.Customers
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.UserId == userId);

            if (customer == null)
                return null;

            var now = DateTime.UtcNow;
            var vouchers = await _context.Vouchers
                .AsNoTracking()
                .Where(voucher => voucher.Status == 1
                    && voucher.RequiredPoints > 0
                    && voucher.StartDate <= now
                    && voucher.EndDate >= now
                    && (voucher.UsageLimit == 0 || voucher.UsedCount < voucher.UsageLimit))
                .OrderBy(voucher => voucher.RequiredPoints)
                .ThenBy(voucher => voucher.Name)
                .ToListAsync();

            var transactions = await _context.LoyaltyTransactions
                .AsNoTracking()
                .Where(item => item.CustomerId == customer.CustomerId)
                .OrderByDescending(item => item.CreatedAt)
                .Take(20)
                .ToListAsync();

            var redeemedVoucherIds = (await _context.LoyaltyTransactions
                .AsNoTracking()
                .Where(item => item.CustomerId == customer.CustomerId
                    && item.TransactionType == 2
                    && item.VoucherId.HasValue)
                .Select(item => item.VoucherId!.Value)
                .ToListAsync())
                .ToHashSet();

            return new LoyaltySummaryDto
            {
                CustomerId = customer.CustomerId,
                CustomerName = customer.FullName,
                LoyaltyPoint = customer.LoyaltyPoint,
                RedeemableVouchers = vouchers
                    .Select(voucher => MapRewardVoucher(
                        voucher,
                        redeemedVoucherIds.Contains(voucher.VoucherId)))
                    .ToList(),
                Transactions = transactions.Select(MapToDto).ToList()
            };
        }

        public async Task<RedeemVoucherDto> RedeemVoucherAsync(
            string userId,
            int voucherId)
        {
            await using var transaction = await _context.Database
                .BeginTransactionAsync(System.Data.IsolationLevel.Serializable);

            try
            {
                var customer = await _context.Customers
                    .FirstOrDefaultAsync(item => item.UserId == userId);

                if (customer == null)
                    throw new Exception("Không tìm thấy hồ sơ khách hàng.");

                var voucher = await _context.Vouchers
                    .FirstOrDefaultAsync(item => item.VoucherId == voucherId);

                if (voucher == null)
                    throw new Exception("Không tìm thấy voucher đổi thưởng.");

                var now = DateTime.UtcNow;
                if (voucher.Status != 1
                    || voucher.RequiredPoints <= 0
                    || voucher.StartDate > now
                    || voucher.EndDate < now)
                {
                    throw new Exception("Voucher hiện không khả dụng để đổi điểm.");
                }

                if (voucher.UsageLimit > 0
                    && voucher.UsedCount >= voucher.UsageLimit)
                {
                    throw new Exception("Voucher đã hết lượt sử dụng.");
                }

                if (customer.LoyaltyPoint < voucher.RequiredPoints)
                {
                    throw new Exception(
                        $"Bạn cần thêm {voucher.RequiredPoints - customer.LoyaltyPoint} điểm để đổi voucher này.");
                }

                var alreadyRedeemed = await _context.LoyaltyTransactions.AnyAsync(item =>
                    item.CustomerId == customer.CustomerId
                    && item.VoucherId == voucher.VoucherId
                    && item.TransactionType == 2);

                if (alreadyRedeemed)
                    throw new Exception("Bạn đã đổi voucher này rồi.");

                customer.LoyaltyPoint -= voucher.RequiredPoints;
                customer.UpdatedAt = now;

                _context.LoyaltyTransactions.Add(new LoyaltyTransaction
                {
                    CustomerId = customer.CustomerId,
                    VoucherId = voucher.VoucherId,
                    Points = -voucher.RequiredPoints,
                    TransactionType = 2,
                    Description = $"Đổi {voucher.RequiredPoints} điểm lấy voucher {voucher.Code} - {voucher.Name}",
                    CreatedAt = now
                });

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return new RedeemVoucherDto
                {
                    VoucherId = voucher.VoucherId,
                    Code = voucher.Code,
                    Name = voucher.Name,
                    PointsSpent = voucher.RequiredPoints,
                    RemainingPoints = customer.LoyaltyPoint
                };
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        public async Task<IEnumerable<LoyaltyTransactionDto>>
            GetByCustomerIdAsync(int customerId)
        {
            var transactions =
                await _loyaltyTransactionRepository
                    .GetByCustomerIdAsync(customerId);

            return transactions.Select(MapToDto);
        }

        private static LoyaltyTransactionDto MapToDto(
            Domain.Entities.LoyaltyTransaction transaction)
        {
            return new LoyaltyTransactionDto
            {
                LoyaltyTransactionId =
                    transaction.LoyaltyTransactionId,

                CustomerId = transaction.CustomerId,

                OrderId = transaction.OrderId,

                VoucherId = transaction.VoucherId,

                Points = transaction.Points,

                TransactionType =
                    transaction.TransactionType,

                Description = transaction.Description,

                CreatedAt = transaction.CreatedAt
            };
        }

        private static LoyaltyRewardVoucherDto MapRewardVoucher(
            Voucher voucher,
            bool isRedeemed)
        {
            return new LoyaltyRewardVoucherDto
            {
                VoucherId = voucher.VoucherId,
                Code = voucher.Code,
                Name = voucher.Name,
                DiscountType = voucher.DiscountType,
                DiscountValue = voucher.DiscountValue,
                MaximumDiscount = voucher.MaximumDiscount,
                MinimumOrderValue = voucher.MinimumOrderValue,
                RequiredPoints = voucher.RequiredPoints,
                IsRedeemed = isRedeemed,
                EndDate = voucher.EndDate
            };
        }
    }
}
