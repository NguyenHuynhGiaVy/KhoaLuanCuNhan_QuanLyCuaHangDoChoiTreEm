using Microsoft.AspNetCore.Mvc;

namespace ToyStore.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public abstract class BaseApiController : ControllerBase
    {
    }
}