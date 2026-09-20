using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.ComponentModel.DataAnnotations;

namespace ToyStoreManagement.Application.DTOs.Product
{
    public class CreateProductVariantAttributeDto
    {
        [Required(ErrorMessage = "Tên thuộc tính không được để trống")]
        public string AttributeName { get; set; } = string.Empty;

        [Required(ErrorMessage = "Giá trị thuộc tính không được để trống")]
        public string AttributeValue { get; set; } = string.Empty;

        public int DisplayOrder { get; set; }
    }
}
