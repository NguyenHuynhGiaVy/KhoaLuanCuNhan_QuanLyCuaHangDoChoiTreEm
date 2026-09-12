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

        public ReturnRequestService(
            IReturnRequestRepository returnRequestRepository,
            IReturnRequestDetailRepository detailRepository,
            IGenericRepository<Order> orderRepository,
            IGenericRepository<Customer> customerRepository,
            IGenericRepository<ProductVariant> variantRepository,
            IUnitOfWork unitOfWork)
        {
            _returnRequestRepository = returnRequestRepository;
            _detailRepository = detailRepository;
            _orderRepository = orderRepository;
            _customerRepository = customerRepository;
            _variantRepository = variantRepository;
            _unitOfWork = unitOfWork;
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

        public async Task<ReturnRequestDto> CreateAsync(
            CreateReturnRequestDto dto)
        {
            if (dto.Details == null || !dto.Details.Any())
                throw new Exception("Yêu cầu đổi/trả phải có sản phẩm.");

            var order = await _orderRepository.GetByIdAsync(dto.OrderId);

            if (order == null)
                throw new Exception("Đơn hàng không tồn tại.");

            var customer =
                await _customerRepository.GetByIdAsync(dto.CustomerId);

            if (customer == null)
                throw new Exception("Khách hàng không tồn tại.");

            if (dto.Details.Any(x => x.Quantity <= 0))
                throw new Exception("Số lượng đổi/trả phải lớn hơn 0.");

            var returnRequest = new ReturnRequest
            {
                OrderId = dto.OrderId,
                CustomerId = dto.CustomerId,
                ReturnCode = $"RET-{DateTime.UtcNow:yyyyMMddHHmmssfff}",
                ReturnType = dto.ReturnType,
                Reason = dto.Reason,
                Description = dto.Description,
                EvidenceImageUrl = dto.EvidenceImageUrl,
                Status = 0,
                RefundAmount = 0,
                RequestedAt = DateTime.UtcNow
            };

            await _returnRequestRepository.AddAsync(returnRequest);

            decimal totalRefund = 0;

            foreach (var detailDto in dto.Details)
            {
                var variant =
                    await _variantRepository.GetByIdAsync(detailDto.VariantId);

                if (variant == null)
                    throw new Exception(
                        $"Variant {detailDto.VariantId} không tồn tại.");

                if (detailDto.UnitPrice < 0 ||
                    detailDto.RefundAmount < 0)
                    throw new Exception(
                        "Đơn giá và tiền hoàn không được âm.");

                var detail = new ReturnRequestDetail
                {
                    ReturnRequestId = returnRequest.ReturnRequestId,
                    VariantId = detailDto.VariantId,
                    Quantity = detailDto.Quantity,
                    UnitPrice = detailDto.UnitPrice,
                    RefundAmount = detailDto.RefundAmount,
                    Reason = detailDto.Reason
                };

                await _detailRepository.AddAsync(detail);

                totalRefund += detailDto.RefundAmount;
            }

            returnRequest.RefundAmount = totalRefund;

            _returnRequestRepository.Update(returnRequest);

            await _unitOfWork.SaveChangesAsync();

            var result =
                await _returnRequestRepository
                    .GetByIdWithDetailsAsync(returnRequest.ReturnRequestId);

            return MapToDto(result!);
        }

        public async Task<ReturnRequestDto?> UpdateAsync(
            int returnRequestId,
            UpdateReturnRequestDto dto)
        {
            var request =
                await _returnRequestRepository.GetByIdAsync(returnRequestId);

            if (request == null)
                return null;

            if (dto.RefundAmount < 0)
                throw new Exception("Số tiền hoàn không được âm.");

            request.Status = dto.Status;
            request.RefundAmount = dto.RefundAmount;
            request.StaffNote = dto.StaffNote;
            request.ProcessedAt = DateTime.UtcNow;

            _returnRequestRepository.Update(request);

            await _unitOfWork.SaveChangesAsync();

            var result =
                await _returnRequestRepository
                    .GetByIdWithDetailsAsync(returnRequestId);

            return MapToDto(result!);
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
            var request =
                await _returnRequestRepository.GetByIdAsync(returnRequestId);

            if (request == null)
                throw new Exception("Yêu cầu đổi/trả không tồn tại.");

            if (request.Status != 0)
                throw new Exception(
                    "Không thể thêm chi tiết khi yêu cầu đã được xử lý.");

            if (dto.Quantity <= 0)
                throw new Exception("Số lượng phải lớn hơn 0.");

            if (dto.UnitPrice < 0 || dto.RefundAmount < 0)
                throw new Exception(
                    "Đơn giá và tiền hoàn không được âm.");

            var variant =
                await _variantRepository.GetByIdAsync(dto.VariantId);

            if (variant == null)
                throw new Exception("Biến thể sản phẩm không tồn tại.");

            var detail = new ReturnRequestDetail
            {
                ReturnRequestId = returnRequestId,
                VariantId = dto.VariantId,
                Quantity = dto.Quantity,
                UnitPrice = dto.UnitPrice,
                RefundAmount = dto.RefundAmount,
                Reason = dto.Reason
            };

            await _detailRepository.AddAsync(detail);

            request.RefundAmount += dto.RefundAmount;

            _returnRequestRepository.Update(request);

            await _unitOfWork.SaveChangesAsync();

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
