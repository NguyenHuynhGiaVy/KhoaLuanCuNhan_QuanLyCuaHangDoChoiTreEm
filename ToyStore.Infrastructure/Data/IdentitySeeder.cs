using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Identity;
using ToyStoreManagement.Domain.Identity;
using ToyStore.Domain.Identity;

namespace ToyStoreManagement.Infrastructure.Data
{
    public static class IdentitySeeder
    {
        public static async Task SeedAdminFromEnvironmentAsync(
            UserManager<ApplicationUser> userManager)
        {
            var email = Environment.GetEnvironmentVariable(
                "TOYSTORE_ADMIN_EMAIL");

            var password = Environment.GetEnvironmentVariable(
                "TOYSTORE_ADMIN_PASSWORD");

            if (string.IsNullOrWhiteSpace(email)
                || string.IsNullOrWhiteSpace(password))
            {
                return;
            }

            var existingUser = await userManager.FindByEmailAsync(email);

            if (existingUser != null)
            {
                if (!await userManager.IsInRoleAsync(existingUser, "Admin"))
                {
                    await userManager.AddToRoleAsync(existingUser, "Admin");
                }

                return;
            }

            var user = new ApplicationUser
            {
                UserName = email,
                Email = email,
                FullName = "Nguyen Huynh Gia Vy",
                IsActive = true,
                EmailConfirmed = true
            };

            user.PasswordHash = userManager.PasswordHasher.HashPassword(
                user,
                password);

            var result = await userManager.CreateAsync(user);

            if (!result.Succeeded)
            {
                throw new InvalidOperationException(
                    string.Join(
                        "; ",
                        result.Errors.Select(error => error.Description)));
            }

            await userManager.AddToRoleAsync(user, "Admin");
        }

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