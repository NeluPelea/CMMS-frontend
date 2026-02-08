using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cmms.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddExtraJobs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ExtraJobs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    IsDone = table.Column<bool>(type: "boolean", nullable: false),
                    AssignedToPersonId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    FinishedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExtraJobs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ExtraJobs_People_AssignedToPersonId",
                        column: x => x.AssignedToPersonId,
                        principalTable: "People",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_ExtraJobs_AssignedToPersonId",
                table: "ExtraJobs",
                column: "AssignedToPersonId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ExtraJobs");
        }
    }
}
