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
            else if (quantity > 0 && product.Status == OutOfStock)
                product.Status = Active;
        }
    }
}
