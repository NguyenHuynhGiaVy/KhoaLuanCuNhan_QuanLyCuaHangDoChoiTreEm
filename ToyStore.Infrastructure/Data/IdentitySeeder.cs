using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Identity;
using ToyStoreManagement.Domain.Identity;

namespace ToyStoreManagement.Infrastructure.Data
{
    public static class IdentitySeeder
    {
        public static async Task SeedRolesAsync(
            RoleManager<ApplicationRole> roleManager)
        {
            var roles = new[]
            {
                new ApplicationRole
                {
                    Name = "Admin",
                    Description = "Quản trị toàn hệ thống"
                },

                new ApplicationRole
                {
                    Name = "Manager",
                    Description = "Quản lý cửa hàng"
                },

                new ApplicationRole
                {
                    Name = "Staff",
                    Description = "Nhân viên cửa hàng"
                },

                new ApplicationRole
                {
                    Name = "Customer",
                    Description = "Khách hàng"
                }
            };

            foreach (var role in roles)
            {
                if (!await roleManager.RoleExistsAsync(role.Name))
                {
                    await roleManager.CreateAsync(role);
                }
            }
        }
    }
}