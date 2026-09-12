using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStoreManagement.Domain.Entities;
using ToyStore.Application.Interfaces.Repositories;

namespace ToyStoreManagement.Application.Interfaces.Repositories
{
    public interface IVoucherUsageRepository
        : IGenericRepository<VoucherUsage>
    {
        Task<IEnumerable<VoucherUsage>> GetByVoucherIdAsync(
            int voucherId);

        Task<IEnumerable<VoucherUsage>> GetByOrderIdAsync(
            int orderId);

        Task<IEnumerable<VoucherUsage>> GetByCustomerIdAsync(
            int customerId);
    }
}
