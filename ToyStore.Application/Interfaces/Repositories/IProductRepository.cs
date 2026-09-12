using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStore.Application.Interfaces.Repositories;
using ToyStoreManagement.Domain.Entities;


namespace ToyStoreManagement.Application.Interfaces.Repositories
{
    public interface IProductRepository
        : IGenericRepository<Product>
    {
        Task<IEnumerable<Product>> GetProductsWithDetailsAsync();

        Task<Product?> GetProductWithDetailsAsync(int productId);
    }
}