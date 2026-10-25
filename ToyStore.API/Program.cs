using ToyStore.API.Middleware;
using ToyStore.Application.Common;
using Microsoft.EntityFrameworkCore;
using ToyStoreManagement.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using ToyStoreManagement.Domain.Identity;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using ToyStore.Application.Interfaces.Repositories;
using ToyStore.Infrastructure.Repositories;
using ToyStore.Application.Interfaces.Services;
using ToyStore.Application.Services;
using ToyStore.Infrastructure.Services;
using ToyStore.Domain.Identity;
using Microsoft.OpenApi.Models;
using ToyStoreManagement.Application.Interfaces.Repositories;
using ToyStoreManagement.Application.Interfaces.Services;
using ToyStoreManagement.Infrastructure.Repositories;
using ToyStoreManagement.Infrastructure.Services;
using ToyStoreManagement.API.Hubs;

var builder = WebApplication.CreateBuilder(args);

// Tự động lắng nghe cổng được cấp phát bởi Render/Cloud nếu có PORT env
var port = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrEmpty(port))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
}

builder.Services.AddHttpClient();
builder.Services.AddMemoryCache();

builder.Services.AddScoped(typeof(IGenericRepository<>), typeof(GenericRepository<>));

builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();

builder.Services.AddScoped<ICategoryRepository, CategoryRepository>();

builder.Services.AddScoped<ICategoryService, CategoryService>();

builder.Services.AddScoped<IBrandRepository, BrandRepository>();

builder.Services.AddScoped<IBrandService, BrandService>();

builder.Services.AddScoped<IAuthService, AuthService>();

builder.Services.AddScoped<IProductRepository, ProductRepository>();

builder.Services.AddScoped<IProductService, ProductService>();

builder.Services.AddScoped<ISupplierRepository, SupplierRepository>();
builder.Services.AddScoped<IImportReceiptRepository, ImportReceiptRepository>();

builder.Services.AddScoped<ISupplierService, SupplierService>();
builder.Services.AddScoped<IImportReceiptService, ImportReceiptService>();

builder.Services.AddScoped<IInventoryRepository, InventoryRepository>();
builder.Services.AddScoped<IInventoryTransactionRepository, InventoryTransactionRepository>();

builder.Services.AddScoped<IInventoryService, InventoryService>();
builder.Services.AddScoped<IInventoryTransactionService, InventoryTransactionService>();

builder.Services.AddScoped<ICustomerRepository, CustomerRepository>();
builder.Services.AddScoped<ILoyaltyTransactionRepository, LoyaltyTransactionRepository>();

builder.Services.AddScoped<ICustomerService, CustomerService>();
builder.Services.AddScoped<ILoyaltyTransactionService, LoyaltyTransactionService>();

builder.Services.AddScoped<IOrderRepository, OrderRepository>();
builder.Services.AddScoped<IPaymentRepository, PaymentRepository>();

builder.Services.AddScoped<IDistanceMatrixService, GoogleDistanceMatrixService>();
builder.Services.AddScoped<IOrderService, OrderService>();
builder.Services.AddScoped<IPaymentService, PaymentService>();

builder.Services.AddScoped<IPromotionRepository, PromotionRepository>();
builder.Services.AddScoped<IPromotionConditionRepository, PromotionConditionRepository>();
builder.Services.AddScoped<IPromotionProductRepository, PromotionProductRepository>();

builder.Services.AddScoped<IVoucherRepository, VoucherRepository>();
builder.Services.AddScoped<IVoucherUsageRepository, VoucherUsageRepository>();

builder.Services.AddScoped<IPromotionService, PromotionService>();
builder.Services.AddScoped<IVoucherService, VoucherService>();

builder.Services.AddScoped<IProductReviewRepository, ProductReviewRepository>();
builder.Services.AddScoped<ICustomerFeedbackRepository, CustomerFeedbackRepository>();
builder.Services.AddScoped<IReturnRequestRepository, ReturnRequestRepository>();
builder.Services.AddScoped<IReturnRequestDetailRepository, ReturnRequestDetailRepository>();

builder.Services.AddScoped<IProductReviewService, ProductReviewService>();
builder.Services.AddScoped<ICustomerFeedbackService, CustomerFeedbackService>();
builder.Services.AddScoped<IReturnRequestService, ReturnRequestService>();
builder.Services.AddScoped<ILiquidationService, LiquidationService>();
builder.Services.AddScoped<ISupportChatService, SupportChatService>();

builder.Services.AddScoped<IDashboardRepository, DashboardRepository>();
builder.Services.AddScoped<IDashboardService, DashboardService>();
builder.Services.AddScoped<IShipperService, ShipperService>();

builder.Services.Configure<AppSettings>(
    builder.Configuration.GetSection("AppSettings"));

builder.Services
    .AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy =
            System.Text.Json.JsonNamingPolicy.CamelCase;
    });
builder.Services.AddSignalR();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy
            .AllowAnyOrigin()
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition(
        "Bearer",
        new OpenApiSecurityScheme
        {
            Name = "Authorization",
            Type = SecuritySchemeType.Http,
            Scheme = "bearer",
            BearerFormat = "JWT",
            In = ParameterLocation.Header,
            Description =
                "Nhập JWT token. Ví dụ: Bearer eyJhbGciOiJIUzI1NiIs..."
        });

    options.AddSecurityRequirement(
        new OpenApiSecurityRequirement
        {
            {
                new OpenApiSecurityScheme
                {
                    Reference = new OpenApiReference
                    {
                        Type = ReferenceType.SecurityScheme,
                        Id = "Bearer"
                    }
                },
                Array.Empty<string>()
            }
        });
});

builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
    if (!string.IsNullOrEmpty(connectionString) && !connectionString.Contains("TrustServerCertificate", StringComparison.OrdinalIgnoreCase))
    {
        connectionString = connectionString.TrimEnd(';') + ";TrustServerCertificate=True;";
    }
    options.UseSqlServer(connectionString, sqlOptions =>
    {
        sqlOptions.CommandTimeout(60);
    });
});

builder.Services
    .AddIdentity<ApplicationUser, ApplicationRole>()
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddDefaultTokenProviders();

var jwtKey = builder.Configuration["Jwt:Key"];

builder.Services
    .AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme =
            JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme =
            JwtBearerDefaults.AuthenticationScheme;
        options.DefaultForbidScheme =
            JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        var jwtSettings = builder.Configuration.GetSection("Jwt");

        var key = jwtSettings["Key"]
            ?? throw new InvalidOperationException("JWT Key is not configured.");

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,

            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(key)),

            ValidateIssuer = true,

            ValidIssuer = jwtSettings["Issuer"],

            ValidateAudience = true,

            ValidAudience = jwtSettings["Audience"],

            ValidateLifetime = true,

            ClockSkew = TimeSpan.Zero
        };
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(accessToken)
                    && (context.HttpContext.Request.Path.StartsWithSegments("/hubs/support-chat")
                        || context.HttpContext.Request.Path.StartsWithSegments("/hubs/order-tracking")))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });

builder.Services.ConfigureApplicationCookie(options =>
{
    options.Events.OnRedirectToLogin = context =>
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return Task.CompletedTask;
    };

    options.Events.OnRedirectToAccessDenied = context =>
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        return Task.CompletedTask;
    };
});

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy =>
        policy.RequireRole("Admin"));

    options.AddPolicy("ManagerOnly", policy =>
        policy.RequireRole("Manager"));

    options.AddPolicy("StaffOnly", policy =>
        policy.RequireRole("Staff"));

    options.AddPolicy("AdminOrManager", policy =>
        policy.RequireRole("Admin", "Manager"));

    options.AddPolicy("StaffAccess", policy =>
        policy.RequireRole("Admin", "Manager", "Staff"));

    options.AddPolicy("ShipperAccess", policy =>
        policy.RequireRole("Admin", "Manager", "Staff", "Shipper"));

    options.AddPolicy("ShipperOnly", policy =>
        policy.RequireRole("Shipper"));

    options.AddPolicy("CustomerAccess", policy =>
        policy.RequireRole("Customer"));
});

var app = builder.Build();

// 1. Cấu hình Forwarded Headers tối ưu cho Render / Cloud Reverse Proxy (SSL termination)
var forwardedOptions = new ForwardedHeadersOptions
{
    ForwardedHeaders = Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedFor | Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedProto
};
forwardedOptions.KnownNetworks.Clear();
forwardedOptions.KnownProxies.Clear();
app.UseForwardedHeaders(forwardedOptions);

// 2. Health check endpoint cho Render uptime monitor & keep-alive ping
app.MapGet("/health", () => Results.Ok(new { status = "Healthy", timestamp = DateTime.UtcNow }));

// 3. Exception Handler Middleware
app.UseMiddleware<ExceptionMiddleware>();

// 4. Phục vụ Static Files & Default Files
var defaultFiles = new DefaultFilesOptions();
defaultFiles.DefaultFileNames.Clear();
defaultFiles.DefaultFileNames.Add("customer.html");
app.UseDefaultFiles(defaultFiles);
app.UseStaticFiles();

// 5. Friendly Direct Routes (ngăn lỗi 404 khi truy cập không có đuôi .html)
app.MapGet("/admin", () => Results.Redirect("/index.html"));
app.MapGet("/shipper", () => Results.Redirect("/shipper.html"));
app.MapGet("/customer", () => Results.Redirect("/customer.html"));
app.MapGet("/products", () => Results.Redirect("/products.html"));

// 6. Khởi tạo & Patch Database an toàn khi deploy
using (var scope = app.Services.CreateScope())
{
    try
    {
        var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        try
        {
            await dbContext.Database.MigrateAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Database Migration Warning] {ex.Message}");
        }

        await DatabasePatchHelper.ApplyPatchesAsync(dbContext);

        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<ApplicationRole>>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        await IdentitySeeder.SeedRolesAsync(roleManager);
        await IdentitySeeder.SeedAdminFromEnvironmentAsync(userManager);
        await IdentitySeeder.SeedShipperAsync(userManager);
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[Startup Seeding Warning] {ex.Message}");
    }
}

// 7. Swagger Documentation
if (app.Environment.IsDevelopment() || builder.Configuration.GetValue<bool>("EnableSwagger", true))
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// 8. HTTPS Redirection & CORS
app.UseHttpsRedirection();
app.UseCors("AllowFrontend");

// 9. Authentication & Authorization
app.UseAuthentication();
app.UseAuthorization();

// 10. Map Controllers & SignalR Hubs
app.MapControllers();
app.MapHub<SupportChatHub>("/hubs/support-chat");
app.MapHub<OrderTrackingHub>("/hubs/order-tracking");

app.Run();
