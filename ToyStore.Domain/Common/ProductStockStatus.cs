using ToyStoreManagement.Domain.Entities;

namespace ToyStoreManagement.Domain.Common
{
    public static class ProductStockStatus
    {
        public const int Disabled = 0;
        public const int Active = 1;
        public const int Discontinued = 2;
        public const int OutOfStock = 3;

        public static void Synchronize(Product product, int quantity)
        {
            if (quantity <= 0 && product.Status == Active)
                product.Status = OutOfStock;
            // Sản phẩm mới được tạo ở trạng thái mặc định Disabled để chờ nhập kho.
            // Khi tồn kho đã có, phải tự mở bán; riêng Discontinued không bao giờ bị
            // thay đổi bởi biến động kho.
            else if (quantity > 0 && (product.Status == OutOfStock || product.Status == Disabled))
                product.Status = Active;
        }
    }
}
