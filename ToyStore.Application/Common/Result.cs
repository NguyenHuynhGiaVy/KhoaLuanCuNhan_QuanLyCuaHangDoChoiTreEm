using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ToyStore.Application.Common
{
    public class Result<T>
    {
        public bool Success { get; set; }

        public string Message { get; set; }

        public T Data { get; set; }

        public static Result<T> Ok(T data, string message = null)
        {
            return new Result<T>
            {
                Success = true,
                Message = message,
                Data = data
            };
        }

        public static Result<T> Fail(string message)
        {
            return new Result<T>
            {
                Success = false,
                Message = message,
                Data = default(T)
            };
        }
    }
}
