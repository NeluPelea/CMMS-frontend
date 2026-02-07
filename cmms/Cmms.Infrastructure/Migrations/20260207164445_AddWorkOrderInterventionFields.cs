using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cmms.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkOrderInterventionFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Cause",
                table: "WorkOrders",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Defect",
                table: "WorkOrders",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Solution",
                table: "WorkOrders",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Cause",
                table: "WorkOrders");

            migrationBuilder.DropColumn(
                name: "Defect",
                table: "WorkOrders");

            migrationBuilder.DropColumn(
                name: "Solution",
                table: "WorkOrders");
        }
    }
}
