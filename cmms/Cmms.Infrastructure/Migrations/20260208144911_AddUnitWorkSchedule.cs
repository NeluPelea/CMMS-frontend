using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cmms.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUnitWorkSchedule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "unit_work_schedule",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    MonFriStart = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    MonFriEnd = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    SatStart = table.Column<TimeOnly>(type: "time without time zone", nullable: true),
                    SatEnd = table.Column<TimeOnly>(type: "time without time zone", nullable: true),
                    SunStart = table.Column<TimeOnly>(type: "time without time zone", nullable: true),
                    SunEnd = table.Column<TimeOnly>(type: "time without time zone", nullable: true),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_unit_work_schedule", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "unit_work_schedule");
        }
    }
}
