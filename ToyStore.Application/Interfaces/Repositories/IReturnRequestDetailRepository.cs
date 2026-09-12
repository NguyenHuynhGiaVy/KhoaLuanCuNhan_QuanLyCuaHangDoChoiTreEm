using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStore.Application.Interfaces.Repositories;
using ToyStoreManagement.Domain.Entities;

namespace ToyStoreManagement.Application.Interfaces.Repositories
{
    public interface IReturnRequestDetailRepository : IGenericRepository<ReturnRequestDetail>
    {
        Task<IEnumerable<ReturnRequestDetail>> GetByReturnRequestIdAsync(int returnRequestId);
    }
}
