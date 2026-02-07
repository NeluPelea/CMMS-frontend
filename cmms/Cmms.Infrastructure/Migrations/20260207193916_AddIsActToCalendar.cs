using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cmms.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddIsActToCalendar : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsAct",
                table: "NationalHolidays",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsAct",
                table: "CompanyBlackoutDays",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsAct",
                table: "NationalHolidays");

            migrationBuilder.DropColumn(
                name: "IsAct",
                table: "CompanyBlackoutDays");
        }
    }
}
