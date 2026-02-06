using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cmms.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkOrderAssignmentsCreatedAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CreatedAt",
                table: "WorkOrderAssignments",
                type: "timestamptz",
                nullable: false,
                defaultValueSql: "now()");

            migrationBuilder.Sql(@"UPDATE ""WorkOrderAssignments"" SET ""CreatedAt"" = now() WHERE ""CreatedAt"" IS NULL;");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "WorkOrderAssignments");
        }

    }
}
