using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStoreManagement.Application.DTOs.Customer;
using ToyStoreManagement.Application.Interfaces;
using ToyStoreManagement.Application.Interfaces.Repositories;
using ToyStoreManagement.Application.Interfaces.Services;
using ToyStoreManagement.Domain.Entities;
using ToyStore.Application.Interfaces.Repositories;

namespace ToyStoreManagement.Infrastructure.Services
{
    public class CustomerService : ICustomerService
    {
        private readonly ICustomerRepository _customerRepository;
        private readonly IUnitOfWork _unitOfWork;

        public CustomerService(
            ICustomerRepository customerRepository,
            IUnitOfWork unitOfWork)
        {
            _customerRepository = customerRepository;
            _unitOfWork = unitOfWork;
        }

        public async Task<IEnumerable<CustomerDto>> GetAllAsync()
        {
            var customers = await _customerRepository
                .GetAllWithDetailsAsync();

            return customers.Select(MapToDto);
        }

        public async Task<CustomerDto?> GetByIdAsync(int customerId)
        {
            var customer = await _customerRepository
                .GetByIdWithDetailsAsync(customerId);

            return customer == null ? null : MapToDto(customer);
        }

        public async Task<CustomerDto?> GetByUserIdAsync(string userId)
        {
            var customer = await _customerRepository
                .GetByUserIdAsync(userId);

            return customer == null ? null : MapToDto(customer);
        }

        public async Task<CustomerDto> CreateAsync(
            CreateCustomerDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.FullName))
                throw new Exception("Họ tên khách hàng không được để trống.");

            if (dto.LoyaltyPoint < 0)
                throw new Exception("Điểm tích lũy không hợp lệ.");

            if (!string.IsNullOrWhiteSpace(dto.UserId))
            {
                var existingCustomer =
                    await _customerRepository.GetByUserIdAsync(dto.UserId);

                if (existingCustomer != null)
                    throw new Exception(
                        "Tài khoản này đã được liên kết với khách hàng.");
            }

            var customer = new Customer
            {
                FullName = dto.FullName,
                Phone = dto.Phone,
                Email = dto.Email,
                UserId = dto.UserId,
                DateOfBirth = dto.DateOfBirth,
                Gender = dto.Gender,
                Address = dto.Address,
                LoyaltyPoint = dto.LoyaltyPoint,
                Status = dto.Status,
                CreatedAt = DateTime.UtcNow
            };

            await _customerRepository.AddAsync(customer);
            await _unitOfWork.SaveChangesAsync();

            return MapToDto(customer);
        }

        public async Task<CustomerDto?> UpdateAsync(
            int customerId,
            UpdateCustomerDto dto)
        {
            var customer = await _customerRepository
                .GetByIdWithDetailsAsync(customerId);

            if (customer == null)
                return null;

            if (string.IsNullOrWhiteSpace(dto.FullName))
                throw new Exception("Họ tên khách hàng không được để trống.");

            customer.FullName = dto.FullName;
            customer.Phone = dto.Phone;
            customer.Email = dto.Email;
            customer.DateOfBirth = dto.DateOfBirth;
            customer.Gender = dto.Gender;
            customer.Address = dto.Address;
            customer.Status = dto.Status;
            customer.UpdatedAt = DateTime.UtcNow;

            _customerRepository.Update(customer);
            await _unitOfWork.SaveChangesAsync();

            return MapToDto(customer);
        }

        public async Task<bool> DeleteAsync(int customerId)
        {
            var customer = await _customerRepository
                .GetByIdWithDetailsAsync(customerId);

            if (customer == null)
                return false;

            // Soft delete
            customer.Status = 0;
            customer.UpdatedAt = DateTime.UtcNow;

            _customerRepository.Update(customer);
            await _unitOfWork.SaveChangesAsync();

            return true;
        }

        private static CustomerDto MapToDto(Customer customer)
        {
            return new CustomerDto
            {
                CustomerId = customer.CustomerId,
                FullName = customer.FullName,
                Phone = customer.Phone,
                Email = customer.Email,
                UserId = customer.UserId,
                DateOfBirth = customer.DateOfBirth,
                Gender = customer.Gender,
                Address = customer.Address,
                LoyaltyPoint = customer.LoyaltyPoint,
                Status = customer.Status,
                CreatedAt = customer.CreatedAt,
                UpdatedAt = customer.UpdatedAt
            };
        }
    }
}
