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
                "TOYSTORE_ADMIN_EMAIL") ?? "admin@toystore.vn";

            var password = Environment.GetEnvironmentVariable(
                "TOYSTORE_ADMIN_PASSWORD") ?? "Admin@123";

            var existingUser = await userManager.FindByEmailAsync(email);

            if (existingUser != null)
            {
                bool needsUpdate = false;
                if (!existingUser.IsActive)
                {
                    existingUser.IsActive = true;
                    needsUpdate = true;
                }

                // Luôn cập nhật lại PasswordHash chuẩn cho Admin
                existingUser.PasswordHash = userManager.PasswordHasher.HashPassword(existingUser, password);
                needsUpdate = true;

                if (needsUpdate)
                {
                    await userManager.UpdateAsync(existingUser);
                }

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
                },

                new ApplicationRole
                {
                    Name = "Shipper",
                    Description = "Nhân viên giao hàng"
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

        public static async Task SeedShipperAsync(
            UserManager<ApplicationUser> userManager)
        {
            var email = "shipper@toystore.vn";
            var password = "Shipper@123";

            var existingUser = await userManager.FindByEmailAsync(email);
            if (existingUser != null)
            {
                if (!existingUser.IsActive)
                {
                    existingUser.IsActive = true;
                    await userManager.UpdateAsync(existingUser);
                }
                if (!await userManager.IsInRoleAsync(existingUser, "Shipper"))
                {
                    await userManager.AddToRoleAsync(existingUser, "Shipper");
                }
                return;
            }

            var user = new ApplicationUser
            {
                UserName = email,
                Email = email,
                FullName = "Nguyễn Văn Giao (Shipper)",
                PhoneNumber = "0909123456",
                IsActive = true,
                EmailConfirmed = true
            };

            user.PasswordHash = userManager.PasswordHasher.HashPassword(user, password);
            var result = await userManager.CreateAsync(user);
            if (result.Succeeded)
            {
                await userManager.AddToRoleAsync(user, "Shipper");
            }
        }
    }
}