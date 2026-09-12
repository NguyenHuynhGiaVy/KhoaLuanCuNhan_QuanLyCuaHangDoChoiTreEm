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
    public class CustomerFeedbackService : ICustomerFeedbackService
    {
        private readonly ICustomerFeedbackRepository _feedbackRepository;
        private readonly IGenericRepository<Customer> _customerRepository;
        private readonly IGenericRepository<Order> _orderRepository;
        private readonly IUnitOfWork _unitOfWork;

        public CustomerFeedbackService(
            ICustomerFeedbackRepository feedbackRepository,
            IGenericRepository<Customer> customerRepository,
            IGenericRepository<Order> orderRepository,
            IUnitOfWork unitOfWork)
        {
            _feedbackRepository = feedbackRepository;
            _customerRepository = customerRepository;
            _orderRepository = orderRepository;
            _unitOfWork = unitOfWork;
        }

        public async Task<IEnumerable<CustomerFeedbackDto>> GetAllAsync()
        {
            var feedbacks = await _feedbackRepository.GetAllWithDetailsAsync();

            return feedbacks.Select(MapToDto);
        }

        public async Task<CustomerFeedbackDto?> GetByIdAsync(
            long customerFeedbackId)
        {
            var feedback = await _feedbackRepository
                .GetByIdWithDetailsAsync(customerFeedbackId);

            return feedback == null ? null : MapToDto(feedback);
        }

        public async Task<IEnumerable<CustomerFeedbackDto>> GetByCustomerIdAsync(
            int customerId)
        {
            var feedbacks = await _feedbackRepository
                .GetByCustomerIdAsync(customerId);

            return feedbacks.Select(MapToDto);
        }

        public async Task<IEnumerable<CustomerFeedbackDto>> GetByOrderIdAsync(
            int orderId)
        {
            var feedbacks = await _feedbackRepository
                .GetByOrderIdAsync(orderId);

            return feedbacks.Select(MapToDto);
        }

        public async Task<CustomerFeedbackDto> CreateAsync(
            CreateCustomerFeedbackDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Subject))
                throw new Exception("Tiêu đề không được để trống.");

            if (string.IsNullOrWhiteSpace(dto.Content))
                throw new Exception("Nội dung phản hồi không được để trống.");

            var customer = await _customerRepository
                .GetByIdAsync(dto.CustomerId);

            if (customer == null)
                throw new Exception("Khách hàng không tồn tại.");

            if (dto.OrderId.HasValue)
            {
                var order = await _orderRepository
                    .GetByIdAsync(dto.OrderId.Value);

                if (order == null)
                    throw new Exception("Đơn hàng không tồn tại.");
            }

            var feedback = new CustomerFeedback
            {
                CustomerId = dto.CustomerId,
                OrderId = dto.OrderId,
                Subject = dto.Subject,
                Content = dto.Content,
                FeedbackType = dto.FeedbackType,
                Status = 0,
                CreatedAt = DateTime.UtcNow
            };

            await _feedbackRepository.AddAsync(feedback);
            await _unitOfWork.SaveChangesAsync();

            var result = await _feedbackRepository
                .GetByIdWithDetailsAsync(feedback.CustomerFeedbackId);

            return MapToDto(result!);
        }

        public async Task<CustomerFeedbackDto?> UpdateAsync(
            long customerFeedbackId,
            UpdateCustomerFeedbackDto dto)
        {
            var feedback = await _feedbackRepository
                .GetByIdAsync(customerFeedbackId);

            if (feedback == null)
                return null;

            feedback.Status = dto.Status;
            feedback.Response = dto.Response;

            if (!string.IsNullOrWhiteSpace(dto.Response))
                feedback.RespondedAt = DateTime.UtcNow;

            _feedbackRepository.Update(feedback);

            await _unitOfWork.SaveChangesAsync();

            var result = await _feedbackRepository
                .GetByIdWithDetailsAsync(customerFeedbackId);

            return MapToDto(result!);
        }

        public async Task<bool> DeleteAsync(long customerFeedbackId)
        {
            var feedback = await _feedbackRepository
                .GetByIdAsync(customerFeedbackId);

            if (feedback == null)
                return false;

            _feedbackRepository.Delete(feedback);

            await _unitOfWork.SaveChangesAsync();

            return true;
        }

        private static CustomerFeedbackDto MapToDto(
            CustomerFeedback feedback)
        {
            return new CustomerFeedbackDto
            {
                CustomerFeedbackId = feedback.CustomerFeedbackId,
                CustomerId = feedback.CustomerId,
                CustomerName = feedback.Customer?.FullName,
                OrderId = feedback.OrderId,
                OrderCode = feedback.Order?.OrderCode,
                Subject = feedback.Subject,
                Content = feedback.Content,
                FeedbackType = feedback.FeedbackType,
                Status = feedback.Status,
                Response = feedback.Response,
                CreatedAt = feedback.CreatedAt,
                RespondedAt = feedback.RespondedAt
            };
        }
    }
}
