using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStore.Application.Interfaces.Repositories;
using ToyStoreManagement.Application.DTOs.CustomerCare;
using ToyStoreManagement.Application.Interfaces.Repositories;
using ToyStoreManagement.Application.Interfaces.Services;
using ToyStoreManagement.Domain.Entities;
using ToyStoreManagement.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System.Data;
using ToyStoreManagement.Domain.Common;

namespace ToyStoreManagement.Infrastructure.Services
{
    public class ReturnRequestService : IReturnRequestService
    {
        private readonly IReturnRequestRepository _returnRequestRepository;
        private readonly IReturnRequestDetailRepository _detailRepository;
        private readonly IGenericRepository<Order> _orderRepository;
        private readonly IGenericRepository<Customer> _customerRepository;
        private readonly IGenericRepository<ProductVariant> _variantRepository;
        private readonly IUnitOfWork _unitOfWork;
        private readonly ApplicationDbContext _context;

        public ReturnRequestService(
            IReturnRequestRepository returnRequestRepository,
            IReturnRequestDetailRepository detailRepository,
            IGenericRepository<Order> orderRepository,
            IGenericRepository<Customer> customerRepository,
            IGenericRepository<ProductVariant> variantRepository,
            IUnitOfWork unitOfWork,
            ApplicationDbContext context)
        {
            _returnRequestRepository = returnRequestRepository;
            _detailRepository = detailRepository;
            _orderRepository = orderRepository;
            _customerRepository = customerRepository;
            _variantRepository = variantRepository;
            _unitOfWork = unitOfWork;
            _context = context;
        }

        public async Task<IEnumerable<ReturnRequestDto>> GetAllAsync()
        {
            var requests =
                await _returnRequestRepository.GetAllWithDetailsAsync();

            return requests.Select(MapToDto);
        }

        public async Task<ReturnRequestDto?> GetByIdAsync(
            int returnRequestId)
        {
            var request =
                await _returnRequestRepository
                    .GetByIdWithDetailsAsync(returnRequestId);

            return request == null ? null : MapToDto(request);
        }

        public async Task<IEnumerable<ReturnRequestDto>> GetByCustomerIdAsync(
            int customerId)
        {
            var requests =
                await _returnRequestRepository
                    .GetByCustomerIdAsync(customerId);

            return requests.Select(MapToDto);
        }

        public async Task<IEnumerable<ReturnRequestDto>> GetByOrderIdAsync(
            int orderId)
        {
            var requests =
                await _returnRequestRepository
                    .GetByOrderIdAsync(orderId);

            return requests.Select(MapToDto);
        }

        public async Task<ReturnRequestDto?> GetByReturnCodeAsync(
            string returnCode)
        {
            var request =
                await _returnRequestRepository
                    .GetByReturnCodeAsync(returnCode);

            return request == null ? null : MapToDto(request);
        }

        public async Task<ReturnRequestDetailDto?> GetDetailByIdAsync(
            int returnRequestDetailId)
        {
            var detail = await _context.ReturnRequestDetails
                .Include(x => x.ProductVariant)
                    .ThenInclude(x => x.Product)
                .FirstOrDefaultAsync(x => x.ReturnRequestDetailId == returnRequestDetailId);
            if (detail == null)
                return null;
            return new ReturnRequestDetailDto
            {
                ReturnRequestDetailId = detail.ReturnRequestDetailId,
                ReturnRequestId = detail.ReturnRequestId,
                VariantId = detail.VariantId,
                SKU = detail.ProductVariant?.SKU ?? string.Empty,
                ProductName = detail.ProductVariant?.Product?.Name ?? string.Empty,
                Quantity = detail.Quantity,
                UnitPrice = detail.UnitPrice,
                RefundAmount = detail.RefundAmount,
                Reason = detail.Reason
            };
        }

        public async Task<ReturnRequestDto> CreateAsync(
            CreateReturnRequestDto dto)
        {
            if (dto.Details == null || !dto.Details.Any())
                throw new Exception("Yêu cầu đổi/trả phải có sản phẩm.");
            if (dto.Details.Any(x => x.Quantity <= 0))
                throw new Exception("Số lượng đổi/trả phải lớn hơn 0.");
            if (dto.Details.GroupBy(x => x.VariantId).Any(x => x.Count() > 1))
                throw new Exception("Không được lặp sản phẩm trong cùng một yêu cầu trả hàng.");
            if (dto.Reason is < 0 or > 3)
                throw new Exception("Lý do trả hàng không hợp lệ.");
            if (dto.Description?.Length > 2000 || dto.EvidenceImageUrl?.Length > 500)
                throw new Exception("Mô tả hoặc đường dẫn minh chứng vượt quá độ dài cho phép.");

            await using var transaction = await _context.Database
                .BeginTransactionAsync(IsolationLevel.Serializable);
            var order = await _context.Orders
                .Include(x => x.OrderDetails)
                .Include(x => x.Shipping)
                .FirstOrDefaultAsync(x => x.OrderId == dto.OrderId);

            if (order == null)
                throw new Exception("Đơn hàng không tồn tại.");
            if (order.Status != 4)
                throw new Exception("Chỉ được yêu cầu trả hàng cho đơn đã hoàn tất.");
            var completedAt = order.Shipping?.DeliveredAt ?? order.OrderDate;
            if (DateTime.UtcNow - completedAt > TimeSpan.FromDays(7))
                throw new Exception("Đã quá thời hạn yêu cầu trả hàng 7 ngày.");
            if (!order.CustomerId.HasValue || order.CustomerId.Value != dto.CustomerId)
                throw new Exception("Khách hàng không khớp với đơn hàng.");

            var customer =
                await _customerRepository.GetByIdAsync(dto.CustomerId);

            if (customer == null)
                throw new Exception("Khách hàng không tồn tại.");

            var returnRequest = new ReturnRequest
            {
                OrderId = dto.OrderId,
                CustomerId = dto.CustomerId,
                ReturnCode = $"RET-{DateTime.UtcNow:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}"[..32],
                ReturnType = dto.ReturnType,
                Reason = dto.Reason,
                Description = dto.Description?.Trim() ?? string.Empty,
                EvidenceImageUrl = dto.EvidenceImageUrl?.Trim() ?? string.Empty,
                Status = 0,
                RefundAmount = 0,
                RequestedAt = DateTime.UtcNow,
                StaffNote = string.Empty
            };

            _context.ReturnRequests.Add(returnRequest);
            await _context.SaveChangesAsync();

            decimal totalRefund = 0;

            foreach (var detailDto in dto.Details)
            {
                var orderLines = order.OrderDetails
                    .Where(x => x.VariantId == detailDto.VariantId)
                    .ToList();
                if (orderLines.Count == 0)
                    throw new Exception($"Sản phẩm ID {detailDto.VariantId} không thuộc đơn hàng.");
                var variant = await _context.ProductVariants
                    .FirstOrDefaultAsync(x => x.VariantId == detailDto.VariantId);

                if (variant == null)
                    throw new Exception(
                        $"Variant {detailDto.VariantId} không tồn tại.");

                var purchasedQuantity = orderLines.Sum(x => x.Quantity);
                var returnedQuantity = await _context.ReturnRequestDetails
                    .Where(x => x.VariantId == detailDto.VariantId
                        && x.ReturnRequest.OrderId == order.OrderId
                        && (x.ReturnRequest.Status == 0
                            || x.ReturnRequest.Status == 1
                            || x.ReturnRequest.Status == 3))
                    .SumAsync(x => (int?)x.Quantity) ?? 0;
                if (returnedQuantity + detailDto.Quantity > purchasedQuantity)
                    throw new Exception($"Số lượng trả SKU {variant.SKU} vượt số lượng đã mua còn được trả.");

                var refundUnitPrice = orderLines.Sum(x => x.TotalAmount)
                    / purchasedQuantity;
                var refundAmount = decimal.Round(refundUnitPrice * detailDto.Quantity, 2);

                var detail = new ReturnRequestDetail
                {
                    ReturnRequestId = returnRequest.ReturnRequestId,
                    VariantId = detailDto.VariantId,
                    Quantity = detailDto.Quantity,
                    UnitPrice = refundUnitPrice,
                    RefundAmount = refundAmount,
                    Reason = string.IsNullOrWhiteSpace(detailDto.Reason)
                        ? "Khách hàng yêu cầu trả hàng"
                        : detailDto.Reason.Trim()
                };

                await _detailRepository.AddAsync(detail);

                totalRefund += refundAmount;
            }

            returnRequest.RefundAmount = totalRefund;

            _returnRequestRepository.Update(returnRequest);

            await _unitOfWork.SaveChangesAsync();
            await transaction.CommitAsync();

            var result =
                await _returnRequestRepository
                    .GetByIdWithDetailsAsync(returnRequest.ReturnRequestId);

            return MapToDto(result!);
        }

        public async Task<ReturnRequestDto?> UpdateAsync(
            int returnRequestId,
            UpdateReturnRequestDto dto)
        {
            await using var transaction = await _context.Database
                .BeginTransactionAsync(IsolationLevel.Serializable);
            var request =
                await _returnRequestRepository.GetByIdAsync(returnRequestId);

            if (request == null)
                return null;

            if (dto.RefundAmount < 0 || dto.RefundAmount > request.RefundAmount)
                throw new Exception("Số tiền hoàn không hợp lệ.");

            if (dto.Status == 3)
                throw new Exception("Hàng trả chỉ được xác nhận khi kho thực sự nhận lại hàng.");
            if (request.Status != dto.Status
                && (request.Status != 0 || (dto.Status != 1 && dto.Status != 2)))
                throw new Exception("Trạng thái yêu cầu trả hàng không thể chuyển đổi theo thao tác này.");

            request.Status = dto.Status;
            request.RefundAmount = dto.RefundAmount;
            request.StaffNote = dto.StaffNote;
            request.ProcessedAt = DateTime.UtcNow;

            _returnRequestRepository.Update(request);

            await _unitOfWork.SaveChangesAsync();
            await transaction.CommitAsync();

            var result =
                await _returnRequestRepository
                    .GetByIdWithDetailsAsync(returnRequestId);

            return MapToDto(result!);
        }

        public async Task<ReturnRequestDto?> ReceiveAsync(int returnRequestId)
        {
            await using var transaction = await _context.Database
                .BeginTransactionAsync(IsolationLevel.Serializable);
            var request = await _context.ReturnRequests
                .Include(x => x.Order)
                .Include(x => x.Customer)
                .Include(x => x.ReturnRequestDetails)
                    .ThenInclude(x => x.ProductVariant)
                        .ThenInclude(x => x.Product)
                .FirstOrDefaultAsync(x => x.ReturnRequestId == returnRequestId);
            if (request == null)
                return null;
            if (request.Status != 1)
                throw new InvalidOperationException("Chỉ có thể nhận hàng từ yêu cầu đã được duyệt.");
            if (request.ReturnRequestDetails.Count == 0)
                throw new InvalidOperationException("Yêu cầu trả hàng không có sản phẩm.");

            var affectedProductIds = new HashSet<int>();
            foreach (var detail in request.ReturnRequestDetails)
            {
                var inventory = await _context.Inventories
                    .FirstOrDefaultAsync(x => x.VariantId == detail.VariantId);
                if (inventory == null)
                {
                    inventory = new Inventory
                    {
                        VariantId = detail.VariantId,
                        Quantity = 0,
                        ReservedQuantity = 0,
                        UpdatedAt = DateTime.UtcNow
                    };
                    _context.Inventories.Add(inventory);
                }
                if (inventory.Quantity < 0
                    || inventory.ReservedQuantity < 0
                    || inventory.ReservedQuantity > inventory.Quantity)
                    throw new InvalidOperationException($"Dữ liệu tồn kho biến thể {detail.VariantId} không hợp lệ.");
                if (inventory.Quantity > int.MaxValue - detail.Quantity)
                    throw new InvalidOperationException($"Số lượng tồn kho biến thể {detail.VariantId} vượt giới hạn.");
                inventory.Quantity += detail.Quantity;
                inventory.UpdatedAt = DateTime.UtcNow;
                var productId = await _context.ProductVariants
                    .Where(x => x.VariantId == detail.VariantId)
                    .Select(x => x.ProductId)
                    .FirstAsync();
                affectedProductIds.Add(productId);
                _context.InventoryTransactions.Add(new InventoryTransaction
                {
                    TransactionId = 0,
                    VariantId = detail.VariantId,
                    TransactionType = 1,
                    Quantity = detail.Quantity,
                    ReferenceType = "ReturnRequest",
                    ReferenceId = request.ReturnRequestId,
                    Note = $"Nhận hàng trả theo phiếu {request.ReturnCode}",
                    CreatedAt = DateTime.UtcNow
                });
            }

            foreach (var productId in affectedProductIds)
            {
                var product = await _context.Products.FindAsync(productId);
                if (product == null)
                    continue;
                var totalStock = await _context.Inventories
                    .Where(x => x.ProductVariant.ProductId == productId)
                    .SumAsync(x => (int?)x.Quantity) ?? 0;
                ProductStockStatus.Synchronize(product, totalStock);
                product.UpdatedAt = DateTime.UtcNow;
            }

            request.Status = 3;
            request.ProcessedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
            return MapToDto(request);
        }

        public async Task<bool> DeleteAsync(int returnRequestId)
        {
            var request =
                await _returnRequestRepository.GetByIdAsync(returnRequestId);

            if (request == null)
                return false;

            if (request.Status != 0)
                throw new Exception(
                    "Chỉ được xóa yêu cầu đổi/trả chưa xử lý.");

            _returnRequestRepository.Delete(request);

            await _unitOfWork.SaveChangesAsync();

            return true;
        }

        public async Task<ReturnRequestDetailDto> AddDetailAsync(
            int returnRequestId,
            CreateReturnRequestDetailDto dto)
        {
            await using var transaction = await _context.Database
                .BeginTransactionAsync(IsolationLevel.Serializable);
            var request =
                await _returnRequestRepository.GetByIdAsync(returnRequestId);

            if (request == null)
                throw new Exception("Yêu cầu đổi/trả không tồn tại.");

            if (request.Status != 0)
                throw new Exception(
                    "Không thể thêm chi tiết khi yêu cầu đã được xử lý.");
            var orderCompletionAt = await _context.Orders
                .Where(x => x.OrderId == request.OrderId)
                .Select(x => x.Shipping.DeliveredAt ?? x.OrderDate)
                .FirstOrDefaultAsync();
            if (DateTime.UtcNow - orderCompletionAt > TimeSpan.FromDays(7))
                throw new Exception("Đã quá thời hạn yêu cầu trả hàng 7 ngày.");

            if (dto.Quantity <= 0)
                throw new Exception("Số lượng phải lớn hơn 0.");

            if (dto.UnitPrice < 0 || dto.RefundAmount < 0)
                throw new Exception(
                    "Đơn giá và tiền hoàn không được âm.");

            var variant =
                await _variantRepository.GetByIdAsync(dto.VariantId);

            if (variant == null)
                throw new Exception("Biến thể sản phẩm không tồn tại.");

            var orderLines = await _context.OrderDetails
                .Where(x => x.OrderId == request.OrderId && x.VariantId == dto.VariantId)
                .ToListAsync();
            if (orderLines.Count == 0)
                throw new Exception("Sản phẩm không thuộc đơn hàng của yêu cầu trả.");
            if (await _context.ReturnRequestDetails.AnyAsync(x =>
                x.ReturnRequestId == returnRequestId && x.VariantId == dto.VariantId))
                throw new Exception("Sản phẩm đã có trong yêu cầu trả hàng này.");
            var purchasedQuantity = orderLines.Sum(x => x.Quantity);
            var returnedQuantity = await _context.ReturnRequestDetails
                .Where(x => x.VariantId == dto.VariantId
                    && x.ReturnRequest.OrderId == request.OrderId
                    && (x.ReturnRequest.Status == 0
                        || x.ReturnRequest.Status == 1
                        || x.ReturnRequest.Status == 3))
                .SumAsync(x => (int?)x.Quantity) ?? 0;
            if (returnedQuantity + dto.Quantity > purchasedQuantity)
                throw new Exception("Số lượng trả vượt số lượng đã mua còn được trả.");
            var refundUnitPrice = orderLines.Sum(x => x.TotalAmount) / purchasedQuantity;
            var refundAmount = decimal.Round(refundUnitPrice * dto.Quantity, 2);

            var detail = new ReturnRequestDetail
            {
                ReturnRequestId = returnRequestId,
                VariantId = dto.VariantId,
                Quantity = dto.Quantity,
                UnitPrice = refundUnitPrice,
                RefundAmount = refundAmount,
                Reason = string.IsNullOrWhiteSpace(dto.Reason)
                    ? "Khách hàng yêu cầu trả hàng"
                    : dto.Reason.Trim()
            };

            await _detailRepository.AddAsync(detail);

            request.RefundAmount += refundAmount;

            _returnRequestRepository.Update(request);

            await _unitOfWork.SaveChangesAsync();
            await transaction.CommitAsync();

            return new ReturnRequestDetailDto
            {
                ReturnRequestDetailId = detail.ReturnRequestDetailId,
                ReturnRequestId = detail.ReturnRequestId,
                VariantId = detail.VariantId,
                SKU = variant.SKU,
                ProductName = null,
                Quantity = detail.Quantity,
                UnitPrice = detail.UnitPrice,
                RefundAmount = detail.RefundAmount,
                Reason = detail.Reason
            };
        }

        public async Task<bool> DeleteDetailAsync(
            int returnRequestDetailId)
        {
            await using var transaction = await _context.Database
                .BeginTransactionAsync(IsolationLevel.Serializable);
            var detail =
                await _detailRepository.GetByIdAsync(returnRequestDetailId);

            if (detail == null)
                return false;

            var request =
                await _returnRequestRepository
                    .GetByIdAsync(detail.ReturnRequestId);

            if (request == null)
                throw new Exception("Yêu cầu đổi/trả không tồn tại.");

            if (request.Status != 0)
                throw new Exception(
                    "Không thể xóa chi tiết khi yêu cầu đã được xử lý.");

            request.RefundAmount -= detail.RefundAmount;

            if (request.RefundAmount < 0)
                request.RefundAmount = 0;

            _detailRepository.Delete(detail);
            _returnRequestRepository.Update(request);

            await _unitOfWork.SaveChangesAsync();
            await transaction.CommitAsync();

            return true;
        }

        private static ReturnRequestDto MapToDto(
            ReturnRequest request)
        {
            return new ReturnRequestDto
            {
                ReturnRequestId = request.ReturnRequestId,

                OrderId = request.OrderId,
                OrderCode = request.Order?.OrderCode,

                CustomerId = request.CustomerId,
                CustomerName = request.Customer?.FullName,

                ReturnCode = request.ReturnCode,
                ReturnType = request.ReturnType,
                Reason = request.Reason,
                Description = request.Description,
                EvidenceImageUrl = request.EvidenceImageUrl,
                Status = request.Status,
                RefundAmount = request.RefundAmount,
                RequestedAt = request.RequestedAt,
                ProcessedAt = request.ProcessedAt,
                StaffNote = request.StaffNote,

                Details = request.ReturnRequestDetails?
                    .Select(x => new ReturnRequestDetailDto
                    {
                        ReturnRequestDetailId =
                            x.ReturnRequestDetailId,

                        ReturnRequestId =
                            x.ReturnRequestId,

                        VariantId =
                            x.VariantId,

                        SKU =
                            x.ProductVariant?.SKU,

                        ProductName =
                            x.ProductVariant?.Product?.Name,

                        Quantity =
                            x.Quantity,

                        UnitPrice =
                            x.UnitPrice,

                        RefundAmount =
                            x.RefundAmount,

                        Reason =
                            x.Reason
                    })
                    .ToList()
                    ?? new List<ReturnRequestDetailDto>()
            };
        }
    }
}
