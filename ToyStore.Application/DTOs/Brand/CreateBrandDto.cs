using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ToyStore.Application.DTOs.Brand
{
    public class CreateBrandDto
    {
        public string Name { get; set; } = string.Empty;

        public string? Description { get; set; }
    }
}
