using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToyStore.Application.Interfaces.Repositories;
using ToyStoreManagement.Domain.Entities;
using ToyStoreManagement.Infrastructure.Data;

namespace ToyStore.Infrastructure.Repositories
{
    public class BrandRepository
        : GenericRepository<Brand>, IBrandRepository
    {
        public BrandRepository(ApplicationDbContext context)
            : base(context)
        {
        }
    }
}
