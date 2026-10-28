using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ToyStoreManagement.Application.DTOs.Promotion;
using ToyStoreManagement.Application.Interfaces.Repositories;
using ToyStoreManagement.Application.Interfaces.Services;
using ToyStoreManagement.Domain.Entities;
using ToyStore.Application.Interfaces.Repositories;
using ToyStoreManagement.Infrastructure.Data;

namespace ToyStoreManagement.Infrastructure.Services
{
    public class VoucherService : IVoucherService
    {
        private readonly IVoucherRepository _voucherRepository;
        private readonly IVoucherUsageRepository _usageRepository;
        private readonly IGenericRepository<Order> _orderRepository;
        private readonly IGenericRepository<Customer> _customerRepository;
        private readonly IUnitOfWork _unitOfWork;
        private readonly ApplicationDbContext _context;

        public VoucherService(
            IVoucherRepository voucherRepository,
            IVoucherUsageRepository usageRepository,
            IGenericRepository<Order> orderRepository,
            IGenericRepository<Customer> customerRepository,
            IUnitOfWork unitOfWork,
            ApplicationDbContext context)
        {
            _voucherRepository = voucherRepository;
            _usageRepository = usageRepository;
            _orderRepository = orderRepository;
            _customerRepository = customerRepository;
            _unitOfWork = unitOfWork;
            _context = context;
        }

        public async Task<IEnumerable<VoucherDto>> GetAllAsync()
        {
            await MarkExpiredVouchersAsync();
            var vouchers =
                await _voucherRepository.GetAllWithDetailsAsync();

            return vouchers.Select(MapToDto);
        }

        public async Task<VoucherDto?> GetByIdAsync(int voucherId)
        {
            await MarkExpiredVouchersAsync();
            var voucher =
                await _voucherRepository.GetByIdWithDetailsAsync(
                    voucherId);

            if (voucher == null)
                return null;

            return MapToDto(voucher);
        }

        public async Task<VoucherDto?> GetByCodeAsync(string code)
        {
            if (string.IsNullOrWhiteSpace(code))
                return null;

            await MarkExpiredVouchersAsync();
            var voucher =
                await _voucherRepository.GetByCodeAsync(code);

            if (voucher == null)
                return null;

            return MapToDto(voucher);
        }

        private async Task MarkExpiredVouchersAsync()
        {
            var now = DateTime.UtcNow;
            var expiredVouchers = await _context.Vouchers
                .Where(x => x.Status == 1 && x.EndDate < now)
                .ToListAsync();

            if (expiredVouchers.Count == 0)
                return;

            foreach (var voucher in expiredVouchers)
            {
                voucher.Status = 2;
                voucher.UpdatedAt = now;
            }

            await _context.SaveChangesAsync();
        }

        public async Task<VoucherDto> CreateAsync(
            CreateVoucherDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Code))
                throw new Exception(
                    "Mã voucher không được để trống.");

            if (string.IsNullOrWhiteSpace(dto.Name))
                throw new Exception(
                    "Tên voucher không được để trống.");

            if (dto.StartDate >= dto.EndDate)
                throw new Exception(
                    "Ngày bắt đầu phải trước ngày kết thúc.");

            ValidateDiscount(dto.DiscountType, dto.DiscountValue,
                dto.MaximumDiscount);

            if (dto.MinimumOrderValue.HasValue &&
                dto.MinimumOrderValue.Value < 0)
                throw new Exception(
                    "Giá trị đơn hàng tối thiểu không được âm.");

            if (dto.UsageLimit < 0)
                throw new Exception(
                    "Giới hạn sử dụng không được âm.");

            if (dto.UsageLimitPerCustomer.HasValue &&
                dto.UsageLimitPerCustomer.Value <= 0)
                throw new Exception(
                    "Giới hạn sử dụng mỗi khách hàng phải lớn hơn 0.");

            ValidateRequiredPoints(dto.RequiredPoints);

            var existingVoucher =
                await _voucherRepository.GetByCodeAsync(
                    dto.Code.Trim().ToUpperInvariant());

            if (existingVoucher != null)
                throw new Exception(
                    "Mã voucher đã tồn tại.");

            var voucher = new Voucher
            {
                Code = dto.Code.Trim().ToUpperInvariant(),
                Name = dto.Name.Trim(),
                DiscountType = dto.DiscountType,
                DiscountValue = dto.DiscountValue,
                MaximumDiscount = dto.MaximumDiscount,
                MinimumOrderValue = dto.MinimumOrderValue,
                RequiredPoints = dto.RequiredPoints,
                UsageLimit = dto.UsageLimit,
                UsedCount = 0,
                UsageLimitPerCustomer =
                    dto.UsageLimitPerCustomer,
                StartDate = dto.StartDate,
                EndDate = dto.EndDate,
                Status = dto.Status == 0 ? 0 : 1,
                CreatedAt = DateTime.UtcNow
            };

            await _voucherRepository.AddAsync(voucher);

            await _unitOfWork.SaveChangesAsync();

            var result =
                await _voucherRepository.GetByIdWithDetailsAsync(
                    voucher.VoucherId);

            return MapToDto(result!);
        }

        public async Task<VoucherDto?> UpdateAsync(
            int voucherId,
            UpdateVoucherDto dto)
        {
            var voucher =
                await _voucherRepository.GetByIdAsync(
                    voucherId);

            if (voucher == null)
                return null;

            if (string.IsNullOrWhiteSpace(dto.Name))
                throw new Exception(
                    "Tên voucher không được để trống.");

            if (dto.StartDate >= dto.EndDate)
                throw new Exception(
                    "Ngày bắt đầu phải trước ngày kết thúc.");

            ValidateDiscount(dto.DiscountType, dto.DiscountValue,
                dto.MaximumDiscount);

            if (dto.MinimumOrderValue.HasValue &&
                dto.MinimumOrderValue.Value < 0)
                throw new Exception(
                    "Giá trị đơn hàng tối thiểu không được âm.");

            if (dto.UsageLimit > 0
                && dto.UsageLimit < voucher.UsedCount)
                throw new Exception(
                    "UsageLimit không được nhỏ hơn số lượt đã sử dụng.");

            if (dto.UsageLimitPerCustomer.HasValue &&
                dto.UsageLimitPerCustomer.Value <= 0)
                throw new Exception(
                    "Giới hạn sử dụng mỗi khách hàng phải lớn hơn 0.");

            ValidateRequiredPoints(dto.RequiredPoints);

            // Không biến voucher thường đã được dùng thành phần thưởng đổi điểm,
            // hoặc ngược lại, vì sẽ làm thay đổi quyền đã cấp cho khách hàng.
            if (voucher.RequiredPoints != dto.RequiredPoints
                && (voucher.UsedCount > 0 || await _context.LoyaltyTransactions
                    .AnyAsync(item => item.VoucherId == voucherId && item.TransactionType == 2)))
            {
                throw new Exception("Voucher đã phát sinh sử dụng hoặc đổi điểm nên không thể đổi hình thức phát hành.");
            }

            voucher.Name = dto.Name.Trim();
            voucher.DiscountType = dto.DiscountType;
            voucher.DiscountValue = dto.DiscountValue;
            voucher.MaximumDiscount = dto.MaximumDiscount;
            voucher.MinimumOrderValue = dto.MinimumOrderValue;
            voucher.RequiredPoints = dto.RequiredPoints;
            voucher.UsageLimit = dto.UsageLimit;
            voucher.UsageLimitPerCustomer =
                dto.UsageLimitPerCustomer;
            voucher.StartDate = dto.StartDate;
            voucher.EndDate = dto.EndDate;
            voucher.Status = dto.Status;
            voucher.UpdatedAt = DateTime.UtcNow;

            _voucherRepository.Update(voucher);

            await _unitOfWork.SaveChangesAsync();

            var result =
                await _voucherRepository.GetByIdWithDetailsAsync(
                    voucherId);

            return result == null
                ? null
                : MapToDto(result);
        }

        private static void ValidateDiscount(
            int discountType,
            decimal discountValue,
            decimal? maximumDiscount)
        {
            if (discountType is not 0 and not 1)
                throw new Exception("Loại giảm giá không hợp lệ.");

            if (discountValue <= 0)
                throw new Exception("Giá trị giảm giá phải lớn hơn 0.");

            if (discountType == 0 && discountValue > 100)
                throw new Exception(
                    "Voucher giảm theo phần trăm không được vượt quá 100%.");

            if (maximumDiscount.HasValue && maximumDiscount.Value < 0)
                throw new Exception("Mức giảm tối đa không được âm.");
        }

        private static void ValidateRequiredPoints(int requiredPoints)
        {
            if (requiredPoints < 0)
                throw new Exception("Số điểm cần đổi không được âm.");
        }

        public async Task<bool> DeleteAsync(int voucherId)
        {
            var voucher =
                await _voucherRepository.GetByIdAsync(
                    voucherId);

            if (voucher == null)
                return false;

            if (voucher.UsedCount > 0)
                throw new Exception(
                    "Không thể xóa voucher đã được sử dụng.");

            _voucherRepository.Delete(voucher);

            await _unitOfWork.SaveChangesAsync();

            return true;
        }

        public async Task<VoucherUsageDto> UseVoucherAsync(
            int voucherId,
            int orderId,
            int? customerId,
            decimal discountAmount)
        {
            var voucher =
                await _voucherRepository.GetByIdAsync(
                    voucherId);

            if (voucher == null)
                throw new Exception(
                    "Không tìm thấy voucher.");

            var order =
                await _orderRepository.GetByIdAsync(orderId);

            if (order == null)
                throw new Exception(
                    "Không tìm thấy đơn hàng.");

            if (customerId.HasValue)
            {
                var customer =
                    await _customerRepository.GetByIdAsync(
                        customerId.Value);

                if (customer == null)
                    throw new Exception(
                        "Không tìm thấy khách hàng.");
            }

            var now = DateTime.UtcNow;

            if (voucher.Status == 0)
                throw new Exception(
                    "Voucher đang không hoạt động.");

            if (now < voucher.StartDate ||
                now > voucher.EndDate)
                throw new Exception(
                    "Voucher không nằm trong thời gian hiệu lực.");

            var isRewardVoucher = voucher.RequiredPoints > 0;
            if (!isRewardVoucher && voucher.UsageLimit > 0 &&
                voucher.UsedCount >= voucher.UsageLimit)
                throw new Exception(
                    "Voucher đã hết lượt sử dụng.");

            if (discountAmount < 0)
                throw new Exception(
                    "Số tiền giảm không được âm.");

            if (voucher.MaximumDiscount.HasValue &&
                discountAmount > voucher.MaximumDiscount.Value)
            {
                discountAmount =
                    voucher.MaximumDiscount.Value;
            }

            if (voucher.MinimumOrderValue.HasValue &&
                order.TotalAmount <
                voucher.MinimumOrderValue.Value)
            {
                throw new Exception(
                    "Đơn hàng chưa đạt giá trị tối thiểu để sử dụng voucher.");
            }

            if (isRewardVoucher)
            {
                if (!customerId.HasValue)
                    throw new Exception("Voucher đổi điểm chỉ áp dụng cho tài khoản đã đổi voucher.");

                var hasRedeemed = await _context.LoyaltyTransactions.AnyAsync(item =>
                    item.CustomerId == customerId.Value
                    && item.VoucherId == voucherId
                    && item.TransactionType == 2);
                if (!hasRedeemed)
                    throw new Exception("Bạn cần đổi voucher này bằng điểm trước khi sử dụng.");

                var hasUsedReward = await _context.VoucherUsages.AnyAsync(usage =>
                    usage.VoucherId == voucherId
                    && usage.CustomerId == customerId.Value);
                if (hasUsedReward)
                    throw new Exception("Voucher đổi điểm này đã được sử dụng.");
            }

            if (!isRewardVoucher && customerId.HasValue &&
                voucher.UsageLimitPerCustomer.HasValue)
            {
                var customerUsages =
                    await _usageRepository
                        .GetByCustomerIdAsync(customerId.Value);

                var usedCount =
                    customerUsages.Count(
                        x => x.VoucherId == voucherId);

                if (usedCount >=
                    voucher.UsageLimitPerCustomer.Value)
                {
                    throw new Exception(
                        "Khách hàng đã đạt giới hạn sử dụng voucher.");
                }
            }

            var existingUsage =
                await _usageRepository
                    .GetByOrderIdAsync(orderId);

            if (existingUsage.Any(
                x => x.VoucherId == voucherId))
            {
                throw new Exception(
                    "Voucher đã được sử dụng cho đơn hàng này.");
            }

            var usage = new VoucherUsage
            {
                VoucherId = voucherId,
                OrderId = orderId,
                CustomerId = customerId,
                DiscountAmount = discountAmount,
                UsedAt = now
            };

            await _usageRepository.AddAsync(usage);

            if (!isRewardVoucher)
                voucher.UsedCount++;

            _voucherRepository.Update(voucher);

            await _unitOfWork.SaveChangesAsync();

            return MapUsageToDto(usage);
        }

        private VoucherDto MapToDto(Voucher voucher)
        {
            return new VoucherDto
            {
                VoucherId = voucher.VoucherId,
                Code = voucher.Code,
                Name = voucher.Name,
                DiscountType = voucher.DiscountType,
                DiscountValue = voucher.DiscountValue,
                MaximumDiscount = voucher.MaximumDiscount,
                MinimumOrderValue = voucher.MinimumOrderValue,
                RequiredPoints = voucher.RequiredPoints,
                UsageLimit = voucher.UsageLimit,
                UsedCount = voucher.UsedCount,
                UsageLimitPerCustomer =
                    voucher.UsageLimitPerCustomer,
                StartDate = voucher.StartDate,
                EndDate = voucher.EndDate,
                Status = voucher.Status,
                CreatedAt = voucher.CreatedAt,
                UpdatedAt = voucher.UpdatedAt,

                VoucherUsages =
                    voucher.VoucherUsages?
                        .Select(MapUsageToDto)
                        .ToList()
                    ?? new List<VoucherUsageDto>()
            };
        }

        private VoucherUsageDto MapUsageToDto(
            VoucherUsage usage)
        {
            return new VoucherUsageDto
            {
                VoucherUsageId =
                    usage.VoucherUsageId,

                VoucherId =
                    usage.VoucherId,

                OrderId =
                    usage.OrderId,

                CustomerId =
                    usage.CustomerId,

                DiscountAmount =
                    usage.DiscountAmount,

                UsedAt =
                    usage.UsedAt
            };
        }
    }
}
