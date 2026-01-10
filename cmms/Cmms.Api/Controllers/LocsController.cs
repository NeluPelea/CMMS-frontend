using Cmms.Infrastructure;
using Cmms.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Cmms.Api.Controllers
{
    [ApiController]
    [Route("api/locs")]
    [Authorize]
    public class LocsController : ControllerBase
    {
        private readonly AppDbContext _db;

        public LocsController(AppDbContext db)
        {
            _db = db;
        }

        // DTO-uri scurte
        public class LocDto
        {
            public System.Guid Id { get; set; }
            public string Name { get; set; }
            public string Code { get; set; }
        }

        public class LocReq
        {
            public string Name { get; set; }
            public string Code { get; set; }
        }

        // GET /api/locs?q=...&take=100
        [HttpGet]
        public async System.Threading.Tasks.Task<IActionResult> List([FromQuery] string q = null, [FromQuery] int take = 100)
        {
            if (take <= 0) take = 100;
            if (take > 500) take = 500;

            var qry = _db.Locations.AsNoTracking().AsQueryable();

            if (!string.IsNullOrWhiteSpace(q))
            {
                q = q.Trim().ToLower();
                qry = qry.Where(x =>
                    (x.Name != null && x.Name.ToLower().Contains(q)) ||
                    (x.Code != null && x.Code.ToLower().Contains(q))
                );
            }

            var items = await qry
                .OrderBy(x => x.Name)
                .Take(take)
                .Select(x => new LocDto
                {
                    Id = x.Id,
                    Name = x.Name,
                    Code = x.Code
                })
                .ToListAsync();

            return Ok(items);
        }

        // GET /api/locs/{id}
        [HttpGet("{id}")]
        public async System.Threading.Tasks.Task<IActionResult> Get(string id)
        {
            System.Guid gid;
            if (!System.Guid.TryParse(id, out gid)) return BadRequest("bad id");

            var x = await _db.Locations.AsNoTracking().FirstOrDefaultAsync(a => a.Id == gid);
            if (x == null) return NotFound();

            return Ok(new LocDto { Id = x.Id, Name = x.Name, Code = x.Code });
        }

        // POST /api/locs
        [HttpPost]
        public async System.Threading.Tasks.Task<IActionResult> Create([FromBody] LocReq req)
        {
            if (req == null) return BadRequest("req null");

            var name = (req.Name ?? "").Trim();
            var code = (req.Code ?? "").Trim();

            if (name.Length < 2) return BadRequest("name too short");
            if (name.Length > 120) return BadRequest("name too long");
            if (code.Length > 40) return BadRequest("code too long");

            // optional: unicitate Code daca e completat
            if (!string.IsNullOrWhiteSpace(code))
            {
                var exists = await _db.Locations.AsNoTracking().AnyAsync(x => x.Code == code);
                if (exists) return Conflict("code exists");
            }

            var loc = new Location
            {
                Name = name,
                Code = string.IsNullOrWhiteSpace(code) ? null : code
            };

            _db.Locations.Add(loc);
            await _db.SaveChangesAsync();

            return Ok(new LocDto { Id = loc.Id, Name = loc.Name, Code = loc.Code });
        }

        // PUT /api/locs/{id}
        [HttpPut("{id}")]
        public async System.Threading.Tasks.Task<IActionResult> Update(string id, [FromBody] LocReq req)
        {
            System.Guid gid;
            if (!System.Guid.TryParse(id, out gid)) return BadRequest("bad id");
            if (req == null) return BadRequest("req null");

            var loc = await _db.Locations.FirstOrDefaultAsync(x => x.Id == gid);
            if (loc == null) return NotFound();

            var name = (req.Name ?? "").Trim();
            var code = (req.Code ?? "").Trim();

            if (name.Length < 2) return BadRequest("name too short");
            if (name.Length > 120) return BadRequest("name too long");
            if (code.Length > 40) return BadRequest("code too long");

            if (!string.IsNullOrWhiteSpace(code))
            {
                var exists = await _db.Locations.AsNoTracking()
                    .AnyAsync(x => x.Code == code && x.Id != gid);
                if (exists) return Conflict("code exists");
            }

            loc.Name = name;
            loc.Code = string.IsNullOrWhiteSpace(code) ? null : code;

            await _db.SaveChangesAsync();

            return Ok(new LocDto { Id = loc.Id, Name = loc.Name, Code = loc.Code });
        }

        // DELETE /api/locs/{id}  (soft delete)
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            if (!Guid.TryParse(id, out var gid))
                return BadRequest("bad id");

            var loc = await _db.Locations.FirstOrDefaultAsync(x => x.Id == gid);
            if (loc == null)
                return NotFound();

            loc.IsAct = false;
            await _db.SaveChangesAsync();

            return Ok(new { ok = true });
        }
    }
}
