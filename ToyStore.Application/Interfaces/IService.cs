using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStore.Application.Common;
using ToyStore.Domain.Common;

namespace ToyStore.Application.Interfaces
{
    public interface IService<T>
        where T : BaseEntity
    {
        Task<Result<T>> GetByIdAsync(int id);

        Task<Result<IEnumerable<T>>> GetAllAsync();

        Task<Result<T>> CreateAsync(T entity);

        Task<Result<bool>> UpdateAsync(T entity);

        Task<Result<bool>> DeleteAsync(int id);
    }
}
