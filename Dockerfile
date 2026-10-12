# ==========================================
# Multi-stage Dockerfile for ToyStore Management (.NET 8)
# Deployable to Render, Railway, Docker, etc.
# ==========================================

# Stage 1: Build & Publish
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy Solution và các file .csproj để tối ưu cache layer khi restore
COPY ["ToyStoreManagement.sln", "./"]
COPY ["ToyStore.Domain/ToyStore.Domain.csproj", "ToyStore.Domain/"]
COPY ["ToyStore.Application/ToyStore.Application.csproj", "ToyStore.Application/"]
COPY ["ToyStore.Infrastructure/ToyStore.Infrastructure.csproj", "ToyStore.Infrastructure/"]
COPY ["ToyStore.API/ToyStore.API.csproj", "ToyStore.API/"]

# Restore NuGet packages
RUN dotnet restore "ToyStore.API/ToyStore.API.csproj"

# Copy toàn bộ mã nguồn
COPY . .

# Build và Publish bản Release
WORKDIR "/src/ToyStore.API"
RUN dotnet publish "ToyStore.API.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Stage 2: Runtime Environment
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

# Render nhận diện cổng từ lệnh EXPOSE
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "ToyStore.API.dll"]
